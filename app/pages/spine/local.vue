<!--
  /spine 路由 — Spine 模型预览

  支持 Spine 3.5.x 数据（与 Skeleton Viewer 3.5.51 同源的二进制 .skel 解析）：
  - 运行时：public/vendor/spine35/spine-webgl.js（官方 3.5.51 build）
  - 二进制解析：public/vendor/spine35/spine35-skel.js（按 SkeletonBinary.java 移植）
  - 使用：拖入 骨架(.skel/.json) + 图集(.atlas) + 贴图(png/jpg/webp)，自动匹配并渲染
-->
<script setup lang="ts">
import type { SpineInfo } from '~/composables/useSpineViewer'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { loadSpine35Runtime, SpineViewer } from '~/composables/useSpineViewer'

useSeoMeta({
	title: '模型预览',
	description: 'Spine 3.5 骨架模型预览：支持 .skel 二进制与 .json，可在浏览器内查看动作与骨骼。',
})

const layoutStore = useLayoutStore()
layoutStore.setAside(['blog-stats', 'blog-tech', 'blog-log'])

const IMAGE_EXT_RE = /\.(?:png|jpe?g|webp|avif)$/i
const ATLAS_RE = /\.atlas(?:\.txt)?$/i
const SKEL_RE = /\.skel$/i
const JSON_RE = /\.json$/i
/** 去掉常见骨架 / 图集 / 贴图扩展名，得到可比较的主名 */
const TRAILING_EXT_RE = /\.(?:skel|json|atlas(?:\.txt)?|png|jpe?g|webp|avif)$/i
const BACKSLASH_RE = /\\/g
const ATLAS_NEWLINE_RE = /\r?\n/
const ATLAS_PAGE_RE = /^size\s*:/
/** 图集属性行（xy: / size: / index: 等）不是贴图页名 */
const ATLAS_ATTR_RE = /:/

interface PickedFile {
	name: string
	size: number
	file: File
}

const canvasRef = ref<HTMLCanvasElement | null>(null)
const inputRef = ref<HTMLInputElement | null>(null)
const picked = ref<PickedFile[]>([])
const dragOver = ref(false)
const loading = ref(false)
const errorMsg = ref('')
const ready = ref(false)

const animations = ref<string[]>([])
const animation = ref('')
const playing = ref(true)
const speed = ref(1)
const zoomPercent = ref(100)
const flipX = ref(false)
const showBones = ref(false)
const premultiplied = ref(true)
const background = ref<'dark' | 'light' | 'grid'>('dark')
const info = ref<(SpineInfo & { name: string }) | null>(null)

let viewer: SpineViewer | null = null

/* ── 文件分类与命名 ── */
const hasSkeleton = computed(() => picked.value.some(f => SKEL_RE.test(f.name) || JSON_RE.test(f.name)))
const hasAtlas = computed(() => picked.value.some(f => ATLAS_RE.test(f.name)))
const textureCount = computed(() => picked.value.filter(f => IMAGE_EXT_RE.test(f.name)).length)
const canBuild = computed(() => hasSkeleton.value && hasAtlas.value && textureCount.value > 0)

function baseName(name: string) {
	return name
		.replace(BACKSLASH_RE, '/')
		.split('/')
		.pop()!
		.replace(TRAILING_EXT_RE, '')
}

function fileKind(name: string) {
	if (SKEL_RE.test(name) || JSON_RE.test(name))
		return 'is-skeleton'
	if (ATLAS_RE.test(name))
		return 'is-atlas'
	return 'is-texture'
}

function formatSize(size: number) {
	if (size >= 1024 * 1024)
		return `${(size / 1024 / 1024).toFixed(1)} MB`
	if (size >= 1024)
		return `${(size / 1024).toFixed(0)} KB`
	return `${size} B`
}

/* ── 选择文件 ── */
function addFiles(list: File[]) {
	const next = picked.value.slice()
	for (const file of list) {
		const name = file.name
		if (!next.some(f => f.name === name))
			next.push({ name, size: file.size, file })
	}
	picked.value = next
	if (canBuild.value)
		void build()
}

function onInputChange(e: Event) {
	const input = e.target as HTMLInputElement
	if (input.files?.length)
		addFiles([...input.files])
	input.value = ''
}

