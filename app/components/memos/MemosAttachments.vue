<!--
  MemosAttachments — Memos 附件图片渲染组件（v3 灯箱增强版）

  网格（桌面 3 列 / 移动 2 列）+ 灯箱功能：
  - 点击图片 → 灯箱打开（淡入 + 缩放动画）
  - 灯箱内：
    · 左右切换（按钮 + 键盘 ← →），多张时循环
    · 缩放：滚轮（鼠标/触控板）、双击图片切换 100%/适应、双击空白处重置
    · 工具栏：+ / − / 100% 重置 / 1:1 切换
    · 拖动平移（仅在缩放>适应 大小时可用）
  - 关闭：右上 X / 键盘 Esc / 点遮罩空白
  - 不依赖 MDC 解析，由父组件直接传入 attachments
-->
<script setup lang="ts">
import type { MemosAttachment } from '~/types/memos'
import { cacheImage, getCachedImage } from '~/utils/imageCache'

interface ImageItem {
	src: string
	alt?: string
	title?: string
}

interface Props {
	/** Memos v1 附件字段（含 filename/externalLink/type 等） */
	attachments?: MemosAttachment[]
	/** 是否允许键盘 Esc/方向键关闭/切换 */
	keyboard?: boolean
	/**
   * 呈现变体：
   * - card：带「Attachments」标题条与底色的独立图集卡片（默认）
   * - inline：无标题条、无底色，紧凑微间隙网格，贴合信息流行式排版
   */
	variant?: 'card' | 'inline'
}

const props = withDefaults(defineProps<Props>(), {
	attachments: () => [],
	keyboard: true,
	variant: 'card',
})

/* ==================== attachments → ImageItem[] ==================== */
/** 图片附件扩展名 */
const IMAGE_EXT_RE = /\.(?:jpe?g|png|gif|webp|bmp|avif|svg|heic|heif)$/i

function isImageAttachment(a: MemosAttachment): boolean {
	if (a.type?.startsWith('image/'))
		return true
	const fn = a.filename?.toLowerCase() ?? ''
	return IMAGE_EXT_RE.test(fn)
}

const imageItems = computed<ImageItem[]>(() => {
	if (!props.attachments?.length)
		return []
	return props.attachments
		.filter(isImageAttachment)
		.map((a, i) => {
			const src = a.src
				|| a.externalLink
				|| (a.content?.startsWith('data:image/') ? a.content : '')
				|| ''
			if (!src)
				return null
			return {
				src,
				title: a.filename || `图片 ${i + 1}`,
				alt: a.filename || `附件图片 ${i + 1}`,
			}
		})
		.filter((v): v is ImageItem => v !== null)
})

/* ==================== 本地缓存 ==================== */
/**
 * src → 本地缓存命中的 Blob URL
 *
 * - 同源图片（新说说系统的附件、本站资源）可直接命中，秒开且离线可用
 * - 跨域图片若服务端没有 CORS 头，fetch 会被浏览器拦下，这里会保持空值，
 *   继续走原始地址直连（HTTP 缓存兜底），不会白等一次失败请求
 */
const cachedUrls = ref<Record<string, string>>({})
/** 已经尝试过写入缓存的地址，避免重复请求 */
const cachedFilled = new Set<string>()

/** 挂载后查一次本地缓存 */
onMounted(async () => {
	for (const item of imageItems.value) {
		const hit = await getCachedImage(item.src)
		if (hit)
			cachedUrls.value = { ...cachedUrls.value, [item.src]: hit }
	}
})

/** 图片加载成功：把原图写进本地缓存（失败静默，跨域无 CORS 时自动跳过） */
async function onImgLoaded(src: string) {
	if (cachedFilled.has(src))
		return
	cachedFilled.add(src)
	void cacheImage(src).then((url) => {
		if (url)
			cachedUrls.value = { ...cachedUrls.value, [src]: url }
	}).catch(() => {})
}

/** 实际用于渲染的地址：优先本地缓存 */
function displaySrc(src: string): string {
	return cachedUrls.value[src] || src
}

/* ==================== 加载失败重试 ==================== */
/** 已重试过的地址（每张图最多重试一次，避免死循环） */
const retried = new Set<string>()
/** 重试后仍失败的地址 → 渲染兜底样式 */
const failedSrcs = ref<string[]>([])

