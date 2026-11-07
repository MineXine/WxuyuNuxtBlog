<script setup lang="ts">
import type { ApiResponse, HotItem } from '~/types/hot'

const ITEMS_PER_PAGE = 20

useSeoMeta({ title: '热搜' })

const layoutStore = useLayoutStore()
layoutStore.setAside(['blog-stats', 'blog-tech', 'blog-log'])

const appConfig = useAppConfig()

// ── 卡片布局配置（默认 grid 竖向，可选 row 横向）──
const hotLayout = computed<'grid' | 'row'>(
	() => (appConfig.hotGetConfig as any)?.layout as 'grid' | 'row' ?? 'grid',
)

/**
 * 页面级「首条单栏大卡 + 其余两栏卡片」开关
 *
 * 优先级：本页设置 > appConfig.hotGetConfig.featuredLayout（全局）
 * - undefined：跟随全局开关
 * - true / false：在本页强制开启 / 关闭
 */
const pageFeaturedLayout = ref<boolean | undefined>(undefined)

/** featured 布局是否生效（开启后忽略 hotLayout 的 row/grid） */
const featuredLayout = computed(() =>
	pageFeaturedLayout.value ?? Boolean((appConfig.hotGetConfig as any)?.featuredLayout),
)

// ── 平台列表（tab 数据）──
const HOT_PLATFORMS = [
	{ name: '哔哩哔哩', mini: 'bilibili' },
	{ name: '微博', mini: 'weibo' },
	{ name: '抖音', mini: 'douyin' },
	{ name: '知乎', mini: 'zhihu' },
	{ name: '36氪', mini: '36kr' },
	{ name: '百度', mini: 'baidu' },
] as const

const activeTab = ref(1)
const currentPlatform = computed(() => HOT_PLATFORMS[activeTab.value - 1])

const requestUrl = computed(() =>
	`${appConfig.hotGetConfig.Api}/${currentPlatform.value.mini}`,
)

const {
	data: responseData,
	pending,
	error,
	refresh,
} = useFetch<ApiResponse>(requestUrl, {
	query: { cache: 'true' },
	key: computed(() => `hot-${currentPlatform.value.mini}`),
	default: () => ({ total: 0, updateTime: '', data: [] }),
	server: false,
	lazy: false,
})

const hotList = computed<HotItem[]>(() => {
	const list = responseData.value?.data
	return Array.isArray(list) ? list : []
})

const hotTotal = computed(() => {
	return typeof responseData.value?.total === 'number'
		? responseData.value.total
		: hotList.value.length
})

// ── 状态 ──
const isReady = computed(() => !pending.value && !error.value)
const isEmpty = computed(() => isReady.value && hotList.value.length === 0)

// ── 分页 ──
const currentPage = ref(1)
const totalPages = computed(() =>
	Math.max(1, Math.ceil(hotList.value.length / ITEMS_PER_PAGE)),
)
const pagedItems = computed(() => {
	const start = (currentPage.value - 1) * ITEMS_PER_PAGE
	return hotList.value.slice(start, start + ITEMS_PER_PAGE)
})
const showPagination = computed(() => isReady.value && totalPages.value > 1)

// 切换平台时重置页码
watch(activeTab, () => {
	currentPage.value = 1
})
watch(hotList, () => {
	if (currentPage.value > totalPages.value)
		currentPage.value = 1
})

// ── 骨架屏计数 ──
const skeletonCount = computed(() => Math.min(ITEMS_PER_PAGE, Math.max(6, hotTotal.value || 12)))
</script>

