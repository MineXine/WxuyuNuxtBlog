<script setup lang="ts">
import { useMetingPlayer } from '~/composables/useMetingPlayer'
/**
 * MetingPlayer — Meting 音乐播放器（胶囊入口 + 展开面板）
 *
 * 移植自 Next 博客的 `MusicPlayer.tsx` + `MusicPlayer.css`：
 * 桌面端是嵌在站点头部的一条「胶囊」——旋转封面 + 两行滚动歌词，
 * 点开是两张卡片：左边播放器 + 歌单，右边完整歌词。
 *
 * 与原版的差异：
 * 1. 落在站点头部 `blog-text` 旁边（不再需要 Hero 大播放器和移动端悬浮钮）。
 * 2. 移动端整体不显示（`meting.config.ts` 的 `showOnMobile` 控制）。
 * 3. CSS 变量从 `--aria-*` 映射到本站的 `--c-*` 体系。
 *
 * 性能约定沿用原版：每帧都在变的进度 / 逐词高亮只改 DOM，不进响应式状态。
 */
import { metingConfig, useMetingRuntimeConfig } from '~/meting.config'
import MetingLyrics from './MetingLyrics.vue'
import MetingPlaylist from './MetingPlaylist.vue'

const config = metingConfig
const runtime = useMetingRuntimeConfig()

const {
	audioRef,
	playlist,
	currentIndex,
	currentSong,
	isPlaying,
	volume,
	duration,
	lyrics,
	lyricIndex,
	ready,
	error,
	init,
	dispose,
	togglePlay,
	nextTrack,
	prevTrack,
	goToTrack,
	seek,
	setVolume,
	toggleMode,
	syncLyricIndex,
	modeLabel,
	modeIcon,
} = useMetingPlayer()

/** 面板是否展开 */
const open = ref(false)
/** 胶囊元素 */
const dockRef = ref<HTMLElement | null>(null)
/** 胶囊底部进度条 */
const barRef = ref<HTMLElement | null>(null)
/** 面板里的大进度条 */
const progressRef = ref<HTMLInputElement | null>(null)
/** 当前时间文本 */
const curTimeRef = ref<HTMLElement | null>(null)
/** 总时长文本 */
const durTimeRef = ref<HTMLElement | null>(null)
/** 歌词组件 */
const lyricsRef = ref<InstanceType<typeof MetingLyrics> | null>(null)
/** 胶囊主行（逐词高亮用） */
const dockKaraokeRef = ref<HTMLElement | null>(null)
/** 胶囊两行歌词的盒子与文本 */
const dockMainBoxRef = ref<HTMLElement | null>(null)
const dockMainTextRef = ref<HTMLElement | null>(null)
const dockSubBoxRef = ref<HTMLElement | null>(null)
const dockSubTextRef = ref<HTMLElement | null>(null)
/** 面板位置 */
const panelPos = ref({ left: 0, top: 0, width: 0 })

/** 歌词面板是否弹出（点播放模式旁边的歌词按钮） */
const lyricsOpen = ref(false)

/** 是否启用（可在设置面板里临时关掉） */
const enabled = computed(() => runtime.enabled.value)

/** 当前行歌词 */
const currentLine = computed(() => lyrics.value[lyricIndex.value])

/** 胶囊主行文字：唱到哪显示哪，没开始就显示歌名 */
const dockMainText = computed(() => {
	if (currentLine.value?.text)
		return currentLine.value.text
	return currentSong.value?.name ?? '歌单加载中…'
})

/** 胶囊副行文字：歌词翻译 / 歌手 */
const dockSubText = computed(() => {
	if (currentLine.value?.text)
		return currentLine.value.pairlyric || ''
	return currentSong.value?.artist ?? ''
})

/** 是否只有一行歌词（纯中文歌没有翻译） */
const dockSingle = computed(() => !dockSubText.value)

/* ------------------------------------------------------------------ */
/* 面板定位                                                             */
/* ------------------------------------------------------------------ */

/**
 * 重新计算面板位置（跟着胶囊走）
 */
