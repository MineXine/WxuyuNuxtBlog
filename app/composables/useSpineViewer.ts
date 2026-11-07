/**
 * Spine 3.5 运行时加载与 WebGL 预览器
 *
 * - 运行时来自 public/vendor/spine35/spine-webgl.js（官方 3.5.51 build，全局 `spine`）
 * - 二进制 .skel 由 public/vendor/spine35/spine35-skel.js 转成 3.5 JSON
 * - 渲染循环自绘（Shader + PolygonBatcher + SkeletonRenderer），支持缩放/平移/骨架线框
 */

const SPINE_RUNTIME_SRC = '/vendor/spine35/spine-webgl.js'
const SPINE_BINARY_SRC = '/vendor/spine35/spine35-skel.js'

/** 顺序加载运行时脚本（重复调用复用同一 Promise） */
let spineLoading: Promise<any> | null = null
export function loadSpine35Runtime(): Promise<any> {
	if (typeof window === 'undefined')
		return Promise.reject(new Error('SSR 环境不可用'))
	const win = window as any
	if (win.spine && win.Spine35Binary)
		return Promise.resolve(win.spine)
	if (spineLoading)
		return spineLoading

	spineLoading = new Promise((resolve, reject) => {
		const load = (src: string) => new Promise<void>((done, fail) => {
			const exist = document.querySelector(`script[data-spine35="${src}"]`)
			if (exist) {
				if (exist.getAttribute('data-loaded') === '1')
					done()
				else
					exist.addEventListener('load', () => done(), { once: true })
				return
			}
			const el = document.createElement('script')
			el.src = src
			el.async = false
			el.dataset.spine35 = src
			el.addEventListener('load', () => {
				el.setAttribute('data-loaded', '1')
				done()
			}, { once: true })
			el.addEventListener('error', () => fail(new Error(`脚本加载失败：${src}`)), { once: true })
			document.head.appendChild(el)
		})
		// 两个脚本互不依赖，并行拉取可省掉一段串行等待
		Promise.all([load(SPINE_RUNTIME_SRC), load(SPINE_BINARY_SRC)])
			.then(() => {
				if (!win.spine)
					throw new Error('spine 运行时未就绪')
				resolve(win.spine)
			})
			.catch((err) => {
				spineLoading = null
				reject(err)
			})
	})
	return spineLoading
}

export interface SpineInfo {
	version: string
	bones: number
	slots: number
	skins: number
	animations: string[]
	width: number
	height: number
}

export interface SpineViewerOptions {
	/** 是否自启动 requestAnimationFrame 循环（离屏截图传 false） */
	loop?: boolean
	/** toDataURL 截图需要开启 */
	preserveDrawingBuffer?: boolean
	/** 固定画布像素尺寸（离屏渲染用，不做自适应与事件绑定） */
	viewport?: { width: number, height: number }
}

export class SpineViewer {
	private spine: any
	private gl: WebGLRenderingContext
	private shader: any
	private batcher: any
	private renderer: any
	private shape: any
	private shapeShader: any
	private mvp: any
	private skeleton: any = null
	private state: any = null
	private skeletonData: any = null
	private raf = 0
	private lastTime = 0
	private disposed = false
	private view = { cx: 0, cy: 0, w: 100, h: 100 }
	private dragging = false
	private lastPointer = { x: 0, y: 0 }
	private observer: ResizeObserver | null = null
	private intersection: IntersectionObserver | null = null
	private resizeRaf = 0
	/** 上一次同步时的 CSS 盒尺寸（布局像素） */
	private box = { w: 0, h: 0 }
	/** 尺寸自检的帧计数：每 4 帧（≈66ms）核一次，比定时器更跟手 */
	private tick = 0
	/** devicePixelRatio 变化监听（浏览器缩放 / 拖到不同 DPI 屏幕） */
	private dprMedia: MediaQueryList | null = null
	/** WebGL 上下文是否丢失（DevTools / 显卡驱动切换时可能发生） */
	private contextLost = false
	/** 最近一次载入的模型数据：上下文恢复后用于重建 */
	private lastPayload: { json: any, atlasText: string, textures: Map<string, HTMLImageElement> } | null = null
	/** 布局稳定后的二次校准定时器 */
	private settledTimers: number[] = []
	private atlas: any = null
	/** fit() 得到的模型基准尺寸（尚未按画布宽高比补足） */
	private base = { w: 100, h: 100 }
	private visible = true