<template>
<div class="hot-main">
	<!-- tab 栏（circle 风格） -->
	<div class="hot-tabs">
		<div class="hot-tabs-list">
			<button
				v-for="(p, i) in HOT_PLATFORMS"
				:key="p.mini"
				class="hot-tab" :class="[{ 'is-active': activeTab === i + 1 }]"
				@click="activeTab = i + 1"
			>
				<NuxtImg
					:src="`/image/PageImageAssets/hot/${p.mini}.avif`"
					:alt="p.name"
					width="20"
					height="20"
					class="hot-tab-icon"
				/>
				<span>{{ p.name }}</span>
			</button>
		</div>
	</div>

	<!-- 骨架屏：跟随 layout 配置 -->
	<div
		v-if="!isReady && !error"
		class="hot-grid-container" :class="[{ 'is-row': hotLayout === 'row' && !featuredLayout, 'is-featured': featuredLayout }]"
	>
		<div class="hot-grid hot-skeleton-grid">
			<div
				v-for="n in skeletonCount"
				:key="`skel-${n}`"
				class="hot-skeleton"
				:style="{ animationDelay: `${n * 60}ms` }"
			/>
		</div>
	</div>

	<!-- 错误 -->
	<div v-else-if="error" class="hot-status hot-status--error">
		<Icon name="solar:siren-rounded-bold-duotone" class="hot-status-icon" />
		<span>数据获取失败，请稍后再试</span>
		<button class="hot-retry-btn" @click="refresh()">
			<Icon name="ph:arrow-clockwise-bold" />
			重试
		</button>
	</div>

	<!-- 空数据 -->
	<div v-else-if="isEmpty" class="hot-status hot-status--empty">
		<Icon name="ph:seal-question" class="hot-status-icon" />
		<span>暂无热搜数据</span>
	</div>

	<!-- 卡片区域 -->
	<div v-else class="hot-grid-container" :class="[{ 'is-row': hotLayout === 'row' && !featuredLayout, 'is-featured': featuredLayout }]">
		<TransitionGroup name="hot-fade" tag="div" class="hot-grid">
			<ShowcaseHotCard
				v-for="(item, i) in pagedItems"
				:key="item.id || i"
				:item="item"
				:rank="(currentPage - 1) * ITEMS_PER_PAGE + i + 1"
				:platform="currentPlatform.name"
				:layout="hotLayout"
				:featured="featuredLayout"
			/>
		</TransitionGroup>
	</div>

	<!-- 分页 -->
	<div v-if="showPagination" class="hot-pagination">
		<ZPagination
			v-model="currentPage"
			:total-pages="totalPages"
		/>
	</div>
</div>
</template>

<style lang="scss" scoped>
/* stylelint-disable custom-property-pattern, declaration-no-important */

/* --thyuu--* 为站点既有设计令牌命名；prefers-reduced-motion 需 !important 覆盖动画 */

/* ── 字体（复用 circle 字体） ── */
@font-face {
	font-family: "快看世界体";
	font-style: normal;
	font-weight: normal;
	src: local("快看世界体"), url("/fonts/caijian/RSS.ttf") format("truetype");
	font-display: swap;
}