function updatePanelPos(): void {
	const dock = dockRef.value
	if (!dock)
		return
	const rect = dock.getBoundingClientRect()
	const width = Math.min(720, Math.max(320, window.innerWidth - 32))
	panelPos.value = {
		left: Math.min(Math.max(8, rect.left), window.innerWidth - width - 8),
		top: rect.bottom + 8,
		width,
	}
}

/** 展开 / 收起面板 */
function togglePanel(): void {
	open.value = !open.value
	if (open.value) {
		updatePanelPos()
		nextTick(() => updatePanelPos())
	}
}

/** 点外面收起 */
function onDocClick(event: MouseEvent): void {
	if (!open.value)
		return
	const target = event.target as HTMLElement
	if (target.closest('.mp-dock') || target.closest('.mp-panel'))
		return
	open.value = false
}

/* ------------------------------------------------------------------ */
/* 每帧同步                                                             */
/* ------------------------------------------------------------------ */

let raf = 0

/**
 * 格式化时间
 *
 * @param sec 秒
 * @returns mm:ss
 */
function formatTime(sec: number): string {
	if (!sec || sec === Number.POSITIVE_INFINITY || Number.isNaN(sec))
		return '00:00'
	const m = Math.floor(sec / 60).toString().padStart(2, '0')
	const s = Math.floor(sec % 60).toString().padStart(2, '0')
	return `${m}:${s}`
}

/**
 * 每帧同步：进度条 / 时间 / 逐词高亮 / 当前歌词行
 *
 * 这些值变化极快，一律直接改 DOM，不写响应式状态。
 */
function tick(): void {
	const audio = audioRef.value
	if (audio) {
		const t = audio.currentTime || 0
		const d = audio.duration
		const pct = d && Number.isFinite(d) && d > 0 ? (t / d) * 100 : 0

		if (barRef.value)
			barRef.value.style.width = `${pct}%`
		if (progressRef.value) {
			if (d && Number.isFinite(d))
				progressRef.value.max = String(d)
			progressRef.value.value = String(Math.min(t, d && Number.isFinite(d) ? d : t))
			progressRef.value.style.background = `linear-gradient(to right, var(--mp-theme) ${pct}%, color-mix(in srgb, var(--c-text) 16%, transparent) ${pct}%)`
		}
		if (curTimeRef.value)
			curTimeRef.value.textContent = formatTime(t)
		if (durTimeRef.value)
			durTimeRef.value.textContent = formatTime(d)

		// 胶囊主行的逐词高亮
		if (dockKaraokeRef.value) {
			const segs = dockKaraokeRef.value.querySelectorAll<HTMLElement>('[data-seg]')
			for (const seg of segs) {
				const start = Number(seg.dataset.start) || 0
				const end = Number(seg.dataset.end) || start
				const span = Number(seg.dataset.dur) || Math.max(end - start, 0.001)
				const percent = t <= start ? 0 : t >= end ? 100 : Math.max(0, ((t - start) / span) * 100)
				seg.style.setProperty('--progress', `${Math.min(100, percent)}%`)
			}
		}

		syncLyricIndex(t)
	}
	lyricsRef.value?.updateHighlight(audioRef.value?.currentTime || 0)
	raf = requestAnimationFrame(tick)
}

/* ------------------------------------------------------------------ */
/* 歌词跑马灯                                                           */
/* ------------------------------------------------------------------ */

/**
 * 测量胶囊里的两行歌词，超宽就开跑马灯
 */
function updateMarquee(): void {
	const pairs: [HTMLElement | null, HTMLElement | null][] = [
		[dockMainBoxRef.value, dockMainTextRef.value],
		[dockSubBoxRef.value, dockSubTextRef.value],
	]
	for (const [box, text] of pairs) {
		if (!box || !text)
			continue
		const overflow = text.scrollWidth > box.clientWidth + 1
		box.classList.toggle('is-overflow', overflow)
		text.classList.toggle('is-marquee', overflow)
		if (overflow) {
			const shift = text.scrollWidth - box.clientWidth
			text.style.setProperty('--mp-shift', `-${shift}px`)
			text.style.setProperty('--mp-dur', `${Math.max(8, shift / 16)}s`)
		}
	}
}