	zoom = 1
	flipX = false
	showBones = false
	premultipliedAlpha = true
	playing = true
	speed = 1

	constructor(canvas: HTMLCanvasElement, spine: any, options: SpineViewerOptions = {}) {
		this.spine = spine
		const gl = canvas.getContext('webgl', {
			alpha: true,
			antialias: true,
			premultipliedAlpha: true,
			preserveDrawingBuffer: Boolean(options.preserveDrawingBuffer),
		}) as WebGLRenderingContext | null
		if (!gl)
			throw new Error('当前浏览器不支持 WebGL')
		this.gl = gl
		this.initGL()

		if (options.viewport) {
			canvas.width = options.viewport.width
			canvas.height = options.viewport.height
			gl.viewport(0, 0, canvas.width, canvas.height)
		}
		else {
			this.syncBox(canvas, true)
			this.bindEvents(canvas)
			// 观察画布自身的 CSS 盒：DevTools 停靠、侧栏折叠、窗口缩放都能第一时间跟上
			this.observer = new ResizeObserver(() => {
				this.scheduleResize(canvas)
			})
			this.observer.observe(canvas)
			this.observer.observe(canvas.parentElement ?? canvas)
			this.intersection = new IntersectionObserver((entries) => {
				this.visible = entries.some(entry => entry.isIntersecting)
				if (this.visible)
					this.scheduleResize(canvas)
			}, { rootMargin: '160px' })
			this.intersection.observe(canvas)
			// 根节点也观察：DevTools 停靠、滚动条出现/消失都会改根盒子，但 canvas 回调可能被合并
			if (document.documentElement)
				this.observer.observe(document.documentElement)
			canvas.addEventListener('webglcontextlost', this.handleContextLost)
			canvas.addEventListener('webglcontextrestored', this.handleContextRestored)
			window.addEventListener('resize', this.handleWindowResize, { passive: true })
			window.addEventListener('orientationchange', this.handleWindowResize, { passive: true })
			// DevTools 停靠/收起时 window.resize 不一定触发，视觉视口的回调更可靠
			window.visualViewport?.addEventListener('resize', this.handleWindowResize, { passive: true })
			window.visualViewport?.addEventListener('scroll', this.handleWindowResize, { passive: true })
			document.addEventListener('fullscreenchange', this.handleWindowResize)
			document.addEventListener('visibilitychange', this.handleVisibilityChange)
			this.watchDpr()
		}

		if (options.loop !== false) {
			this.lastTime = performance.now()
			this.loop()
		}
	}

	/** 推进并渲染一帧（delta=0 表示只应用当前状态，用于离屏截图） */
	step(delta = 0) {
		if (!this.skeleton)
			return
		if (this.state) {
			if (delta > 0) {
				this.state.timeScale = this.speed
				this.state.update(delta)
			}
			this.state.apply(this.skeleton)
		}
		this.skeleton.scaleX = this.flipX ? -1 : 1
		this.skeleton.updateWorldTransform()
		this.render()
	}

	/**
	 * 重建 GL 资源（WebGL 上下文丢失后恢复时需要重新创建着色器与批处理器）
	 */
	private initGL() {
		const gl = this.gl
		const spine = this.spine
		gl.clearColor(0, 0, 0, 0)
		this.shader = spine.webgl.Shader.newColoredTextured(gl)
		this.shapeShader = spine.webgl.Shader.newColored(gl)
		this.batcher = new spine.webgl.PolygonBatcher(gl)
		this.renderer = new spine.webgl.SkeletonRenderer(gl)
		this.shape = new spine.webgl.ShapeRenderer(gl)
		this.mvp = new spine.webgl.Matrix4()
	}

