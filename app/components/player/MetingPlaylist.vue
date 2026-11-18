<script setup lang="ts">
/**
 * MetingPlaylist — Meting 播放器歌单
 *
 * 虚拟滚动：只渲染视口附近的十几行，否则几百张封面同时挂 DOM 会卡。
 * （行高与 Next 版保持一致：44px）
 */
import type { MetingSong } from '~/meting.config'

const props = defineProps<{
	/** 歌单 */
	songs: MetingSong[]
	/** 当前播放下标 */
	currentIndex: number
}>()

const emit = defineEmits<{
	/** 选择某首 */
	select: [index: number]
}>()

/** 行高（px），与样式里的 .mp-track 高度一致 */
const ROW_H = 44
/** 列表可视高度（px） */
const VIEW_H = 216
/** 上下各多渲染几行，避免快速滚动时露白 */
const OVERSCAN = 4

const query = ref('')
const listRef = ref<HTMLElement | null>(null)
/** 滚动位置（px） */
const scrollTop = ref(0)

/** 过滤后的歌单 */
const filtered = computed(() => {
	const keyword = query.value.trim().toLowerCase()
	if (!keyword)
		return props.songs
	return props.songs.filter(song => (
		song.name.toLowerCase().includes(keyword)
		|| song.artist.toLowerCase().includes(keyword)
	))
})

/** 可视区间的起始下标 */
const startIndex = computed(() => Math.max(0, Math.floor(scrollTop.value / ROW_H) - OVERSCAN))
/** 可视区间的结束下标 */
const endIndex = computed(() => Math.min(filtered.value.length, startIndex.value + Math.ceil(VIEW_H / ROW_H) + OVERSCAN * 2))
/** 实际渲染的那几行 */
const visible = computed(() => filtered.value.slice(startIndex.value, endIndex.value))
/** 顶部占位高度（把滚动条撑到真实长度） */
const paddingTop = computed(() => startIndex.value * ROW_H)
const paddingBottom = computed(() => Math.max(0, (filtered.value.length - endIndex.value) * ROW_H))

/**
 * 列表滚动：只更新滚动位置，不做别的
 */
function onScroll(): void {
	const el = listRef.value
	if (!el)
		return
	scrollTop.value = el.scrollTop
}

/**
 * 选中一首
 *
 * @param index 下标
 */
function select(index: number): void {
	emit('select', index)
}
</script>

<template>
<div class="mp-playlist">
	<div class="mp-playlist-search">
		<Icon name="ph:magnifying-glass-bold" class="mp-search-icon" />
		<input
			v-model="query"
			type="search"
			class="mp-search-input"
			placeholder="搜索歌名 / 歌手"
			aria-label="搜索歌单"
		>
	</div>

	<div
		ref="listRef"
		class="mp-track-list"
		@scroll.passive="onScroll"
	>
		<p v-if="!filtered.length" class="mp-playlist-empty">
			没有匹配的歌曲
		</p>
		<div v-else class="mp-track-inner" :style="{ paddingTop: `${paddingTop}px`, paddingBottom: `${paddingBottom}px` }">
			<button
				v-for="(song, offset) in visible"
				:key="`${song.id ?? song.name}-${startIndex + offset}`"
				type="button"
				class="mp-track"
				:class="{ 'is-active': startIndex + offset === currentIndex }"
				:title="`${song.name} - ${song.artist}`"
				@click="select(startIndex + offset)"
			>
				<span class="mp-track-index">
					<Icon
						v-if="startIndex + offset === currentIndex"
						name="ph:music-note-fill"
						class="mp-track-playing"
					/>
					<template v-else>{{ startIndex + offset + 1 }}</template>
				</span>
				<span class="mp-track-cover">
					<img v-if="song.pic" :src="song.pic" :alt="song.name" loading="lazy">
				</span>
				<span class="mp-track-info">
					<span class="mp-track-name">{{ song.name }}</span>
					<span class="mp-track-artist">{{ song.artist }}</span>
				</span>
			</button>
		</div>
	</div>
</div>
</template>

<style lang="scss" scoped>
.mp-playlist {
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
	min-width: 0;
}

.mp-playlist-search {
	display: flex;
	align-items: center;
	position: relative;
}

.mp-search-icon {
	position: absolute;
	left: 0.55rem;
	font-size: 0.85rem;
	color: var(--c-text-3);
	pointer-events: none;
}

.mp-search-input {
	width: 100%;
	padding: 0.35rem 0.6rem 0.35rem 1.7rem;
	border: 1px solid var(--mp-border);
	border-radius: 8px;
	outline: none;
	background: var(--c-bg-2);
	font-size: 0.78rem;
	color: var(--c-text);

	&:focus {
		border-color: color-mix(in srgb, var(--mp-theme) 55%, transparent);
	}

	&::placeholder {
		color: var(--c-text-3);
	}
}

.mp-track-list {
	overflow-y: auto;
	height: 216px;
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

.mp-playlist-empty {
	padding: 1.2rem 0;
	font-size: 0.78rem;
	text-align: center;
	color: var(--c-text-3);
}

.mp-track {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	width: 100%;
	height: 44px;
	padding: 0 0.35rem;
	border: none;
	border-radius: 8px;
	background: transparent;
	font-size: 0.78rem;
	text-align: left;
	color: var(--c-text-2);
	transition: background-color 0.2s ease, color 0.2s ease;
	cursor: pointer;

	&:hover {
		background: var(--c-bg-2);
		color: var(--c-text);
	}

	&.is-active {
		background: color-mix(in srgb, var(--mp-theme) 14%, transparent);
		color: var(--c-text);
	}
}

.mp-track-index {
	flex: none;
	width: 1.2rem;
	font-size: 0.7rem;
	text-align: center;
	color: var(--c-text-3);
	font-variant-numeric: tabular-nums;
}

.mp-track-playing {
	font-size: 0.8rem;
	color: var(--mp-theme);
}

.mp-track-cover {
	flex: none;
	overflow: hidden;
	width: 30px;
	height: 30px;
	border-radius: 6px;
	background: var(--c-bg-3);

	img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
}

.mp-track-info {
	display: flex;
	flex: 1;
	flex-direction: column;
	gap: 1px;
	min-width: 0;
}

.mp-track-name {
	overflow: hidden;
	white-space: nowrap;
	text-overflow: ellipsis;
}

.mp-track-artist {
	overflow: hidden;
	font-size: 0.68rem;
	white-space: nowrap;
	text-overflow: ellipsis;
	color: var(--c-text-3);
}
</style>