watch([dockMainText, dockSubText], () => nextTick(updateMarquee))

/* ------------------------------------------------------------------ */
/* 生命周期                                                             */
/* ------------------------------------------------------------------ */

onMounted(() => {
	void init()
	raf = requestAnimationFrame(tick)
	document.addEventListener('click', onDocClick)
	window.addEventListener('resize', updatePanelPos)
	window.addEventListener('scroll', updatePanelPos, { passive: true })
})

onBeforeUnmount(() => {
	cancelAnimationFrame(raf)
	document.removeEventListener('click', onDocClick)
	window.removeEventListener('resize', updatePanelPos)
	window.removeEventListener('scroll', updatePanelPos)
	dispose()
})

/**
 * 展开 / 收起歌词面板
 */
function toggleLyrics(): void {
	lyricsOpen.value = !lyricsOpen.value
	if (lyricsOpen.value) {
		// 打开后把当前唱到的那句滚到中间
		nextTick(() => lyricsRef.value?.center())
	}
}

/**
 * 点击某句歌词：跳到那句继续播
 *
 * @param time 该句起始时间（秒）
 */
async function seekToLyric(time: number): Promise<void> {
	seek(time)
	if (!isPlaying.value)
		await togglePlay()
}

/**
 * 进度条拖动
 *
 * @param event 事件
 */
function onSeek(event: Event): void {
	const input = event.target as HTMLInputElement
	seek(Number(input.value))
}

/**
 * 音量拖动
 *
 * @param event 事件
 */
function onVolume(event: Event): void {
	const input = event.target as HTMLInputElement
	setVolume(Number(input.value) / 100)
}
</script>

<template>
<div
	v-if="enabled"
	class="meting-player"
	:class="{ 'is-mobile-hidden': !config.showOnMobile }"