	/**
	 * 同步画布尺寸 —— 整个预览器唯一改尺寸的地方。
	 *
	 * 取值原则：**CSS 盒（clientWidth/clientHeight）是唯一真相来源**。
	 * 缓冲尺寸 = CSS 盒 × DPR，于是「缓冲宽高比」与「CSS 盒宽高比」天生相等，
	 * 浏览器把缓冲贴回 CSS 盒时不会有任何拉伸，模型比例也就永远稳定。
	 *
	 * 旧实现用 getBoundingClientRect 推导缓冲，祖先 transform / 页面缩放
	 * 会让「缓冲一套比例、CSS 盒另一套比例」，DevTools 停靠时就会出现
	 * 「高度被压扁」与「退出后被拉长」两种失真。
	 */
	private syncBox(canvas: HTMLCanvasElement, force = false) {
		const cw = canvas.clientWidth
		const ch = canvas.clientHeight
		// 折叠 / 隐藏时保留上一帧尺寸，等布局稳定后再同步，避免出现 0 尺寸缓冲
		if (cw < 2 || ch < 2)
			return false
		const dpr = Math.min(window.devicePixelRatio || 1, 2)
		// 祖先 transform 的缩放系数：只有横纵一致时才补偿，保证缓冲比例不变
		const rect = canvas.getBoundingClientRect()
		const sx = rect.width / cw
		const sy = rect.height / ch
		const scale = Math.abs(sx - sy) < 0.02 ? Math.min(Math.max(sx, 1), 2) : 1
		const w = Math.max(1, Math.round(cw * dpr * scale))
		const h = Math.max(1, Math.round(ch * dpr * scale))
		if (!force
			&& canvas.width === w
			&& canvas.height === h
			&& Math.abs(this.box.w - cw) < 0.5
			&& Math.abs(this.box.h - ch) < 0.5) {
			return false
		}
		canvas.width = w
		canvas.height = h
		this.gl.viewport(0, 0, w, h)
		this.box = { w: cw, h: ch }
		this.applyAspect()
		return true
	}

	/** dpr 变化（缩放页面 / 换屏）时重新对齐缓冲，并重挂监听 */
	private watchDpr() {
		const dpr = window.devicePixelRatio || 1
		try {
			this.dprMedia?.removeEventListener('change', this.handleWindowResize)
			this.dprMedia = window.matchMedia(`(resolution: ${dpr}dppx)`)
			this.dprMedia.addEventListener('change', this.handleWindowResize)
		}
		catch { /* 老浏览器没有 matchMedia change，靠每帧自检 */ }
	}

	private handleWindowResize = () => {
		const canvas = this.gl.canvas as HTMLCanvasElement
		if (!canvas)
			return
		this.scheduleResize(canvas)
		// 连续两帧再核一次：DevTools 停靠/CSS 过渡时，回调可能早于最终布局
		requestAnimationFrame(() => this.scheduleResize(canvas))
	}

	private handleVisibilityChange = () => {
		if (!document.hidden) {
			this.lastTime = performance.now()
			this.refresh()
		}
	}

	/** 合并同一帧内的多次尺寸回调 */
	private scheduleResize(canvas: HTMLCanvasElement) {
		if (this.resizeRaf)
			cancelAnimationFrame(this.resizeRaf)
		this.resizeRaf = requestAnimationFrame(() => {
			this.resizeRaf = 0
			if (this.disposed)
				return
			this.syncBox(canvas)
			// 布局往往在 resize 之后才稳定（字体回流、CSS 过渡、DevTools 面板收起动画），
			// 延后再校一次，避免停留在中间态比例上
			this.scheduleSettledSync(canvas)
		})
	}

	/** 布局稳定后的二次校准（120ms / 320ms 两拍） */
	private scheduleSettledSync(canvas: HTMLCanvasElement) {
		if (this.settledTimers.length)
			return
		const timers = [120, 320].map(delay => window.setTimeout(() => {
			if (!this.disposed)
				this.syncBox(canvas, true)
		}, delay))
		this.settledTimers.push(...timers)
		window.setTimeout(() => {
			for (const timer of timers) {
				window.clearTimeout(timer)
				const index = this.settledTimers.indexOf(timer)
				if (index >= 0)
					this.settledTimers.splice(index, 1)
			}
		}, 400)
	}

	/** 按画布宽高比补足可视范围：只改视口尺寸，不动缩放与中心 */
	private applyAspect() {
		const canvas = this.gl.canvas as HTMLCanvasElement
		if (!canvas)
			return
		// 用缓冲比例（与 CSS 盒比例一致）补足可视范围，画面永远不被拉伸
		const aspect = canvas.width / Math.max(1, canvas.height)
		let { w, h } = this.base
		if (!(w > 0) || !(h > 0))
			return
		if (w / h < aspect)
			w = h * aspect
		else
			h = w / aspect
		this.view.w = w
		this.view.h = h
	}