.hot-main {
	--hot-font-slogn: var(--custom-slogn, none), "快看世界体", var(--thyuu--font-family-normal);
	--hot-color: hsl(var(--thyuu--color-font) / 50%);

	margin: 1rem;

	/* ── 顶部标题 ── */
	.hot-header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-bottom: 1em;

		&-title {
			overflow: hidden;
			height: 0.8em;
			margin: 0;
			font-family: var(--hot-font-slogn);
			font-size: 2.5em;
			line-height: 1.1;
			color: hsl(var(--thyuu--color-font) / 30%);
			-webkit-text-fill-color: transparent;
			-webkit-text-stroke: thin;

			&::selection { color: #000; }
		}

		&-info {
			display: flex;
			align-items: center;
			gap: 0.5em;
			font-family: var(--thyuu--font-family-normal);
			font-size: 0.85rem;
			white-space: nowrap;
			color: var(--hot-color);
		}

		&-divider { opacity: 0.4; }
		&-muted { opacity: 0.4; }
	}

	/* ── tab 栏 ── */
	.hot-tabs {
		overflow-x: auto;
		margin-bottom: 1em;
		scrollbar-width: none;
		&::-webkit-scrollbar { display: none; }
	}

	.hot-tabs-list {
		display: inline-flex;
		gap: 0.4em;
		padding: 0.3em;
		border-radius: 0.6rem;
	}

	.hot-tab {
		display: inline-flex;
		align-items: center;
		gap: 0.35em;
		padding: 0.4em 0.85em;
		border: none;
		border: 1px solid var(--c-divider, hsl(0deg 0% 88%));
		border-radius: 0.4rem;
		background: var(--c-bg-2, hsl(0deg 0% 98%));
		font-size: 0.82rem;
		font-weight: 500;
		white-space: nowrap;
		color: var(--c-text-2);
		transition: all 0.18s ease;
		cursor: pointer;

		&:hover {
			border-color: hsl(var(--thyuu--main-color));
			color: hsl(var(--thyuu--main-color));
		}

		&.is-active {
			border-color: hsl(var(--thyuu--main-color));
			box-shadow: 0 1px 4px hsl(0deg 0% 0% / 8%);
			background: hsl(var(--thyuu--main-color) / 8%);
			font-weight: 600;
			color: hsl(var(--thyuu--main-color));
		}
	}

	.hot-tab-icon {
		flex: none;
		width: 20px;
		height: 20px;
		border-radius: 4px;
		object-fit: cover;
	}

	/* ── 网格 / 横向列表 ── */
	.hot-grid-container {
		position: relative;

		&.is-row .hot-grid {
			display: flex;
			flex-direction: column;
			gap: 0.6em;
		}

		/* featured 布局：首条单栏大卡（卡片自身 grid-column: 1/-1）+ 其余两栏 */
		&.is-featured .hot-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		/* 骨架屏同步：第一条也占满整行 */
		&.is-featured .hot-skeleton-grid .hot-skeleton:first-child {
			grid-column: 1 / -1;
			min-height: 200px;
		}

		@media (max-width: 640px) {
			&.is-featured .hot-grid {
				grid-template-columns: minmax(0, 1fr);
			}
		}
	}

	.hot-grid {
		display: grid;
		grid: auto / repeat(auto-fill, minmax(min(var(--thyuu--size-card-normal), 100%), 1fr));
		gap: 1em;
		margin: 0;
	}

	/* ── 骨架屏 ── */
	.hot-skeleton-grid .hot-skeleton {
		min-height: 130px;
		border-radius: 0.5rem;
		background:
			linear-gradient(
				110deg,
				var(--c-bg-3, hsl(0deg 0% 95%)) 30%,
				var(--c-divider, hsl(0deg 0% 85%)) 50%,
				var(--c-bg-3, hsl(0deg 0% 95%)) 70%
			);
		background-size: 200% 100%;
		animation: hot-shimmer 1.5s infinite ease-in-out;
	}

	/* ── 状态提示 ── */
	.hot-status {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.75em;
		padding: 4em 1em;
		font-family: var(--thyuu--font-family-normal);
		text-align: center;
		color: var(--hot-color);

		&-icon {
			opacity: 0.6;
			font-size: 2.5em;
		}
		&--error &-icon { color: hsl(0deg 70% 55%); }
		&--empty &-icon { font-size: 3.5em; }
	}

	.hot-retry-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.4em;
		padding: 0.5em 1.2em;
		border: 1px solid var(--c-divider, hsl(0deg 0% 85%));
		border-radius: 0.4rem;
		background: var(--c-bg-2, hsl(0deg 0% 97%));
		font-size: 0.9rem;
		color: inherit;
		transition: background 0.2s;
		cursor: pointer;
		&:hover { background: var(--c-bg-1, hsl(0deg 0% 90%)); }
	}

	/* ── 分页 ── */
	.hot-pagination { margin-top: 1.5em; }
}

/* ── 入场动画 ── */
.hot-fade-enter-active { transition: opacity 0.4s ease, transform 0.4s ease; }

.hot-fade-leave-active {
	position: absolute;
	transition: opacity 0.2s ease, transform 0.2s ease;
}

.hot-fade-enter-from {
	opacity: 0;
	transform: translateY(12px);
}

.hot-fade-leave-to {
	opacity: 0;
	transform: translateY(-8px);
}

/* ── 骨架屏闪烁 ── */
@keyframes hot-shimmer {
	0% { background-position: 200% 0; }
	100% { background-position: -200% 0; }
}

@media (prefers-reduced-motion: reduce) {
	.hot-fade-enter-active,
	.hot-fade-leave-active { transition: none; }
	.hot-skeleton { animation: none !important; }
}
</style>