>
	<!-- 胶囊 -->
	<div ref="dockRef" class="mp-dock" :class="{ 'is-open': open }" :data-single="dockSingle">
		<button type="button" class="mp-dock-main" :title="currentSong ? `${currentSong.name} - ${currentSong.artist}` : '音乐播放器'" @click="togglePanel">
			<span class="mp-disc">
				<img v-if="currentSong?.pic" :src="currentSong.pic" :alt="currentSong.name" class="mp-disc-img">
				<Icon v-else name="ph:music-notes-bold" class="mp-disc-fallback" />
			</span>
			<span ref="dockMainBoxRef" class="mp-dock-text">
				<span class="mp-dock-line is-main">
					<span ref="dockMainTextRef" class="mp-dock-line-text">
						<template v-if="currentLine?.etext?.length">
							<span ref="dockKaraokeRef" class="mp-karaoke">
								<span
									v-for="(seg, segIndex) in currentLine.etext"
									:key="segIndex"
									class="mp-seg"
									data-seg
									:data-start="seg.start"
									:data-end="seg.end"
									:data-dur="seg.duration"
								>{{ seg.text }}</span>
							</span>
						</template>
						<template v-else>{{ dockMainText }}</template>
					</span>
				</span>
				<span v-if="dockSubText" ref="dockSubBoxRef" class="mp-dock-line is-sub">
					<span ref="dockSubTextRef" class="mp-dock-line-text">{{ dockSubText }}</span>
				</span>
			</span>
		</button>

		<button type="button" class="mp-dock-play" :aria-label="isPlaying ? '暂停' : '播放'" @click.stop="togglePlay">
			<span class="mp-dock-play-circle">
				<Icon :name="isPlaying ? 'ph:pause-fill' : 'ph:play-fill'" />
			</span>
		</button>

		<span class="mp-dock-progress">
			<i ref="barRef" />
		</span>
	</div>

	<!-- 展开面板 -->
	<Teleport to="body">
		<div
			v-if="open"
			class="mp-panel"
			:class="{ 'has-lyrics': lyricsOpen }"
			:style="{ left: `${panelPos.left}px`, top: `${panelPos.top}px`, width: `${panelPos.width}px` }"
		>
			<!-- 播放器 -->
			<section class="mp-card mp-player">
				<div class="mp-player-head">
					<div class="mp-player-cover">
						<img v-if="currentSong?.pic" :src="currentSong.pic" :alt="currentSong.name">
						<Icon v-else name="ph:music-notes-bold" />
					</div>
					<div class="mp-player-meta">
						<div class="mp-player-name">
							{{ currentSong?.name ?? '歌单加载中…' }}
						</div>
						<div class="mp-player-artist">
							{{ currentSong?.artist ?? '—' }}
						</div>
					</div>
					<div class="mp-player-actions">
						<button
							type="button"
							class="mp-icon-btn"
							:title="modeLabel"
							:aria-label="modeLabel"
							@click="toggleMode"
						>
							<Icon :name="modeIcon" />
						</button>
						<button
							type="button"
							class="mp-icon-btn"
							:class="{ 'is-active': lyricsOpen }"
							title="歌词"
							aria-label="歌词"
							@click="toggleLyrics"
						>
							<Icon name="ph:quotes-bold" />
						</button>
					</div>
				</div>

				<input
					ref="progressRef"
					type="range"
					class="mp-range mp-progress"
					min="0"
					max="100"
					step="0.1"
					aria-label="播放进度"
					@input="onSeek"
				>

				<div class="mp-time">
					<span ref="curTimeRef">00:00</span>
					<span ref="durTimeRef">{{ formatTime(duration) }}</span>
				</div>

				<div class="mp-controls">
					<button type="button" class="mp-icon-btn" title="上一曲" aria-label="上一曲" @click="prevTrack">
						<Icon name="ph:skip-back-fill" />
					</button>
					<button type="button" class="mp-icon-btn is-main" :aria-label="isPlaying ? '暂停' : '播放'" @click="togglePlay">
						<Icon :name="isPlaying ? 'ph:pause-fill' : 'ph:play-fill'" />
					</button>
					<button type="button" class="mp-icon-btn" title="下一曲" aria-label="下一曲" @click="nextTrack()">
						<Icon name="ph:skip-forward-fill" />
					</button>
					<div class="mp-volume">
						<Icon name="ph:speaker-high-bold" />
						<input
							type="range"
							class="mp-range"
							min="0"
							max="100"
							step="1"
							:value="Math.round(volume * 100)"
							aria-label="音量"
							@input="onVolume"
						>
					</div>
				</div>

				<p v-if="error" class="mp-error">
					{{ error }}
				</p>
				<p v-else-if="!ready" class="mp-loading">
					歌单加载中…
				</p>

				<!-- 歌单：直接跟在播放区下面 -->
				<div class="mp-playlist-section">
					<MetingPlaylist
						:songs="playlist"
						:current-index="currentIndex"
						@select="goToTrack($event)"
					/>
				</div>
			</section>

			<!-- 歌词：点播放模式旁边的歌词按钮才弹出 -->
			<section v-if="lyricsOpen" class="mp-card mp-lyrics-card">
				<header class="mp-card-head">
					<span class="mp-lyrics-title">
						歌词
					</span>
					<button type="button" class="mp-icon-btn is-mini" title="收起歌词" aria-label="收起歌词" @click="lyricsOpen = false">
						<Icon name="ph:x-bold" />
					</button>
				</header>
				<MetingLyrics
					ref="lyricsRef"
					:lines="lyrics"
					:current-index="lyricIndex"
					@seek="seekToLyric"
				/>
			</section>
		</div>
	</Teleport>
</div>
</template>

<style lang="scss" scoped>
.meting-player {
	--mp-theme: var(--c-primary);
	--mp-border: color-mix(in srgb, var(--c-text) 12%, transparent);

	display: flex;

	/* 跟着所在容器伸缩：宽处展开成带歌词的胶囊，窄处收成紧凑形态 */
	flex: 1 1 auto;
	align-items: center;
	min-width: 88px;
	max-width: 260px;
}