	private bindEvents(canvas: HTMLCanvasElement) {
		canvas.addEventListener('wheel', (e) => {
			e.preventDefault()
			const next = this.zoom * Math.exp(-e.deltaY * 0.0015)
			this.zoom = Math.min(20, Math.max(0.05, next))
		}, { passive: false })

		canvas.addEventListener('pointerdown', (e) => {
			this.dragging = true
			this.lastPointer = { x: e.clientX, y: e.clientY }
			canvas.setPointerCapture(e.pointerId)
		})
		canvas.addEventListener('pointermove', (e) => {
			if (!this.dragging)
				return
			const cw = canvas.clientWidth || 1
			const chh = canvas.clientHeight || 1
			const dx = e.clientX - this.lastPointer.x
			const dy = e.clientY - this.lastPointer.y
			this.lastPointer = { x: e.clientX, y: e.clientY }
			this.view.cx -= (dx / cw) * (this.view.w / this.zoom) * (this.flipX ? -1 : 1)
			this.view.cy += (dy / chh) * (this.view.h / this.zoom)
		})
		const end = (e: PointerEvent) => {
			this.dragging = false
			try {
				canvas.releasePointerCapture(e.pointerId)
			}
			catch { /* 忽略 */ }
		}
		canvas.addEventListener('pointerup', end)
		canvas.addEventListener('pointercancel', end)
	}

	/** 加载骨架：skeletonJson 为 3.5 JSON（.skel 先经 Spine35Binary 转换），atlasText 为图集文本，textures 为页名 → 已解码图片 */
	load(skeletonJson: any, atlasText: string, textures: Map<string, HTMLImageElement>): SpineInfo {
		const spine = this.spine
		const gl = this.gl
		// 备份一份，WebGL 上下文丢失后可以原样重建
		this.lastPayload = { json: skeletonJson, atlasText, textures }

		// 重新加载时先释放上一份图集（gl 贴图），避免反复切换模型导致显存堆积
		try {
			this.atlas?.dispose?.()
		}
		catch { /* 忽略 */ }
		this.atlas = null

		const atlas = new spine.TextureAtlas(atlasText, (pageName: string) => {
			const image = textures.get(pageName)
			if (!image)
				throw new Error(`图集缺少贴图：${pageName}`)
			return new spine.webgl.GLTexture(gl, image)
		})

		this.atlas = atlas
		const jsonReader = new spine.SkeletonJson(new spine.AtlasAttachmentLoader(atlas))
		this.skeletonData = jsonReader.readSkeletonData(skeletonJson)
		this.skeleton = new spine.Skeleton(this.skeletonData)
		const stateData = new spine.AnimationStateData(this.skeletonData)
		stateData.defaultMix = 0.2
		this.state = new spine.AnimationState(stateData)

		this.skeleton.setToSetupPose()
		this.skeleton.updateWorldTransform()
		this.fit()

		const width = Number(this.skeletonData.width)
		const height = Number(this.skeletonData.height)
		const sane = (v: number) => (Number.isFinite(v) && v > 0 && v < 1e7 ? Math.round(v) : 0)

		return {
			version: String(this.skeletonData.version || skeletonJson?.skeleton?.spine || '未知'),
			bones: this.skeletonData.bones.length,
			slots: this.skeletonData.slots.length,
			skins: this.skeletonData.skins.length,
			animations: this.skeletonData.animations.map((a: any) => a.name),
			width: sane(width),
			height: sane(height),
		}
	}

	/** 是否已加载模型 */
	get hasModel() {
		return Boolean(this.skeleton)
	}

	/** 手动校正尺寸与视口比例（例如从全屏切换回来） */
	refresh() {
		if (this.disposed)
			return
		const canvas = this.gl.canvas as HTMLCanvasElement
		this.syncBox(canvas, true)
		this.applyAspect()
	}

	/** 清空渲染内容 */
	clear() {
		this.skeleton = null
		this.state = null
		this.skeletonData = null
		this.gl.clear(this.gl.COLOR_BUFFER_BIT)
	}

	/** 播放指定动画；空字符串 = Setup Pose */
	play(name: string) {
		if (!this.state || !this.skeleton)
			return
		if (!name) {
			this.state.clearTracks()
			this.skeleton.setToSetupPose()
			this.skeleton.updateWorldTransform()
			return
		}
		this.state.setAnimation(0, name, true)
		this.state.timeScale = this.speed
	}

