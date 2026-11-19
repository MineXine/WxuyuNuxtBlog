<script setup lang="ts">
/**
 * MetingLyrics — Meting 播放器歌词视图
 *
 * 支持逐词（YRC）高亮：有 etext 时把整行拆成一个个 span，
 * 每帧由父组件调用 `updateHighlight(time)` 直接改 `--progress`，
 * 不走响应式状态（每帧 setState 会把整块列表重渲染）。
 *
 * 整块区域可滚动浏览；点某一句会抛出 `seek`，由父组件跳到那句继续播。
 */
import type { LrcLine } from '~/composables/useMetingLyrics'

const props = defineProps<{
	/** 歌词行 */
	lines: LrcLine[]
	/** 当前行下标 */
	currentIndex: number
}>()

const emit = defineEmits<{
	/** 点击某句歌词：请求从该句开始播放（秒） */
	seek: [time: number]
}>()

const boxRef = ref<HTMLElement | null>(null)

/**
 * 逐帧更新逐词高亮
 *
 * @param time 当前播放时间（秒）
 */
function updateHighlight(time: number): void {
	const box = boxRef.value
	if (!box)
		return
	const segs = box.querySelectorAll<HTMLElement>('[data-seg]')
	for (const seg of segs) {
		const start = Number(seg.dataset.start) || 0
		const end = Number(seg.dataset.end) || start
		const span = Number(seg.dataset.dur) || Math.max(end - start, 0.001)
		const percent = time <= start
			? 0
			: time >= end
				? 100
				: Math.max(0, ((time - start) / span) * 100)
		seg.style.setProperty('--progress', `${Math.min(100, percent)}%`)
	}
}

/**
 * 当前行居中
 *
 * 只滚歌词容器自身，别用 scrollIntoView（会把整个面板一起滚）。
 */
function center(): void {
	const box = boxRef.value
	if (!box || props.currentIndex < 0)
		return
	const target = box.querySelector<HTMLElement>(`[data-line="${props.currentIndex}"]`)
	if (!target)
		return
	const top = target.offsetTop - box.clientHeight / 2 + target.clientHeight / 2
	box.scrollTo({ top, behavior: 'smooth' })
}

watch(() => props.currentIndex, () => nextTick(center))

defineExpose({ updateHighlight, center })
</script>

<template>
<div ref="boxRef" class="mp-lyrics">
	<p v-if="!lines.length" class="mp-lyrics-empty">
		暂无歌词
	</p>
	<button
		v-for="(line, index) in lines"
		:key="index"
		:data-line="index"
		type="button"
		class="mp-lyric-line"
		:class="{
			'is-active': index === currentIndex,
			'is-past': index < currentIndex,
		}"
		title="从这句开始播放"
		@click="emit('seek', line.time)"
	>
		<span class="mp-lyric-main">
			<template v-if="line.etext?.length">
				<span class="mp-karaoke">
					<span
						v-for="(seg, segIndex) in line.etext"
						:key="segIndex"
						class="mp-seg"
						data-seg
						:data-start="seg.start"
						:data-end="seg.end"
						:data-dur="seg.duration"
					>{{ seg.text }}</span>
				</span>
			</template>
			<template v-else>{{ line.text }}</template>
		</span>
		<span v-if="line.pairlyric" class="mp-lyric-sub">
			{{ line.pairlyric }}
		</span>
	</button>
</div>
</template>

<style lang="scss" scoped>
.mp-lyrics {
	/* 填满卡片高度，超出部分滚动 */
	flex: 1 1 auto;
	overflow-y: auto;
	height: auto;
	min-height: 0;
	max-height: 100%;
	overscroll-behavior: contain;
	scroll-behavior: smooth;
	scrollbar-width: thin;

	&::-webkit-scrollbar {
		width: 4px;
	}

	&::-webkit-scrollbar-thumb {
		border-radius: 4px;
		background: var(--mp-border);
	}
}

.mp-lyrics-empty {
	padding: 1.5rem 0;
	font-size: 0.8rem;
	text-align: center;
	color: var(--c-text-3);
}

/* 每句都是按钮：点一下就从这句继续播 */
.mp-lyric-line {
	display: block;
	width: 100%;
	padding: 0.35rem 0.4rem;
	border: none;
	border-radius: 6px;
	background: transparent;
	font-family: inherit;
	font-size: 0.82rem;
	line-height: 1.5;
	text-align: left;

	/* 未播放的歌词是黑色 */
	color: #000;
	transition: color 0.35s ease, background-color 0.2s ease;
	cursor: pointer;

	&:hover {
		background: color-mix(in srgb, var(--c-text) 6%, transparent);
	}

	/* 已经唱过的行：点亮 */
	&.is-past {
		color: color-mix(in srgb, var(--mp-theme) 44%, transparent);
	}

	/* 当前正在唱的行 */
	&.is-active {
		background: color-mix(in srgb, var(--mp-theme) 12%, transparent);
		color: color-mix(in srgb, var(--mp-theme) 44%, transparent);
	}
}

.mp-lyric-main {
	display: block;
	overflow-wrap: anywhere;
}

.mp-lyric-sub {
	display: block;
	opacity: 0.75;
	margin-top: 0.1rem;
	font-size: 0.75rem;
	color: inherit;
}

/* 逐词高亮：唱过的部分主题色，未唱的部分黑色 */
.mp-karaoke {
	background:
		linear-gradient(
			to right,
			color-mix(in srgb, var(--mp-theme) 44%, transparent) var(--progress, 0%),
			#000 var(--progress, 0%)
		);
	background-clip: text;
	color: transparent;
}

.mp-seg {
	white-space: pre-wrap;
}
</style>