/* 移动端不显示 */
@media screen and (max-width: 768px) {
	.meting-player.is-mobile-hidden {
		display: none;
	}
}

/* ---------------- 胶囊 ---------------- */

.mp-dock {
	/* 容器查询：窄容器下收起歌词行 */
	container-type: inline-size;
	display: flex;

	/* 空间不够时收缩，最小留一个「封面 + 播放键」的小胶囊 */
	flex: 1 1 auto;
	align-items: stretch;
	position: relative;
	overflow: hidden;
	width: 100%;
	height: 46px;
	min-width: 0;
	border: 1px solid var(--mp-border);

	/* 半高圆角，看起来是一整条嵌进去的胶囊 */
	border-radius: 23px;
	box-shadow:
		inset 0 3px 6px rgb(0 0 0 / 8%),
		inset 0 -1px 0 rgb(255 255 255 / 46%);
	box-sizing: border-box;

	/* 凹槽质感：底色比顶栏压深一点 + 顶部内阴影 */
	background-color: color-mix(in srgb, var(--c-bg) 4%, transparent);
	backdrop-filter: blur(14px) saturate(160%);
	color: var(--c-text);
	transition:
		width 0.3s ease,
		border-color 0.3s ease,
		background-color 0.3s ease;
	user-select: none;

	&:hover,
	&.is-open {
		border-color: color-mix(in srgb, var(--mp-theme) 55%, transparent);
	}

	&.is-open {
		background-color: color-mix(in srgb, var(--mp-theme) 10%, transparent);
	}

	&:has(:focus-visible) {
		outline: 2px solid color-mix(in srgb, var(--mp-theme) 58%, transparent);
		outline-offset: 2px;
	}

	button:focus-visible {
		outline: none;
	}
}

/* 容器太窄（侧边栏里）时收成「封面 + 播放键」的小胶囊 */
@container (max-width: 150px) {
	.mp-dock-text {
		display: none;
	}

	.mp-dock-main {
		padding-right: 0;
	}
}

/* 整块可点：封面 + 两行歌词都在这一个按钮里 */
.mp-dock-main {
	display: flex;
	flex: 1;
	align-items: center;
	gap: 9px;
	height: 100%;
	min-width: 0;
	padding: 0 4px 0 8px;
	border: none;
	background: transparent;
	font: inherit;
	text-align: left;
	color: inherit;
	cursor: pointer;
}

/* 旋转的唱片封面 */
.mp-disc {
	display: flex;
	flex: none;
	align-items: center;
	justify-content: center;
	position: relative;
	overflow: hidden;
	width: 30px;
	height: 30px;
	border-radius: 50%;
	box-shadow:
		0 1px 3px rgb(0 0 0 / 22%),
		inset 0 0 0 1px rgb(255 255 255 / 40%);
	background-color: color-mix(in srgb, var(--mp-theme) 16%, transparent);
	color: var(--mp-theme);
}

.mp-disc-img {
	width: 100%;
	height: 100%;
	animation: mp-disc-spin 9s linear infinite;
	object-fit: cover;
}

.mp-disc-fallback {
	font-size: 0.9rem;
}

/* 唱片中心的小孔，纯装饰 */
.mp-disc::after {
	content: "";
	position: absolute;
	top: 50%;
	left: 50%;
	width: 5px;
	height: 5px;
	margin: -2.5px 0 0 -2.5px;
	border-radius: 50%;
	box-shadow: 0 0 0 1px rgb(0 0 0 / 20%);
	background: rgb(255 255 255 / 80%);
	pointer-events: none;
}

@keyframes mp-disc-spin {
	to {
		transform: rotate(360deg);
	}
}

/* 两行歌词 */
.mp-dock-text {
	display: flex;
	flex: 1;
	flex-direction: column;
	justify-content: center;
	gap: 1px;
	overflow: hidden;
	min-width: 0;
	max-width: 420px;
}