	/** 重置视角：采样整段动画求包围盒，自适应居中 */
	fit() {
		if (!this.skeleton || !this.skeletonData)
			return
		this.syncBox(this.gl.canvas as HTMLCanvasElement, true)
		const box = this.measureBounds()
		const pad = 1.12
		let w = (box.maxX - box.minX) * pad
		let h = (box.maxY - box.minY) * pad
		if (!(w > 0) || !(h > 0)) {
			w = 100
			h = 100
		}
		// 记住模型本身的尺寸，之后窗口怎么变都只补视口比例，不改变主体大小
		this.base = { w, h }
		this.view.cx = (box.minX + box.maxX) / 2
		this.view.cy = (box.minY + box.maxY) / 2
		this.zoom = 1
		this.applyAspect()
	}

	/**
	 * 用独立骨架/状态采样动画包围盒
	 * （游戏导出的 3.5 资源常把尺寸写成脏数据，且 Setup Pose 下附件为空，
	 *  因此按动画轨迹采样比 skeleton.getBounds 单帧更可靠）
	 */
	private measureBounds() {
		const spine = this.spine
		const empty = { minX: 0, minY: 0, maxX: 0, maxY: 0 }
		if (!this.skeletonData)
			return empty
		try {
			const sampleSkeleton = new spine.Skeleton(this.skeletonData)
			const sampleState = new spine.AnimationState(new spine.AnimationStateData(this.skeletonData))
			const first = this.skeletonData.animations[0]
			if (first)
				sampleState.setAnimation(0, first.name, true)

			const offset = new spine.Vector2()
			const size = new spine.Vector2()
			const acc = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
			const steps = 12
			const duration = first ? Math.max(0.2, Math.min(3, first.duration || 1)) : 0.2
			const dt = duration / steps
			for (let i = 0; i < steps; i++) {
				sampleState.update(dt)
				sampleState.apply(sampleSkeleton)
				sampleSkeleton.updateWorldTransform()
				sampleSkeleton.getBounds(offset, size)
				if (size.x > 0 && size.y > 0) {
					acc.minX = Math.min(acc.minX, offset.x)
					acc.minY = Math.min(acc.minY, offset.y)
					acc.maxX = Math.max(acc.maxX, offset.x + size.x)
					acc.maxY = Math.max(acc.maxY, offset.y + size.y)
				}
			}
			// 兜底：附件为空时用骨骼位置估算
			if (!Number.isFinite(acc.minX)) {
				const bones = sampleSkeleton.bones
				for (let i = 0; i < bones.length; i++) {
					acc.minX = Math.min(acc.minX, bones[i].worldX)
					acc.minY = Math.min(acc.minY, bones[i].worldY)
					acc.maxX = Math.max(acc.maxX, bones[i].worldX)
					acc.maxY = Math.max(acc.maxY, bones[i].worldY)
				}
			}
			if (!Number.isFinite(acc.minX))
				return empty
			// 骨骼点没有厚度，给一点余量
			if (acc.maxX - acc.minX < 1e-3)
				acc.maxX = acc.minX + 1
			if (acc.maxY - acc.minY < 1e-3)
				acc.maxY = acc.minY + 1
			return acc
		}
		catch {
			return empty
		}
	}

	private loop = () => {
		if (this.disposed)
			return
		const now = performance.now()
		const delta = Math.min(0.1, (now - this.lastTime) / 1000)
		this.lastTime = now

		if (this.visible && !document.hidden && !this.contextLost)
			this.step(this.playing ? delta : 0)

		// 每 4 帧（≈66ms）核对一次尺寸：DevTools 停靠、缩放、字体回流都在一帧内纠正
		if ((this.tick++ & 3) === 0)
			this.syncBox(this.gl.canvas as HTMLCanvasElement)
		this.raf = requestAnimationFrame(this.loop)
	}