function onDrop(e: DragEvent) {
	dragOver.value = false
	const files = [...(e.dataTransfer?.files ?? [])]
	if (files.length)
		addFiles(files)
}

function removeFile(name: string) {
	picked.value = picked.value.filter(f => f.name !== name)
	onFilesChanged()
}

function clearAll() {
	picked.value = []
	ready.value = false
	info.value = null
	animations.value = []
	animation.value = ''
	errorMsg.value = ''
	viewer?.clear()
}

/** 移除单个文件时，旧模型不再可信 → 清空画布 */
function onFilesChanged() {
	if (!canBuild.value) {
		ready.value = false
		info.value = null
		animations.value = []
		animation.value = ''
		viewer?.clear()
	}
}

/* ── 图集贴图匹配 ── */
/** 图集贴图页名：区块起始（前一行空行）+ 下一行是 size: + 本行不含冒号（排除 xy: 等属性行） */
function parseAtlasPages(atlasText: string): string[] {
	const lines = atlasText.split(ATLAS_NEWLINE_RE)
	const pages: string[] = []
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim()
		if (!line || ATLAS_ATTR_RE.test(line))
			continue
		const prevBlank = i === 0 || !lines[i - 1].trim()
		const nextIsSize = ATLAS_PAGE_RE.test((lines[i + 1] ?? '').trim())
		if (prevBlank && nextIsSize)
			pages.push(line)
	}
	return pages
}

function findTextureFile(pageName: string): PickedFile | undefined {
	const images = picked.value.filter(f => IMAGE_EXT_RE.test(f.name))
	const target = baseName(pageName).toLowerCase()
	return images.find(f => f.name.toLowerCase() === pageName.toLowerCase())
		?? images.find(f => baseName(f.name).toLowerCase() === target)
		?? (images.length === 1 ? images[0] : undefined)
}

function loadImage(file: File): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const url = URL.createObjectURL(file)
		const img = new Image()
		img.onload = () => {
			URL.revokeObjectURL(url)
			resolve(img)
		}
		img.onerror = () => {
			URL.revokeObjectURL(url)
			reject(new Error(`贴图加载失败：${file.name}`))
		}
		img.src = url
	})
}

/* ── 构建预览 ── */
function pickSkeletonAndAtlas() {
	const atlases = picked.value.filter(f => ATLAS_RE.test(f.name))
	const skeletons = picked.value.filter(f => SKEL_RE.test(f.name) || JSON_RE.test(f.name))
	const atlas = atlases.find(a => skeletons.some(s => baseName(s.name) === baseName(a.name))) ?? atlases[0]
	const skeleton = skeletons.find(s => baseName(s.name) === baseName(atlas.name)) ?? skeletons[0]
	return { atlas, skeleton }
}

async function build() {
	if (!canBuild.value || !canvasRef.value)
		return
	loading.value = true
	errorMsg.value = ''
	try {
		const spine = await loadSpine35Runtime()
		if (!viewer)
			viewer = new SpineViewer(canvasRef.value, spine)

		const { atlas, skeleton } = pickSkeletonAndAtlas()
		const atlasText = await atlas.file.text()

		let json: any
		if (SKEL_RE.test(skeleton.name)) {
			const buffer = await skeleton.file.arrayBuffer()
			json = (window as any).Spine35Binary.toJson(buffer)
		}
		else {
			json = JSON.parse(await skeleton.file.text())
		}

		const pages = parseAtlasPages(atlasText)
		if (!pages.length)
			throw new Error('未能从 .atlas 中解析出贴图页')
		const textures = new Map<string, HTMLImageElement>()
		for (const page of pages) {
			const textureFile = findTextureFile(page)
			if (!textureFile)
				throw new Error(`缺少贴图：${page}`)
			textures.set(page, await loadImage(textureFile.file))
		}

		const meta = viewer.load(json, atlasText, textures)
		animations.value = meta.animations
		animation.value = meta.animations[0] ?? ''
		viewer.flipX = flipX.value
		viewer.showBones = showBones.value
		viewer.premultipliedAlpha = premultiplied.value
		viewer.playing = playing.value
		viewer.speed = speed.value
		viewer.play(animation.value)
		viewer.fit()
		viewer.zoom = zoomPercent.value / 100

		info.value = { ...meta, name: skeleton.name }
		ready.value = true
	}
	catch (err) {
		errorMsg.value = err instanceof Error ? err.message : String(err)
		ready.value = viewer?.hasModel ?? false
	}
	finally {
		loading.value = false
	}
}