.mp-dock-line {
	display: block;
	overflow: hidden;
	white-space: nowrap;

	&.is-main {
		font-size: 12.5px;
		line-height: 1.35;
	}

	&.is-sub {
		font-size: 10.5px;
		line-height: 1.3;
		color: var(--c-text-2);
	}
}

/* 只有一行（没有翻译）时字放大一点，别让胶囊显得空 */
.mp-dock[data-single="true"] .mp-dock-line.is-main {
	font-size: 13.5px;
}

/* 超出宽度时整条左右滚 */
.mp-dock-line.is-overflow {
	mask-image: linear-gradient(to right, #000 calc(100% - 16px), transparent);
}

.mp-dock-line-text {
	display: inline-block;
	white-space: nowrap;
	will-change: transform;

	&.is-marquee {
		animation: mp-marquee var(--mp-dur, 12s) ease-in-out infinite alternate;
	}
}

/* 开头和结尾各停一下，来回滚而不是瞬移 */
@keyframes mp-marquee {
	0%,
	10% {
		transform: translateX(0);
	}

	90%,
	100% {
		transform: translateX(var(--mp-shift, 0));
	}
}

/* 播放键 */
.mp-dock-play {
	display: flex;
	flex: none;
	align-items: center;
	justify-content: center;
	width: 44px;
	height: 100%;
	padding: 0;
	border: none;
	border-radius: 0 23px 23px 0;
	background: transparent;
	color: var(--mp-theme);
	cursor: pointer;
}

.mp-dock-play-circle {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 26px;
	height: 26px;
	border-radius: 50%;
	background-color: color-mix(in srgb, var(--mp-theme) 16%, transparent);
	color: var(--mp-theme);
	transition:
		background-color 0.2s ease,
		color 0.2s ease,
		transform 0.2s ease;

	.mp-dock-play:hover & {
		background-color: color-mix(in srgb, var(--mp-theme) 42%, transparent);
		transform: scale(1.03);
	}
}

/* 胶囊底部的细进度条 */
.mp-dock-progress {
	position: absolute;
	overflow: hidden;
	right: 16px;
	bottom: 1px;
	left: 16px;
	height: 2px;
	border-radius: 2px;
	background-color: color-mix(in srgb, var(--c-text) 12%, transparent);
	pointer-events: none;

	i {
		display: block;
		width: 0;
		height: 100%;
		border-radius: inherit;
		background-color: var(--mp-theme);
	}
}

/* 逐词高亮（胶囊内） */
.mp-karaoke {
	background:
		linear-gradient(
			to right,
			var(--mp-theme) var(--progress, 0%),
			color-mix(in srgb, var(--c-text-2) 65%, transparent) var(--progress, 0%)
		);
	background-clip: text;
	color: transparent;
}

.mp-seg {
	white-space: pre-wrap;
}
</style>

<style lang="scss" scoped>
/* 面板样式（Teleport 到 body，所以用全局兜底类名限定） */
.mp-panel {
	/* 面板 Teleport 到 body，脱离了胶囊的变量作用域，这里要重新定义 */
	--mp-theme: var(--c-primary);
	--mp-border: color-mix(in srgb, var(--c-text) 12%, transparent);

	display: grid;

	/* 默认只有播放区（含歌单），歌词弹出后才分出右侧一栏 */
	grid-template-columns: minmax(0, 1fr);
	gap: 0.6rem;
	position: fixed;
	overflow-y: auto;
	max-height: calc(100vh - 6rem);
	padding: 0.6rem;
	border: 1px solid color-mix(in srgb, var(--c-text) 12%, transparent);
	border-radius: 16px;
	box-shadow: 0 18px 40px -12px rgb(0 0 0 / 28%);
	background-color: color-mix(in srgb, var(--c-bg) 92%, transparent);
	backdrop-filter: blur(18px) saturate(160%);
	color: var(--c-text);
	z-index: 1002;

	&.has-lyrics {
		grid-template-columns: minmax(0, 1fr) minmax(0, 300px);
	}
}

.mp-card {
	min-width: 0;
	padding: 0.7rem;
	border: 1px solid color-mix(in srgb, var(--c-text) 8%, transparent);
	border-radius: 12px;
	background: var(--c-bg-1);
}

/* 播放器卡片 */
.mp-player {
	display: flex;
	flex-direction: column;
	gap: 0.55rem;
}

.mp-player-head {
	display: flex;
	align-items: center;
	gap: 0.6rem;
}

.mp-player-cover {
	display: flex;
	flex: none;
	align-items: center;
	justify-content: center;
	overflow: hidden;
	width: 52px;
	height: 52px;
	border-radius: 10px;
	background: var(--c-bg-3);
	color: var(--c-text-3);

	img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
}

.mp-player-meta {
	flex: 1;
	min-width: 0;
}

.mp-player-name {
	overflow: hidden;
	font-size: 0.92rem;
	font-weight: 600;
	white-space: nowrap;
	text-overflow: ellipsis;
}

.mp-player-artist {
	overflow: hidden;
	font-size: 0.75rem;
	white-space: nowrap;
	text-overflow: ellipsis;
	color: var(--c-text-3);
}

.mp-player-actions {
	display: flex;
	flex: none;
	align-items: center;
	gap: 0.3rem;
}

.mp-icon-btn {
	display: flex;
	flex: none;
	align-items: center;
	justify-content: center;
	width: 32px;
	height: 32px;
	padding: 0;
	border: none;
	border-radius: 50%;
	background: color-mix(in srgb, var(--c-text) 8%, transparent);
	color: var(--c-text-2);
	transition: background-color 0.2s ease, color 0.2s ease;
	cursor: pointer;

	&:hover {
		background: color-mix(in srgb, var(--c-primary) 18%, transparent);
		color: var(--c-primary);
	}

	&.is-main {
		width: 38px;
		height: 38px;
		background: color-mix(in srgb, var(--c-primary) 18%, transparent);
		font-size: 1.05rem;
		color: var(--c-primary);
	}
}

/* 滑条 */
.mp-range {
	width: 100%;
	height: 4px;
	border-radius: 4px;
	outline: none;
	background: color-mix(in srgb, var(--c-text) 16%, transparent);
	appearance: none;
	cursor: pointer;

	&::-webkit-slider-thumb {
		width: 12px;
		height: 12px;
		border: none;
		border-radius: 50%;
		box-shadow: 0 1px 3px rgb(0 0 0 / 25%);
		background: var(--c-primary);
		appearance: none;
	}

	&::-moz-range-thumb {
		width: 12px;
		height: 12px;
		border: none;
		border-radius: 50%;
		background: var(--c-primary);
	}
}

.mp-time {
	display: flex;
	justify-content: space-between;
	font-size: 0.68rem;
	color: var(--c-text-3);
	font-variant-numeric: tabular-nums;
}

.mp-controls {
	display: flex;
	align-items: center;
	gap: 0.45rem;
}

.mp-volume {
	display: flex;
	flex: 1;
	align-items: center;
	gap: 0.35rem;
	min-width: 0;
	font-size: 0.85rem;
	color: var(--c-text-3);
}

.mp-loading,
.mp-error {
	font-size: 0.72rem;
	text-align: center;
	color: var(--c-text-3);
}

.mp-error {
	color: #E66;
}

/* 歌单：跟在播放区下面 */
.mp-playlist-section {
	padding-top: 0.55rem;
	border-top: 1px solid color-mix(in srgb, var(--c-text) 8%, transparent);
}

/* 歌词卡（右侧弹出） */
.mp-lyrics-card {
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
	min-height: 0;
}

.mp-lyrics-title {
	font-size: 0.78rem;
	font-weight: 600;
	color: var(--c-text-2);
}

@media screen and (max-width: 640px) {
	.mp-panel,
	.mp-panel.has-lyrics {
		grid-template-columns: minmax(0, 1fr);
	}
}
</style>