	private render() {
		const gl = this.gl
		const canvas = gl.canvas as HTMLCanvasElement

		// 自愈：CSS 盒与像素缓冲比例不一致时立即重建缓冲。
		// 只要缓冲比例 == CSS 盒比例，浏览器贴图时就不可能产生任何拉伸，
		// DevTools 停靠 / 收起 / 缩放期间也不会出现「压扁 / 拉长」。
		const cw = canvas.clientWidth
		const ch = canvas.clientHeight
		if (cw > 2 && ch > 2) {
			const cssAspect = cw / ch
			const bufAspect = canvas.width / Math.max(1, canvas.height)
			if (Math.abs(cssAspect - bufAspect) > 0.002)
				this.syncBox(canvas, true)
		}

		// 兜底：缓冲比例与视口比例不一致时立刻纠正，避免整帧被单向拉伸
		const bufferAspect = canvas.width / Math.max(1, canvas.height)
		const viewAspect = this.view.w / Math.max(1e-6, this.view.h)
		if (Math.abs(bufferAspect - viewAspect) > 0.005)
			this.applyAspect()
		gl.clear(gl.COLOR_BUFFER_BIT)

		const vw = this.view.w / this.zoom
		const vh = this.view.h / this.zoom
		this.mvp.ortho2d(this.view.cx - vw / 2, this.view.cy - vh / 2, vw, vh)

		if (this.skeleton) {
			this.renderer.premultipliedAlpha = this.premultipliedAlpha
			this.batcher.srcBlend = this.premultipliedAlpha ? gl.ONE : gl.SRC_ALPHA
			this.batcher.dstBlend = gl.ONE_MINUS_SRC_ALPHA

			this.shader.bind()
			this.shader.setUniformi(this.spine.webgl.Shader.SAMPLER, 0)
			this.shader.setUniform4x4f(this.spine.webgl.Shader.MVP_MATRIX, this.mvp.values)
			this.batcher.begin(this.shader)
			this.renderer.draw(this.batcher, this.skeleton)
			this.batcher.end()

			if (this.showBones)
				this.renderBones(vw, vh)
		}
	}

	/** WebGL 上下文丢失：暂停渲染，等待浏览器恢复 */
	private handleContextLost = (event: Event) => {
		event.preventDefault()
		this.contextLost = true
	}

	/** WebGL 上下文恢复：重建 GL 资源并把模型重新载入 */
	private handleContextRestored = () => {
		this.contextLost = false
		try {
			this.initGL()
			const payload = this.lastPayload
			if (payload) {
				this.load(payload.json, payload.atlasText, payload.textures)
				this.fit()
			}
		}
		catch { /* 恢复失败时保持静默，避免打断阅读 */ }
	}

	/** 骨架线框（Bone 连线 + 关节点） */
	private renderBones(vw: number, vh: number) {
		const spine = this.spine
		const bones = this.skeleton.bones
		const radius = Math.max(vw, vh) * 0.004
		const lineColor = new spine.Color(1, 0.36, 0.36, 0.9)
		const jointColor = new spine.Color(0.2, 0.85, 1, 0.9)

		this.shapeShader.bind()
		this.shapeShader.setUniform4x4f(spine.webgl.Shader.MVP_MATRIX, this.mvp.values)
		this.shape.begin(this.shapeShader)
		for (let i = 0; i < bones.length; i++) {
			const bone = bones[i]
			if (bone.parent)
				this.shape.line(bone.parent.worldX, bone.parent.worldY, bone.worldX, bone.worldY, lineColor)
			this.shape.circle(false, bone.worldX, bone.worldY, radius, jointColor, 12)
		}
		this.shape.end()
		// 恢复默认混合（下一帧会重新设置）
		this.batcher.srcBlend = this.premultipliedAlpha ? this.gl.ONE : this.gl.SRC_ALPHA
	}

	dispose() {
		this.disposed = true
		cancelAnimationFrame(this.raf)
		if (this.resizeRaf)
			cancelAnimationFrame(this.resizeRaf)
		for (const timer of this.settledTimers)
			window.clearTimeout(timer)
		this.settledTimers = []
		this.observer?.disconnect()
		this.observer = null
		this.intersection?.disconnect()
		this.intersection = null
		window.removeEventListener('resize', this.handleWindowResize)
		window.removeEventListener('orientationchange', this.handleWindowResize)
		window.visualViewport?.removeEventListener('resize', this.handleWindowResize)
		window.visualViewport?.removeEventListener('scroll', this.handleWindowResize)
		document.removeEventListener('fullscreenchange', this.handleWindowResize)
		document.removeEventListener('visibilitychange', this.handleVisibilityChange)
		this.dprMedia?.removeEventListener('change', this.handleWindowResize)
		this.dprMedia = null
		const canvas = this.gl.canvas as HTMLCanvasElement | null
		canvas?.removeEventListener('webglcontextlost', this.handleContextLost)
		canvas?.removeEventListener('webglcontextrestored', this.handleContextRestored)
		this.lastPayload = null
		try {
			this.atlas?.dispose?.()
		}
		catch { /* 忽略 */ }
		this.atlas = null
	}
}