/**
 * 图片加载失败处理：Memos 原图常有 5120px 超大壁纸，
 * 网络抖动时会偶发失败，这里带参数重试一次，仍失败则标记兜底。
 */
function onImgError(e: Event, src: string) {
	const el = e.target as HTMLImageElement
	if (!retried.has(src)) {
		retried.add(src)
		el.src = `${src}${src.includes('?') ? '&' : '?'}retry=1`
		return
	}
	if (!failedSrcs.value.includes(src))
		failedSrcs.value = [...failedSrcs.value, src]
}

/* ==================== Zoom 状态 ==================== */
const zoomedIndex = ref<number | null>(null)
const animating = ref(false)
const total = computed(() => imageItems.value.length)
const zoomedImage = computed(() => {
	if (zoomedIndex.value === null)
		return null
	return imageItems.value[zoomedIndex.value] ?? null
})

/* ==================== 缩放与平移状态 ==================== */
/**
 * scale 1.0 = 适应窗口（max-width:90vw, max-height:86vh 时由 CSS object-fit:contain 等价）
 * scale 模式：
 *  - null = 适应窗口（CSS 控制 90vw/86vh）
 *  - 数字 = 用户主动设置的缩放比例（transform: scale()）
 */
const scale = ref<number | null>(null) // null = 适应窗口
const tx = ref(0) // translateX（像素）
const ty = ref(0) // translateY（像素）
const MIN_SCALE = 0.25
const MAX_SCALE = 4
const ZOOM_STEP = 0.25 // 按钮 +/- 步进

/** 是否已缩放（大于最小阈值） */
const isZoomed = computed(() => scale.value !== null && scale.value !== 1)
/** 缩放显示文字（固定 1 位小数） */
const scaleLabel = computed(() => {
	if (scale.value === null)
		return '适应'
	return `${Math.round(scale.value * 100)}%`
})
/** 拖动中状态（避免光标闪烁） */
const dragging = ref(false)

/* ==================== 打开/关闭 ==================== */
function openZoom(index: number) {
	if (animating.value)
		return
	zoomedIndex.value = index
	resetTransform() // 打开即重置缩放/位移
	animating.value = true
	document.body.style.overflow = 'hidden'
}
function closeZoom() {
	animating.value = true
	zoomedIndex.value = null
	resetTransform()
	document.body.style.overflow = ''
}
/** 重置缩放与位移到初始状态 */
function resetTransform() {
	scale.value = null
	tx.value = 0
	ty.value = 0
}

/* ==================== 切换图片 ==================== */
function prev() {
	if (total.value <= 1 || zoomedIndex.value === null)
		return
	zoomedIndex.value = (zoomedIndex.value - 1 + total.value) % total.value
	resetTransform() // 切图重置缩放
}
function next() {
	if (total.value <= 1 || zoomedIndex.value === null)
		return
	zoomedIndex.value = (zoomedIndex.value + 1) % total.value
	resetTransform()
}

/* ==================== 缩放控制 ==================== */
function zoomIn() {
	const cur = scale.value ?? 1
	const next = Math.min(MAX_SCALE, +(cur + ZOOM_STEP).toFixed(2))
	if (next === cur)
		return
	scale.value = next
}
function zoomOut() {
	const cur = scale.value ?? 1
	const next = Math.max(MIN_SCALE, +(cur - ZOOM_STEP).toFixed(2))
	if (next === cur)
		return
	scale.value = next
	if (scale.value! <= 0.3)
		resetTransform() // 缩到非常小时回到适应窗口
}
/** 双击图片：适应 ↔ 1:1 切换 */
function toggleFitOrActual(e?: MouseEvent) {
	e?.stopPropagation()
	if (scale.value === null) {
		scale.value = 1
	}
	else {
		resetTransform()
	}
}
/** 滚轮缩放（鼠标在图片上） */
function onWheel(e: WheelEvent) {
	e.preventDefault()
	const cur = scale.value ?? 1
	// deltaY > 0 向下滚 = 缩小
	const factor = e.deltaY > 0 ? 0.9 : 1.1
	let next = cur * factor
	next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, +next.toFixed(2)))
	if (next < 0.35) {
		resetTransform()
	}
	else {
		scale.value = next
	}
}

