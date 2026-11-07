import type { MaybeRefOrGetter } from 'vue'
/**
 * useSpineThumbnails — 为模型图鉴批量生成静态缩略图
 *
 * 用一个离屏 WebGL 画布按顺序渲染每个模型的首个动画姿态，
 * 逐个 toDataURL 成图片后销毁上下文，避免多画布同时占用 WebGL 上下文。
 */
import type { SpineModelAssets } from '~/utils/spineAssets'
import { onMounted, ref, toValue } from 'vue'
import { loadSpine35Runtime, SpineViewer } from '~/composables/useSpineViewer'
import { fetchSpineModel } from '~/utils/spineAssets'

export interface SpineThumbTarget {
	/** 缓存键（一般用文章 path） */
	key: string
	assets?: SpineModelAssets
}

export interface UseSpineThumbnailsOptions {
	width?: number
	height?: number
	/** 取动画第几秒作为封面姿态 */
	poseTime?: number
}

export function useSpineThumbnails(
	targets: MaybeRefOrGetter<SpineThumbTarget[]>,
	options: UseSpineThumbnailsOptions = {},
) {
	const width = options.width ?? 320
	const height = options.height ?? 420
	const poseTime = options.poseTime ?? 0.4

	const thumbs = ref<Record<string, string>>({})
	const failed = ref<Record<string, string>>({})
	const done = ref(0)
	const total = ref(0)
	let started = false

	async function renderAll() {
		if (started)
			return
		started = true
		const list = toValue(targets).filter(item => item.assets?.ModelSkel)
		total.value = list.length
		if (!list.length)
			return

		let canvas: HTMLCanvasElement | null = null
		let viewer: SpineViewer | null = null
		try {
			const spine = await loadSpine35Runtime()
			canvas = document.createElement('canvas')
			canvas.width = width
			canvas.height = height
			canvas.style.cssText = 'position:fixed;left:-10000px;top:0;width:1px;height:1px;pointer-events:none;opacity:0'
			document.body.appendChild(canvas)
			viewer = new SpineViewer(canvas, spine, {
				loop: false,
				preserveDrawingBuffer: true,
				viewport: { width, height },
			})

			for (const item of list) {
				try {
					const { json, atlasText, textures } = await fetchSpineModel(item.assets!)
					const meta = viewer.load(json, atlasText, textures)
					const animation = meta.animations[0]
					if (animation) {
						viewer.play(animation)
						viewer.step(poseTime)
					}
					else {
						viewer.step(0)
					}
					thumbs.value = { ...thumbs.value, [item.key]: canvas.toDataURL('image/png') }
				}
				catch (err) {
					failed.value = { ...failed.value, [item.key]: err instanceof Error ? err.message : String(err) }
				}
				finally {
					done.value++
				}
			}
		}
		catch (err) {
			failed.value = { ...failed.value, global: err instanceof Error ? err.message : String(err) }
		}
		finally {
			viewer?.dispose()
			canvas?.remove()
		}
	}

	onMounted(renderAll)

	return { thumbs, failed, done, total }
}