/* ── 控件同步 ── */
function resetView() {
	zoomPercent.value = 100
	viewer?.fit()
}

watch(animation, value => viewer?.play(value))
watch(playing, (value) => {
	if (viewer)
		viewer.playing = value
})
watch(speed, (value) => {
	if (viewer)
		viewer.speed = value
})
watch(zoomPercent, (value) => {
	if (viewer)
		viewer.zoom = value / 100
})
watch(flipX, (value) => {
	if (viewer)
		viewer.flipX = value
})
watch(showBones, (value) => {
	if (viewer)
		viewer.showBones = value
})
watch(premultiplied, (value) => {
	if (viewer)
		viewer.premultipliedAlpha = value
})

onBeforeUnmount(() => {
	viewer?.dispose()
	viewer = null
})
</script>

<template>
<div class="spine-page">
	<header class="spine-head">
		<div class="spine-head-text">
			<h1>本地模型预览</h1>
			<p>Spine 3.5 运行时 · 兼容 Skeleton Viewer 3.5.51 的 .skel 二进制 / .json 数据</p>
		</div>
		<div class="spine-head-actions">
			<UtilLink class="spine-ghost-btn" to="/spine" title="返回模型库">
				<Icon name="ph:caret-left-bold" />
				模型库
			</UtilLink>
			<button v-if="picked.length" class="spine-ghost-btn" type="button" @click="clearAll">
				<Icon name="ph:trash-bold" />
				清空
			</button>
		</div>
	</header>

	<!-- 文件选择 -->
	<section
		class="spine-picker"
		:class="{ 'is-over': dragOver }"
		@dragover.prevent="dragOver = true"
		@dragleave.prevent="dragOver = false"
		@drop.prevent="onDrop"
	>
		<input
			ref="inputRef"
			class="spine-file-input"
			type="file"
			multiple
			accept=".skel,.json,.atlas,.txt,.png,.jpg,.jpeg,.webp,.avif"
			@change="onInputChange"
		>
		<button class="spine-drop" type="button" @click="inputRef?.click()">
			<Icon name="ph:upload-simple-bold" class="spine-drop-icon" />
			<span class="spine-drop-title">拖拽文件到此处，或点击选择</span>
			<span class="spine-drop-hint">骨架 .skel / .json ＋ 图集 .atlas ＋ 贴图 png / jpg / webp（可多选）</span>
		</button>

		<ul v-if="picked.length" class="spine-files">
			<li v-for="file in picked" :key="file.name" class="spine-file" :class="fileKind(file.name)">
				<span class="spine-file-name">{{ file.name }}</span>
				<span class="spine-file-size">{{ formatSize(file.size) }}</span>
				<button class="spine-file-remove" type="button" :title="`移除 ${file.name}`" @click.stop="removeFile(file.name)">
					<Icon name="ph:x-bold" />
				</button>
			</li>
		</ul>
	</section>

	<!-- 控制栏 -->
	<div class="spine-controls" :class="{ 'is-disabled': !ready }">
		<label class="spine-field">
			<span class="spine-field-label">动画</span>
			<select v-model="animation" class="spine-select">
				<option value="">Setup Pose</option>
				<option v-for="name in animations" :key="name" :value="name">{{ name }}</option>
			</select>
		</label>

		<button class="spine-btn" type="button" @click="playing = !playing">
			<Icon :name="playing ? 'ph:pause-bold' : 'ph:play-bold'" />
			{{ playing ? '暂停' : '播放' }}
		</button>

		<label class="spine-field is-range">
			<span class="spine-field-label">速度 {{ speed.toFixed(1) }}×</span>
			<input v-model.number="speed" type="range" min="0.1" max="3" step="0.1" class="spine-range">
		</label>

		<label class="spine-field is-range">
			<span class="spine-field-label">缩放 {{ zoomPercent }}%</span>
			<input v-model.number="zoomPercent" type="range" min="10" max="400" step="5" class="spine-range">
		</label>

		<button class="spine-btn" type="button" @click="resetView">
			<Icon name="ph:arrows-out-line-vertical-bold" />
			适配
		</button>

		<label class="spine-toggle">
			<input v-model="flipX" type="checkbox">
			<span>水平翻转</span>
		</label>
		<label class="spine-toggle">
			<input v-model="showBones" type="checkbox">
			<span>骨骼线框</span>
		</label>
		<label class="spine-toggle">
			<input v-model="premultiplied" type="checkbox">
			<span>预乘 Alpha</span>
		</label>

		<div class="spine-bg">
			<button
				v-for="item in (['dark', 'light', 'grid'] as const)"
				:key="item"
				class="spine-bg-dot"
				:class="[`is-${item}`, { 'is-active': background === item }]"
				type="button"
				:title="item === 'dark' ? '深色背景' : item === 'light' ? '浅色背景' : '棋盘背景'"
				@click="background = item"
			/>
		</div>
	</div>

	<!-- 画布 -->
	<section class="spine-stage" :class="`is-${background}`">
		<canvas ref="canvasRef" class="spine-canvas" />

		<div v-if="!ready" class="spine-placeholder">
			<Icon name="ph:cube-bold" class="spine-placeholder-icon" />
			<p class="spine-placeholder-title">
				{{ canBuild ? '点击「渲染」开始' : '等待骨架 / 图集 / 贴图' }}
			</p>
			<p class="spine-placeholder-hint">
				文件齐备后会自动渲染；滚轮缩放、拖拽平移
			</p>
			<button v-if="canBuild" class="spine-btn is-primary" type="button" :disabled="loading" @click="build()">
				<Icon name="ph:play-circle-bold" />
				{{ loading ? '解析中…' : '渲染' }}
			</button>
		</div>

		<div v-if="loading" class="spine-loading">
			<Icon name="ph:spinner-gap-bold" class="spine-spin" />
			正在解析骨架…
		</div>

		<transition name="spine-fade">
			<p v-if="errorMsg" class="spine-error">
				<Icon name="ph:warning-circle-bold" />
				{{ errorMsg }}
			</p>
		</transition>
	</section>

	<!-- 信息 -->
	<div v-if="info" class="spine-meta">
		<span class="spine-meta-item is-strong">{{ info.name }}</span>
		<span class="spine-meta-item">Spine {{ info.version }}</span>
		<span class="spine-meta-item">{{ info.bones }} 骨骼</span>
		<span class="spine-meta-item">{{ info.slots }} 槽位</span>
		<span class="spine-meta-item">{{ info.skins }} 皮肤</span>
		<span class="spine-meta-item">{{ info.animations.length }} 动作</span>
		<span v-if="info.width && info.height" class="spine-meta-item">{{ info.width }} × {{ info.height }}</span>
	</div>