/* ==================== 拖动平移 ==================== */
const dragStart = { x: 0, y: 0, tx: 0, ty: 0 }
function onPointerDown(e: PointerEvent) {
	if (!isZoomed.value && scale.value === null)
		return // 未缩放时不可拖
	dragging.value = true
	;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
	dragStart.x = e.clientX
	dragStart.y = e.clientY
	dragStart.tx = tx.value
	dragStart.ty = ty.value
}
function onPointerMove(e: PointerEvent) {
	if (!dragging.value)
		return
	tx.value = dragStart.tx + (e.clientX - dragStart.x)
	ty.value = dragStart.ty + (e.clientY - dragStart.y)
}
function onPointerUp(e: PointerEvent) {
	dragging.value = false
	try {
		(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
	}
	catch { /* noop */ }
}

/* ==================== 键盘交互 ==================== */
function onKeydown(e: KeyboardEvent) {
	if (zoomedIndex.value === null)
		return
	switch (e.key) {
		case 'Escape': {
			closeZoom()
			break
		}
		case 'ArrowLeft': {
			prev()
			break
		}
		case 'ArrowRight': {
			next()
			break
		}
		case '+':
		case '=': {
			zoomIn()
			break
		}
		case '-':
		case '_': {
			zoomOut()
			break
		}
		case '0': {
			resetTransform()
			break
		}
	}
}

onMounted(() => {
	if (props.keyboard)
		window.addEventListener('keydown', onKeydown)
})
onUnmounted(() => {
	if (props.keyboard)
		window.removeEventListener('keydown', onKeydown)
	document.body.style.overflow = ''
})

function preventDrag(e: DragEvent) {
	e.preventDefault()
}
</script>

<template>
<div class="ibl-gallery" :class="{ 'is-inline': variant === 'inline' }" :data-count="total">
	<!-- ============ 顶部「Attachments (n)」标题 ============ -->
	<div v-if="total > 0 && variant !== 'inline'" class="ibl-attachments-header">
		<Icon name="ph:paperclip-bold" class="ibl-attachments-icon" />
		<span>Attachments</span>
		<span class="ibl-attachments-count">({{ total }})</span>
	</div>

	<!-- ============ 固定每行 3 张 / 移动端 2 张网格 ============ -->
	<div v-if="total > 0" class="ibl-image-grid">
		<div
			v-for="(img, index) in imageItems"
			:key="index"
			class="ibl-image"
			@click="openZoom(index)"
		>
			<img
				:src="displaySrc(img.src)"
				:alt="img.alt || img.title || `图片 ${index + 1}`"
				class="ibl-image-img"
				:class="{ 'is-failed': failedSrcs.includes(img.src) }"
				loading="lazy"
				decoding="async"
				:fetchpriority="index === 0 ? 'high' : 'auto'"
				draggable="false"
				@dragstart="preventDrag"
				@load="onImgLoaded(img.src)"
				@error="onImgError($event, img.src)"
			>
		</div>
	</div>

	<!-- ============ Zoom 灯箱层（Teleport 到 body）============ -->
	<Teleport to="body">
		<Transition name="ibl-zoom" @after-enter="animating = false" @after-leave="animating = false">
			<div
				v-if="zoomedImage"
				class="ibl-zoom-layer"
				@click.self="closeZoom"
				@wheel="onWheel"
			>
				<!-- 主图（缩放 + 拖动） -->
				<img
					:key="zoomedImage.src"
					:src="displaySrc(zoomedImage.src)"
					:alt="zoomedImage.alt || zoomedImage.title || `图片 ${zoomedIndex! + 1}`"
					class="ibl-zoom-img"
					:class="{ 'ibl-zoom-img--actual': isZoomed, 'ibl-zoom-img--dragging': dragging }"
					:style="{
						transform: scale === null
							? ''
							: `translate(${tx}px, ${ty}px) scale(${scale})`,
					}"
					draggable="false"
					@dragstart="preventDrag"
					@dblclick.stop="toggleFitOrActual"
					@pointerdown="onPointerDown"
					@pointermove="onPointerMove"
					@pointerup="onPointerUp"
					@pointercancel="onPointerUp"
				>

				<!-- 关闭按钮（右上） -->
				<button
					class="ibl-zoom-close"
					aria-label="关闭"
					@click.stop="closeZoom"
				>
					<Icon name="ph:x-bold" />
				</button>

				<!-- 左侧切换按钮（>1 张时显示） -->
				<button
					v-if="total > 1"
					class="ibl-zoom-prev"
					aria-label="上一张"
					@click.stop="prev"
				>
					<Icon name="ph:caret-left-bold" />
				</button>

				<!-- 右侧切换按钮（>1 张时显示） -->
				<button
					v-if="total > 1"
					class="ibl-zoom-next"
					aria-label="下一张"
					@click.stop="next"
				>
					<Icon name="ph:caret-right-bold" />
				</button>

				<!-- 缩放工具栏（底部居中） -->
				<div class="ibl-zoom-toolbar" @click.stop>
					<button class="ibl-zoom-tool" aria-label="缩小" @click="zoomOut">
						<Icon name="ph:minus-bold" />
					</button>
					<button
						class="ibl-zoom-tool ibl-zoom-tool--label"
						:title="scale === null ? '当前：适应窗口（双击图片切换 1:1）' : '点击重置到适应窗口'"
						@click="scale === null ? (scale = 1) : resetTransform()"
					>
						{{ scaleLabel }}
					</button>
					<button class="ibl-zoom-tool" aria-label="放大" @click="zoomIn">
						<Icon name="ph:plus-bold" />
					</button>
					<span class="ibl-zoom-tool-sep" />
					<button
						class="ibl-zoom-tool"
						:class="{ 'ibl-zoom-tool--active': scale === 1 }"
						title="1:1 原始大小"
						@click="scale === 1 ? resetTransform() : (scale = 1)"
					>
						<Icon name="ph:corners-out-bold" />
					</button>
					<button
						v-if="isZoomed"
						class="ibl-zoom-tool"
						title="重置缩放"
						@click="resetTransform"
					>
						<Icon name="ph:arrow-counter-clockwise-bold" />
					</button>
				</div>

				<!-- 计数指示器（左下）+ 标题（底部） -->
				<div v-if="total > 1" class="ibl-zoom-counter">
					{{ zoomedIndex! + 1 }} / {{ total }}
				</div>
				<div v-if="zoomedImage.title || zoomedImage.alt" class="ibl-zoom-caption">
					<span v-if="zoomedImage.title" class="ibl-zoom-title">{{ zoomedImage.title }}</span>
					<span v-if="zoomedImage.alt && zoomedImage.alt !== zoomedImage.title" class="ibl-zoom-desc">{{ zoomedImage.alt }}</span>
				</div>
			</div>
		</Transition>
	</Teleport>
