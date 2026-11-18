<script setup lang="ts">
/**
 * MetingLyrics — Meting 播放器歌词视图
 *
 * 支持逐词（YRC）高亮：有 etext 时把整行拆成一个个 span，
 * 每帧由父组件调用 `updateHighlight(time)` 直接改 `--progress`，
 * 不走响应式状态（每帧 setState 会把整块列表重渲染）。
 */
import type { LrcLine } from '~/composables/useMetingLyrics'

const props = defineProps<{
	/** 歌词行 */
	lines: LrcLine[]
	/** 当前行下标 */
	currentIndex: number
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

/** 当前行居中 */
function centerCurrent(): void {
	const box = boxRef.value
	if (!box || props.currentIndex < 0)
		return
	const target = box.querySelector<HTMLElement>(`[data-line="${props.currentIndex}"]`)
	if (!target)
		return
	// 只滚歌词容器自身，别用 scrollIntoView（会把面板一起滚）
	const top = target.offsetTop - box.clientHeight / 2 + target.clientHeight / 2
	box.scrollTo({ top, behavior: 'smooth' })
}

watch(() => props.currentIndex, () => nextTick(centerCurrent))

defineExpose({ updateHighlight })
</script>

<template>
<div ref="boxRef" class="mp-lyrics">
	<p v-if="!lines.length" class="mp-lyrics-empty">
		暂无歌词
	</p>
	<div
		v-for="(line, index) in lines"
		:key="index"
		:data-line="index"
		class="mp-lyric-line"
		:class="{ 'is-active': index === currentIndex }"
	>
		<div class="mp-lyric-main">
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
			<template v-else>
				{{ line.text }}
			</template>
		</div>
		<div v-if="line.pairlyric" class="mp-lyric-sub">
			{{ line.pairlyric }}
		</div>
	</div>
</div>
</template>

<style lang="scss" scoped>
.mp-lyrics {
	overflow-y: auto;
	height: 100%;
	overscroll-behavior: contain;
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

.mp-lyric-line {
	opacity: 0.7;
	padding: 0.35rem 0;
	font-size: 0.82rem;
	line-height: 1.5;
	color: var(--c-text-3);
	transition: color 0.25s ease, opacity 0.25s ease;

	&.is-active {
		opacity: 1;
		color: var(--c-text);
	}
}

.mp-lyric-main {
	overflow-wrap: anywhere;
}

.mp-lyric-sub {
	margin-top: 0.1rem;
	font-size: 0.75rem;
	color: var(--c-text-3);
}

/* 逐词高亮：唱过的部分用主题色，未唱的部分保持淡色 */
.mp-karaoke {
	background:
		linear-gradient(
			to right,
			var(--mp-theme) var(--progress, 0%),
			color-mix(in srgb, var(--c-text-2) 60%, transparent) var(--progress, 0%)
		);
	background-clip: text;
	color: transparent;
}

.mp-seg {
	white-space: pre-wrap;
}
</style>