</div>
</template>

<style lang="scss" scoped>
.spine-page {
	display: flex;
	flex-direction: column;
	gap: 0.85rem;
	min-width: 0;
	margin: 1rem;
}

/* ── 头部 ── */
.spine-head {
	display: flex;
	align-items: flex-end;
	justify-content: space-between;
	gap: 1rem;

	h1 {
		margin: 0;
		font-size: 1.5rem;
		font-weight: 700;
	}

	p {
		margin: 0.3rem 0 0;
		font-size: 0.82rem;
		color: var(--c-text-3);
	}
}

.spine-head-actions {
	display: inline-flex;
	flex: none;
	align-items: center;
	gap: 0.5rem;
}

/* ── 文件选择 ── */
.spine-picker {
	display: flex;
	flex-direction: column;
	gap: 0.6rem;
	padding: 0.75rem;
	border: 1px solid var(--c-border);
	border-radius: 0.6rem;
	background: var(--c-bg-1);
	transition: border-color 0.2s ease, background 0.2s ease;

	&.is-over {
		border-color: var(--c-primary);
		background: var(--c-primary-soft);
	}
}

.spine-file-input {
	display: none;
}

.spine-drop {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 0.35rem;
	padding: 1.4rem 1rem;
	border: 1px dashed var(--c-border);
	border-radius: 0.5rem;
	background: var(--c-bg-2);
	color: var(--c-text-2);
	transition: border-color 0.2s ease, color 0.2s ease;
	cursor: pointer;

	&:hover {
		border-color: var(--c-primary);
		color: var(--c-primary);
	}
}