</div>
</template>

<style lang="scss" scoped>
/* ============================================================
   MemosAttachments v3 — 固定每行 3 张 / 移动端 2 张
   灯箱增强：左右切换、滚轮/双击/工具栏缩放、拖动平移
   ============================================================ */
@property --tw-border-style {
	syntax: "*";
	inherits: false;
	initial-value: solid;
}

.ibl-gallery {
	--ibl-bg: var(--c-bg-2, #F5F5F5);
	--ibl-radius: 10px;
	--ibl-text: var(--c-text-1, #1F2937);
	--ibl-text-sub: var(--c-text-2, #6B7280);
	--ibl-border: var(--c-border, #E5E7EB);
	--ibl-gap: 4px;

	border-color: var(--c-primary);
	border-radius: 0.45rem;
}

/* ==================== 顶部「Attachments (n)」 ==================== */
.ibl-attachments-header {
	--spacing: 0.25rem;
	--muted: oklch(93.41% 0.0153 90.239deg);

	display: flex;
	align-items: center;
	gap: 0.35rem;
	padding-block: calc(var(--spacing) * 1);
	padding-inline: calc(var(--spacing) * 2);
	border-width: 1px;
	border-style: var(--tw-border-style);
	border-bottom-color: transparent;
	border-top-left-radius: var(--ibl-radius);
	border-top-right-radius: var(--ibl-radius);
	background-color: color-mix(in oklab, var(--muted) 40%, var(--c-bg-1) 70%);
	font-size: 0.85rem;
	font-weight: 600;
	letter-spacing: 0.02em;
	color: var(--ibl-text-sub);
	user-select: none;
}

.ibl-attachments-icon {
	opacity: 0.8;
	font-size: 1rem;
}

.ibl-attachments-count {
	opacity: 0.6;
	font-weight: 500;
}

/* ==================== 固定每行 3 张网格 ==================== */
.ibl-image-grid {
	display: grid;
	grid-template-columns: repeat(3, 1fr);
	gap: var(--ibl-gap);
	padding: 1rem;
	border-width: 1px;
	border-style: var(--tw-border-style);
	border-bottom-right-radius: var(--ibl-radius);
	border-bottom-left-radius: var(--ibl-radius);
	background-color: var(--c-bg-3);
}

@media (max-width: 768px) {
	.ibl-image-grid {
		grid-template-columns: repeat(2, 1fr);
	}
}

/* 单张图时占满整行宽度 */
.ibl-gallery[data-count="1"] .ibl-image-grid {
	grid-template-columns: 1fr;
}

/* ==================== inline 变体：贴合信息流的紧凑图集 ==================== */
.ibl-gallery.is-inline {
	margin: 8px 0 6px;

	.ibl-image-grid {
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 6px;
		padding: 0;
		border: none;
		border-radius: 0;
		background: transparent;
	}

	/* 单图：收窄到 62% 宽、限制高度，贴近参考站点的单图排布 */
	&[data-count="1"] .ibl-image-grid {
		grid-template-columns: 1fr;
		max-width: 62%;
	}

	.ibl-image {
		aspect-ratio: 4 / 3;
		border-radius: 8px;
		background: var(--c-bg-2);
	}

	&[data-count="1"] .ibl-image {
		max-height: 34vh;
		aspect-ratio: 4 / 3;
	}
}

@media (max-width: 768px) {
	.ibl-gallery.is-inline {
		.ibl-image-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		&[data-count="1"] .ibl-image-grid {
			max-width: 78%;
		}
	}
}

/* ==================== 单图卡 ==================== */
.ibl-image {
	position: relative;
	overflow: hidden;
	aspect-ratio: 4 / 3;
	border-radius: var(--ibl-radius);
	background: var(--c-bg-1, #FFF);
	transition: transform 0.2s ease;
	cursor: zoom-in;

	&:hover {
		.ibl-image-img { transform: scale(1.04); }
	}
}

.ibl-image-img {
	display: block;
	width: 100%;
	height: 100%;

	/* 加载失败时浏览器会显示 alt 文本，这里压小字号避免撑破网格 */
	font-size: 0.72rem;
	color: var(--c-text-3);
	transition: transform 0.32s cubic-bezier(0.22, 0.61, 0.36, 1);
	object-fit: cover;

	&.is-failed {
		opacity: 0;
	}
}

/* 重试后仍失败 → 单元格内显示占位文案 */
.ibl-image:has(.is-failed)::after {
	content: "图片加载失败";
	display: grid;
	place-items: center;
	position: absolute;
	inset: 0;
	font-size: 0.72rem;
	color: var(--c-text-3);
}

/* ==================== Zoom 灯箱层 ==================== */
.ibl-zoom-layer {
	display: flex;
	align-items: center;
	justify-content: center;
	position: fixed;
	overflow: hidden; // 防止缩放图溢出
	inset: 0;
	background: rgb(0 0 0 / 60%);
	backdrop-filter: blur(10px) saturate(140%);
	z-index: 2147483600;
}

.ibl-zoom-img {
	display: block;
	width: auto;
	height: auto;
	max-width: 90vw;
	max-height: 86vh;
	border-radius: 10px;
	box-shadow: 0 30px 80px rgb(0 0 0 / 60%);

	// 平滑过渡（缩放/拖动）
	transition: transform 0.25s cubic-bezier(0.22, 0.61, 0.36, 1);
	will-change: transform;
	cursor: zoom-in;
	object-fit: contain;
	touch-action: none; // 禁用浏览器默认触控手势
	user-select: none;
	-webkit-user-drag: none;

	&--dragging {
		transition: none; // 拖动时不要过渡，跟手
		cursor: grabbing;
	}

	&--actual {
		// 主动缩放时取消 max-width/max-height 限制（用 transform 控制）
		max-width: none;
		max-height: none;
	}
}

.ibl-zoom-enter-active .ibl-zoom-img,
.ibl-zoom-leave-active .ibl-zoom-img {
	transition: transform 0.32s cubic-bezier(0.22, 0.61, 0.36, 1), opacity 0.32s ease;
}

.ibl-zoom-enter-from .ibl-zoom-img {
	opacity: 0;
	transform: scale(0.88);
}

.ibl-zoom-leave-to .ibl-zoom-img {
	opacity: 0;
	transform: scale(0.94);
}

/* ==================== 通用按钮样式 ==================== */
.ibl-zoom-close,
.ibl-zoom-prev,
.ibl-zoom-next,
.ibl-zoom-tool {
	display: flex;
	align-items: center;
	justify-content: center;
	border: none;
	border-radius: 50%;
	background: rgb(255 255 255 / 18%);
	backdrop-filter: blur(8px);
	color: #FFF;
	transition: background 0.2s ease, transform 0.2s ease;
	cursor: pointer;

	&:hover {
		background: rgb(255 255 255 / 32%);
		transform: scale(1.06);
	}
	&:active { transform: scale(0.95); }
}

/* 关闭按钮（右上） */
.ibl-zoom-close {
	position: absolute;
	top: 1.25rem;
	right: 1.25rem;
	width: 44px;
	height: 44px;
	font-size: 1.1rem;
	z-index: 10;
}

/* 左右切换按钮（垂直居中） */
.ibl-zoom-prev,
.ibl-zoom-next {
	position: absolute;
	top: 50%;
	width: 48px;
	height: 64px;
	border-radius: 12px;
	font-size: 1.4rem;
	transform: translateY(-50%);
	z-index: 10;

	&:hover { transform: translateY(-50%) scale(1.06); }
	&:active { transform: translateY(-50%) scale(0.95); }
}

.ibl-zoom-prev { left: 1.25rem; }
.ibl-zoom-next { right: 1.25rem; }

/* 移动端切换按钮缩小 */
@media (max-width: 768px) {
	.ibl-zoom-prev,
	.ibl-zoom-next {
		width: 38px;
		height: 52px;
		font-size: 1.2rem;
	}
	.ibl-zoom-prev { left: 0.5rem; }
	.ibl-zoom-next { right: 0.5rem; }
}

/* ==================== 缩放工具栏（底部居中） ==================== */
.ibl-zoom-toolbar {
	display: flex;
	align-items: center;
	gap: 0.4rem;
	position: absolute;
	bottom: 1.5rem;
	left: 50%;
	padding: 0.4rem 0.6rem;
	border-radius: 999px;
	background: rgb(0 0 0 / 50%);
	backdrop-filter: blur(10px);
	transform: translateX(-50%);
	user-select: none;
	z-index: 10;
}

.ibl-zoom-tool {
	width: 36px;
	height: 36px;
	border-radius: 50%;
	font-size: 0.95rem;

	&--label {
		width: auto;
		min-width: 60px;
		padding: 0 0.6rem;
		border-radius: 18px;
		font-size: 0.85rem;
		font-weight: 500;
		letter-spacing: 0.02em;
	}

	&--active {
		background: rgb(255 255 255 / 32%);
		color: #FFF;
	}
}

.ibl-zoom-tool-sep {
	width: 1px;
	height: 20px;
	margin: 0 0.2rem;
	background: rgb(255 255 255 / 25%);
}

/* 计数指示器（左下） */
.ibl-zoom-counter {
	position: absolute;
	bottom: 1.5rem;
	left: 1.5rem;
	padding: 0.4rem 0.8rem;
	border-radius: 999px;
	background: rgb(0 0 0 / 50%);
	backdrop-filter: blur(10px);
	font-size: 0.85rem;
	font-weight: 500;
	letter-spacing: 0.05em;
	color: #FFF;
	pointer-events: none;
	z-index: 10;
}

/* 移动端计数器位置调整（避免与工具栏重叠） */
@media (max-width: 768px) {
	.ibl-zoom-counter {
		bottom: 5rem;
		left: 50%;
		transform: translateX(-50%);
	}
}

/* 底部小描述 */
.ibl-zoom-caption {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 0.2rem;
	position: absolute;
	bottom: 5rem;
	left: 50%;
	max-width: 80vw;
	padding: 0.5rem 1rem;
	border-radius: 8px;
	background: rgb(0 0 0 / 40%);
	backdrop-filter: blur(8px);
	color: #FFF;
	transform: translateX(-50%);
	pointer-events: none;
	z-index: 9;
}

.ibl-zoom-title {
	opacity: 0.95;
	font-size: 0.9rem;
	font-weight: 500;
}

.ibl-zoom-desc {
	opacity: 0.7;
	font-size: 0.78rem;
}

.ibl-zoom-enter-active,
.ibl-zoom-leave-active { transition: opacity 0.32s ease; }

.ibl-zoom-enter-from,
.ibl-zoom-leave-to { opacity: 0; }
</style>