.spine-drop-icon {
	font-size: 1.6rem;
}

.spine-drop-title {
	font-size: 0.92rem;
	font-weight: 600;
}

.spine-drop-hint {
	font-size: 0.75rem;
	color: var(--c-text-3);
}

.spine-files {
	display: flex;
	flex-wrap: wrap;
	gap: 0.4rem;
	margin: 0;
	padding: 0;
	list-style: none;
}

.spine-file {
	display: flex;
	align-items: center;
	gap: 0.35rem;
	padding: 0.25rem 0.3rem 0.25rem 0.55rem;
	border: 1px solid var(--c-border);
	border-radius: 0.4rem;
	background: var(--c-bg-2);
	font-size: 0.75rem;

	&.is-skeleton {
		border-color: var(--c-primary);
		color: var(--c-primary);
	}

	&.is-atlas {
		border-color: #E2A03F;
	}
}

.spine-file-name {
	overflow: hidden;
	max-width: 16rem;
	white-space: nowrap;
	text-overflow: ellipsis;
}

.spine-file-size {
	color: var(--c-text-3);
	font-variant-numeric: tabular-nums;
}

.spine-file-remove {
	display: flex;
	padding: 0.15rem;
	border: none;
	border-radius: 0.25rem;
	background: transparent;
	font-size: 0.7rem;
	color: var(--c-text-3);
	cursor: pointer;

	&:hover {
		background: var(--c-bg-3);
		color: var(--c-error, #D55);
	}
}

/* ── 控制栏 ── */
.spine-controls {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 0.6rem 0.85rem;
	padding: 0.6rem 0.75rem;
	border: 1px solid var(--c-border);
	border-radius: 0.6rem;
	background: var(--c-bg-1);

	&.is-disabled {
		opacity: 0.55;
		pointer-events: none;
	}
}

.spine-field {
	display: flex;
	align-items: center;
	gap: 0.4rem;
	font-size: 0.78rem;
	color: var(--c-text-2);

	&.is-range .spine-range {
		width: 7rem;
	}
}

.spine-field-label {
	white-space: nowrap;
}

.spine-select {
	max-width: 12rem;
	padding: 0.25rem 1.4rem 0.25rem 0.5rem;
	border: 1px solid var(--c-border);
	border-radius: 0.4rem;
	background: var(--c-bg-2);
	font-size: 0.78rem;
	color: var(--c-text-1);
}

.spine-range {
	accent-color: var(--c-primary);
}

.spine-btn {
	display: inline-flex;
	align-items: center;
	gap: 0.3rem;
	padding: 0.3rem 0.7rem;
	border: 1px solid var(--c-border);
	border-radius: 0.4rem;
	background: var(--c-bg-2);
	font-size: 0.78rem;
	color: var(--c-text-1);
	transition: border-color 0.2s ease, color 0.2s ease;
	cursor: pointer;

	&:hover {
		border-color: var(--c-primary);
		color: var(--c-primary);
	}

	&.is-primary {
		border-color: var(--c-primary);
		background: var(--c-primary);
		color: #FFF;
	}
}

.spine-toggle {
	display: inline-flex;
	align-items: center;
	gap: 0.3rem;
	font-size: 0.78rem;
	color: var(--c-text-2);
	cursor: pointer;

	input {
		accent-color: var(--c-primary);
	}
}

.spine-ghost-btn {
	display: inline-flex;
	align-items: center;
	gap: 0.3rem;
	padding: 0.3rem 0.7rem;
	border: 1px solid var(--c-border);
	border-radius: 0.4rem;
	background: transparent;
	font-size: 0.78rem;
	white-space: nowrap;
	text-decoration: none;
	color: var(--c-text-3);
	cursor: pointer;

	&:hover {
		border-color: var(--c-error, #D55);
		color: var(--c-error, #D55);
	}
}

/* 背景色选择 */
.spine-bg {
	display: inline-flex;
	align-items: center;
	gap: 0.35rem;
	margin-left: auto;
}

.spine-bg-dot {
	width: 1.1rem;
	height: 1.1rem;
	padding: 0;
	border: 2px solid transparent;
	border-radius: 50%;
	transition: border-color 0.2s ease;
	cursor: pointer;

	&.is-dark { background: #14161A; }
	&.is-light { background: #F1F3F5; }

	&.is-grid {
		background: repeating-conic-gradient(#D8DBE0 0% 25%, #F5F6F8 0% 50%) 50% / 0.55rem 0.55rem;
	}

	&.is-active {
		border-color: var(--c-primary);
	}
}

/* ── 画布 ── */
.spine-stage {
	display: flex;
	align-items: center;
	justify-content: center;
	position: relative;
	overflow: hidden;
	height: min(68vh, 640px);
	min-height: 320px;
	border: 1px solid var(--c-border);
	border-radius: 0.6rem;

	&.is-dark { background: #14161A; }
	&.is-light { background: #F1F3F5; }

	&.is-grid {
		background: repeating-conic-gradient(#E3E6EA 0% 25%, #F7F8FA 0% 50%) 50% / 1.2rem 1.2rem;
	}
}

.spine-canvas {
	display: block;
	width: 100%;
	height: 100%;
	cursor: grab;
	touch-action: none;

	&:active {
		cursor: grabbing;
	}
}

.spine-placeholder {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 0.35rem;
	position: absolute;
	inset: 0;
	padding: 1rem;
	text-align: center;
	color: var(--c-text-3);
	pointer-events: none;

	.spine-btn {
		margin-top: 0.5rem;
		pointer-events: auto;
	}
}

.spine-placeholder-icon {
	opacity: 0.6;
	font-size: 2.6rem;
}

.spine-placeholder-title {
	margin: 0;
	font-size: 0.92rem;
	font-weight: 600;
}

.spine-placeholder-hint {
	opacity: 0.8;
	margin: 0;
	font-size: 0.75rem;
}

.spine-loading {
	display: flex;
	align-items: center;
	gap: 0.4rem;
	position: absolute;
	padding: 0.45rem 0.9rem;
	border-radius: 999px;
	background: rgb(0 0 0 / 55%);
	font-size: 0.78rem;
	color: #FFF;
}

.spine-spin {
	animation: spine-spin 1s linear infinite;
}

@keyframes spine-spin {
	to { transform: rotate(360deg); }
}

.spine-error {
	display: flex;
	align-items: center;
	gap: 0.35rem;
	position: absolute;
	bottom: 0.75rem;
	left: 50%;
	max-width: calc(100% - 1.5rem);
	margin: 0;
	padding: 0.45rem 0.9rem;
	border: 1px solid var(--c-error, #D55);
	border-radius: 0.5rem;
	background: color-mix(in oklab, var(--c-error, #D55) 12%, var(--c-bg-1));
	font-size: 0.78rem;
	color: var(--c-error, #D55);
	transform: translateX(-50%);
}

.spine-fade-enter-active,
.spine-fade-leave-active {
	transition: opacity 0.25s ease, transform 0.25s ease;
}

.spine-fade-enter-from,
.spine-fade-leave-to {
	opacity: 0;
	transform: translate(-50%, 6px);
}

/* ── 信息栏 ── */
.spine-meta {
	display: flex;
	flex-wrap: wrap;
	gap: 0.35rem 0.9rem;
	font-size: 0.76rem;
	color: var(--c-text-3);

	.is-strong {
		font-weight: 600;
		color: var(--c-text-1);
	}
}

.spine-meta-item {
	font-variant-numeric: tabular-nums;
}

@media (max-width: 768px) {
	.spine-page {
		margin: 0.6rem 0.75rem;
	}

	.spine-head h1 {
		font-size: 1.2rem;
	}

	.spine-stage {
		height: 52vh;
		min-height: 260px;
	}

	.spine-controls {
		gap: 0.5rem 0.6rem;
	}

	.spine-field.is-range .spine-range {
		width: 5rem;
	}
}
</style>
