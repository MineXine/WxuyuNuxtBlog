<!--
  MemosTimeline.vue — Memos 碎碎念列表容器

  版式对齐参考站点 .page_main > .blog_list：
  - 顶部标签筛选导航（.memos-cat-nav）
  - 行式单列信息流（#moment_item）
  - 底部「加载更多」

  特性：
  - SSR 友好（首次渲染显示骨架屏，mount 后请求数据）
  - 标签筛选（客户端按已加载数据过滤）
  - 加载更多（pageToken 分页）
  - 配置双轨：runtimeConfig 默认值 + props 覆盖
-->
<script setup lang="ts">
import type { MemosMemo, MemosTimelineProps } from '~/types/memos'
import { useAppConfig, useRuntimeConfig } from '#imports'
import { computed, onMounted, ref, watch } from 'vue'
import { useLightbox } from '~/composables/useLightbox'
import { MemosClient } from '~/composables/useMemosApi'
import MemosCatNav from './MemosCatNav.vue'
import MemosItem from './MemosItem.vue'
import MemosLightbox from './MemosLightbox.vue'

const props = withDefaults(defineProps<MemosTimelineProps>(), {
	limit: 10,
	layout: 'list',
})

// 三层配置合并：props > appConfig.memos > runtimeConfig.public.memosDefault > 内置默认值
const appCfg = useAppConfig() as { memos?: Partial<MemosTimelineProps> }
const runtime = useRuntimeConfig() as { public?: { memosDefault?: Partial<MemosTimelineProps> } }

const config = computed<MemosTimelineProps>(() => {
	const rtDefault = runtime.public?.memosDefault ?? {}
	const appDefault = appCfg.memos ?? {}

	/**
	 * 空字符串视为「未设置」：
	 * app.config 里留空 → 走 runtimeConfig（环境变量）→ 再走内置默认值。
	 */
	const pick = (...values: (string | undefined | null)[]) => {
		for (const value of values) {
			if (typeof value === 'string' && value.trim())
				return value.trim()
		}
		return undefined
	}

	return {
		memos: pick(props.memos, appDefault.memos, rtDefault.memos) ?? 'https://s.dusays.com',
		username: pick(props.username, appDefault.username, rtDefault.username) ?? 'MineXine',
		limit: props.limit ?? appDefault.limit ?? rtDefault.limit ?? 10,
		tagFilter: pick(props.tagFilter, appDefault.tagFilter, rtDefault.tagFilter) ?? '',
		layout: props.layout ?? appDefault.layout ?? 'list',
		// 访问令牌：写操作（评论 / 喜欢 / 非喜欢 / 收藏）需要；未配置时前端自动降级为只读
		token: pick(props.token, appDefault.token, rtDefault.token) ?? '',
	}
})

/** 状态 */
const memos = ref<MemosMemo[]>([])
const loading = ref(false)
const loadingMore = ref(false)
const hasMore = ref(true)
const errorMsg = ref('')
const pageToken = ref<string | undefined>(undefined)
const currentPage = ref(1)
/** 客户端 mount 标记（SSR + 首次 hydration 期间为 false，避免骨架屏闪现为空） */
const isMounted = ref(false)
/** 当前选中的标签，空串表示「全部」 */
const activeTag = ref('')

let client: MemosClient | null = null

/** 灯箱 */
const lightbox = useLightbox()

/**
 * 把客户端与令牌下发给 MemosItem：
 * 有令牌 → 评论 / 喜欢 / 非喜欢 / 收藏 可用；
 * 无令牌 → 按钮置灰并提示，页面仍可正常浏览。
 */
provide('memos-client', {
	client,
	token: computed(() => config.value.token),
})

/** 已加载数据中出现过的全部标签（保持出现顺序） */
const allTags = computed(() => {
	const set = new Set<string>()
	for (const memo of memos.value) {
		for (const tag of memo.tags ?? []) set.add(tag)
	}
	return [...set]
})

/** 按当前标签过滤后的列表 */
const visibleMemos = computed(() => {
	if (!activeTag.value)
		return memos.value
	return memos.value.filter(memo => (memo.tags ?? []).includes(activeTag.value))
})

/** 星期文案 */
const WEEK_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

interface MemoGroup {
	key: string
	day: string
	month: string
	week: string
	/** 2026-09 形式的月份键，用于插入月份分隔条 */
	monthKey: string
	/** 「2026 年 9 月」 */
	monthLabel: string
	items: MemosMemo[]
}

/** 按自然日分组：左栏日期 + 右侧当日碎念 */
const groups = computed<MemoGroup[]>(() => {
	const map = new Map<string, MemosMemo[]>()
	for (const memo of visibleMemos.value) {
		const date = memo.createdAt
		const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
		const list = map.get(key)
		if (list)
			list.push(memo)
		else
			map.set(key, [memo])
	}
	return Array.from(map.entries(), ([key, items]) => {
		const date = items[0].createdAt
		const monthNo = date.getMonth() + 1
		return {
			key,
			day: String(date.getDate()).padStart(2, '0'),
			month: `${monthNo} 月`,
			week: WEEK_LABELS[date.getDay()] ?? '',
			monthKey: `${date.getFullYear()}-${String(monthNo).padStart(2, '0')}`,
			monthLabel: `${date.getFullYear()} 年 ${monthNo} 月`,
			items,
		}
	})
})

/** 记录过的天数（分组数） */
const dayCount = computed(() => groups.value.length)

/** 该分组是否需要插入月份分隔条 */
function isNewMonth(index: number) {
	if (index === 0)
		return true
	return groups.value[index].monthKey !== groups.value[index - 1].monthKey
}

/** 加载第一页 */
async function loadFirst() {
	loading.value = true
	errorMsg.value = ''
	memos.value = []
	pageToken.value = undefined
	currentPage.value = 1
	hasMore.value = true

	try {
		if (!config.value.memos) {
			throw new Error('Memos 实例地址未配置（请通过 props.memos 或 app.config.memos.memos 设置）')
		}
		client = new MemosClient(config.value.memos, String(config.value.username), config.value.token)
		const { memos: list, hasMore: more, nextPageToken } = await client.list({
			pageToken: undefined,
			pageSize: config.value.limit,
			tag: config.value.tagFilter,
			state: 'NORMAL',
		})
		memos.value = list
		pageToken.value = nextPageToken
		hasMore.value = more
	}
	catch (err) {
		errorMsg.value = err instanceof Error ? err.message : '加载失败'
	}
	finally {
		loading.value = false
	}
}

/** 加载更多 */
async function loadMore() {
	if (loadingMore.value || !hasMore.value || !client)
		return
	loadingMore.value = true
	currentPage.value += 1
	try {
		const { memos: list, hasMore: more, nextPageToken } = await client.list({
			pageToken: pageToken.value,
			page: currentPage.value,
			pageSize: config.value.limit,
			tag: config.value.tagFilter,
			state: 'NORMAL',
		})
		memos.value.push(...list)
		pageToken.value = nextPageToken
		hasMore.value = more
	}
	catch (err) {
		errorMsg.value = err instanceof Error ? err.message : '加载更多失败'
	}
	finally {
		loadingMore.value = false
	}
}

/** 标签点击：切换筛选 */
function onTagSelect(tag: string) {
	activeTag.value = tag === activeTag.value ? '' : tag
}

/** 图片点击 → 打开灯箱 */
function onLightbox(payload: { images: string[], index: number }) {
	if (payload.images.length > 0) {
		lightbox.open(payload.images, payload.index)
	}
}

// 监听 tagFilter 变化重新加载，并把它作为初始筛选条件
watch(() => config.value.tagFilter, (tag) => {
	activeTag.value = tag || ''
	loadFirst()
})

onMounted(() => {
	isMounted.value = true
	activeTag.value = config.value.tagFilter || ''
	loadFirst()
})
</script>

<template>
<div class="memos-timeline">
	<div class="memos-toolbar">
		<MemosCatNav
			:tags="allTags"
			:active="activeTag"
			@select="onTagSelect"
		/>
		<span class="memos-count">
			{{ activeTag ? `${visibleMemos.length} / ${memos.length}` : memos.length }} 条
		</span>
		<button class="memos-refresh" type="button" :disabled="loading" title="刷新" @click="loadFirst">
			<Icon name="ph:arrows-clockwise-bold" />
		</button>
	</div>

	<!-- 概览：条数 / 标签 / 天数，一眼看清这条时间线的体量 -->
	<div class="memos-overview">
		<div class="memos-stat">
			<b>{{ memos.length }}</b>
			<span>条碎碎念</span>
		</div>
		<div class="memos-stat">
			<b>{{ allTags.length }}</b>
			<span>个标签</span>
		</div>
		<div class="memos-stat">
			<b>{{ dayCount }}</b>
			<span>天记录</span>
		</div>
		<div class="memos-stat is-note">
			<Icon name="ph:sparkle-bold" />
			<span>按时间倒序 · 点击标签即可筛选</span>
		</div>
	</div>

	<div class="memos-stage">
		<!-- 加载中骨架屏（SSR 也显示，避免裸空容器） -->
		<div
			v-if="loading || (isMounted ? false : !memos.length && !errorMsg)"
			class="memos-skeleton"
		>
			<div v-for="i in 4" :key="i" class="skeleton-card">
				<div class="skeleton-head">
					<div class="skeleton-avatar" />
					<div class="skeleton-body">
						<div class="skeleton-line" style="width: 34%;" />
						<div class="skeleton-line" style="width: 52%;" />
					</div>
				</div>
				<div class="skeleton-line" style="width: 88%; height: 14px;" />
				<div class="skeleton-line" style="width: 64%;" />
				<div class="skeleton-media" />
			</div>
		</div>

		<!-- 错误 -->
		<div v-else-if="errorMsg && !memos.length" class="memos-error">
			<p>{{ errorMsg }}</p>
			<button class="retry-btn" type="button" @click="loadFirst">
				重试
			</button>
		</div>

		<!-- 列表 -->
		<template v-else-if="memos.length">
			<div
				v-if="visibleMemos.length"
				class="memos-feed"
				@memos-lightbox="(e: any) => onLightbox(e.detail)"
			>
				<template v-for="(group, index) in groups" :key="group.key">
					<!-- 跨月时插入月份分隔条 -->
					<div v-if="isNewMonth(index)" class="memos-month">
						<span>{{ group.monthLabel }}</span>
					</div>

					<section class="memos-group">
						<div class="memos-rail">
							<time class="memos-rail-date" :datetime="group.key">
								<b>{{ group.day }}</b>
								<span>{{ group.month }}</span>
							</time>
							<span class="memos-rail-week">{{ group.week }}</span>
						</div>

						<div class="memos-stack">
							<MemosItem
								v-for="memo in group.items"
								:key="memo.id"
								:memo="memo"
								:memos-url="config.memos ?? ''"
								:active-tag="activeTag"
								@tagclick="onTagSelect"
							/>
						</div>
					</section>
				</template>
			</div>

			<!-- 标签筛选后为空 -->
			<p v-else class="memos-empty">
				该标签下暂时没有内容
			</p>

			<!-- 加载更多按钮 -->
			<div v-if="hasMore" class="memos-loadmore">
				<button class="loadmore-btn" :class="{ loading: loadingMore }" type="button" :disabled="loadingMore" @click="loadMore">
					{{ loadingMore ? '加载中…' : '加载更多' }}
				</button>
			</div>

			<div v-else class="memos-end">
				— 已经到底啦 —
			</div>
		</template>
	</div>

	<!-- 灯箱 -->
	<MemosLightbox
		:open="lightbox.state.value.open"
		:images="lightbox.state.value.images"
		:index="lightbox.state.value.index"
		@close="lightbox.close"
		@switch="lightbox.switchTo"
	/>
</div>
</template>

<style scoped lang="scss">
.memos-timeline {
	width: 100%;
	min-width: 0;
}

/* ── 筛选工具栏 ── */
.memos-toolbar {
	display: flex;
	align-items: center;
	gap: 0.6rem;
	position: sticky;
	top: 0.45rem;
	margin-bottom: 0.7rem;
	padding: 0.42rem 0.45rem 0.42rem 0.6rem;
	border: 1px solid var(--c-border);
	border-radius: 1rem;
	box-shadow:
		0 10px 26px rgb(0 0 0 / 6%),
		inset 0 1px 0 rgb(255 255 255 / 40%);
	background: color-mix(in oklab, var(--c-bg-1) 86%, transparent);
	backdrop-filter: blur(16px) saturate(1.15);
	z-index: 12;
}

.memos-count {
	flex: none;
	padding: 0.16rem 0.6rem;
	border: 1px solid var(--c-border);
	border-radius: 999px;
	background: var(--c-bg-2);
	font-size: 0.7rem;
	white-space: nowrap;
	color: var(--c-text-3);
	font-variant-numeric: tabular-nums;
}

.memos-refresh {
	display: inline-grid;
	flex: none;
	place-items: center;
	width: 1.85rem;
	height: 1.85rem;
	padding: 0;
	border: 1px solid var(--c-border);
	border-radius: 50%;
	background: var(--c-bg-2);
	font-size: 0.82rem;
	color: var(--c-text-3);
	transition: color 0.2s ease, border-color 0.2s ease, transform 0.3s ease;
	cursor: pointer;

	&:hover:not(:disabled) {
		border-color: var(--c-primary-soft);
		color: var(--c-primary);
		transform: rotate(90deg);
	}

	&:disabled {
		opacity: 0.5;
		cursor: progress;
	}
}

/* ── 概览条 ── */
.memos-overview {
	display: grid;
	grid-template-columns: repeat(3, minmax(0, 1fr)) minmax(0, 1.6fr);
	gap: 0.5rem;
	margin-bottom: 1.15rem;
}

.memos-stat {
	display: flex;
	align-items: baseline;
	gap: 0.35rem;
	padding: 0.62rem 0.85rem;
	border: 1px solid var(--c-border);
	border-radius: 0.9rem;
	background: linear-gradient(160deg, color-mix(in oklab, var(--c-primary) 9%, var(--c-bg-1)), var(--c-bg-1) 65%);
	transition: border-color 0.24s ease, transform 0.24s ease;

	&:hover {
		border-color: var(--c-primary-soft);
		transform: translateY(-1px);
	}

	b {
		font-family: var(--font-serif, Georgia, serif);
		font-size: 1.3rem;
		font-weight: 800;
		line-height: 1;
		font-variant-numeric: tabular-nums;
		color: var(--c-primary);
	}

	span {
		font-size: 0.74rem;
		letter-spacing: 0.04em;
		color: var(--c-text-3);
	}

	/* 提示位：虚线边框，不参与数字强调 */
	&.is-note {
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		border-style: dashed;
		background: transparent;
		font-size: 0.76rem;
		color: var(--c-text-3);
	}
}

/* ── 骨架屏：与卡片同构 ── */
.memos-skeleton {
	display: flex;
	flex-direction: column;
	gap: 0.9rem;
}

.skeleton-card {
	margin: 0;
	padding: 0.95rem 1rem 1rem;
	border: 1px solid var(--c-border);
	border-radius: 0.95rem;
	background: var(--c-bg-1);
}

.skeleton-head {
	display: flex;
	align-items: center;
	gap: 0.6rem;
	margin-bottom: 0.7rem;
}

.skeleton-avatar {
	flex: none;
	width: 2.15rem;
	height: 2.15rem;
	border-radius: 50%;
	background: var(--c-bg-2);
	animation: skeleton-pulse 1.4s ease-in-out infinite;
}

.skeleton-body {
	display: flex;
	flex: 1;
	flex-direction: column;
	gap: 6px;
	min-width: 0;
}

.skeleton-line {
	height: 10px;
	margin-bottom: 8px;
	border-radius: 4px;
	background: linear-gradient(90deg, var(--c-bg-2) 25%, var(--c-bg-3) 50%, var(--c-bg-2) 75%);
	background-size: 200% 100%;
	animation: skeleton-shimmer 1.4s ease-in-out infinite;

	.skeleton-body & {
		height: 8px;
		margin-bottom: 0;
	}
}

.skeleton-media {
	height: 96px;
	margin-top: 0.55rem;
	border-radius: 0.6rem;
	background: var(--c-bg-2);
	animation: skeleton-pulse 1.4s ease-in-out infinite;
}

@keyframes skeleton-shimmer {
	0% { background-position: 200% 0; }
	100% { background-position: -200% 0; }
}

@keyframes skeleton-pulse {
	0%, 100% { opacity: 1; }
	50% { opacity: 0.6; }
}

/* ── 错误 ── */
.memos-error {
	padding: 3rem 1rem;
	text-align: center;
	color: var(--c-text-3);

	.retry-btn {
		margin-top: 1rem;
		padding: 0.4rem 1.2rem;
		border: 1px solid var(--c-border);
		border-radius: 999px;
		background: transparent;
		color: var(--c-text-2);
		transition: color 0.2s ease, border-color 0.2s ease;
		cursor: pointer;

		&:hover {
			border-color: var(--c-primary);
			color: var(--c-primary);
		}
	}
}

/* ── 时间线 ── */
.memos-feed {
	display: flex;
	flex-direction: column;
	gap: 1.05rem;
}

/* 月份分隔条 */
.memos-month {
	display: flex;
	align-items: center;
	gap: 0.75rem;
	margin: 0.35rem 0 0.15rem;

	span {
		flex: none;
		padding: 0.22rem 0.9rem;
		border: 1px solid var(--c-border);
		border-radius: 999px;
		background: var(--c-bg-1);
		font-size: 0.74rem;
		font-weight: 600;
		letter-spacing: 0.12em;
		color: var(--c-text-2);
	}

	&::before,
	&::after {
		content: "";
		flex: 1;
		height: 1px;
		background: linear-gradient(90deg, transparent, var(--c-border));
	}

	&::after {
		background: linear-gradient(270deg, transparent, var(--c-border));
	}
}

.memos-group {
	display: grid;
	grid-template-columns: 4.1rem minmax(0, 1fr);
	gap: 0.85rem;
}

/* 左侧日期牌 */
.memos-rail {
	display: flex;
	flex-direction: column;
	align-items: center;
	align-self: start;
	gap: 0.12rem;
	position: sticky;
	top: 4.6rem;
	padding: 0.55rem 0.3rem 0.6rem;
	border: 1px solid var(--c-border);
	border-radius: 0.85rem;
	background: color-mix(in oklab, var(--c-bg-1) 78%, transparent);
	backdrop-filter: blur(8px);
}

.memos-rail-date {
	display: flex;
	flex-direction: column;
	align-items: center;
	line-height: 1;

	b {
		font-family: var(--font-serif, Georgia, serif);
		font-size: 1.42rem;
		font-weight: 800;
		letter-spacing: 0.02em;
		font-variant-numeric: tabular-nums;
		color: var(--c-text-1);
	}

	span {
		margin-top: 0.2rem;
		font-size: 0.64rem;
		letter-spacing: 0.08em;
		color: var(--c-text-3);
	}
}

.memos-rail-week {
	padding: 0.1rem 0.4rem;
	border-radius: 999px;
	background: var(--c-bg-2);
	font-size: 0.6rem;
	letter-spacing: 0.1em;
	color: var(--c-text-3);
}

/* 右侧卡片流 + 轴线 */
.memos-stack {
	display: flex;
	flex-direction: column;
	gap: 0.8rem;
	position: relative;
	min-width: 0;
	padding-left: 1.15rem;

	/* 轴线：上下淡出，中段实线 */
	&::before {
		content: "";
		position: absolute;
		top: 0.85rem;
		bottom: 0.85rem;
		left: 0;
		width: 2px;
		border-radius: 2px;
		background:
			linear-gradient(
				180deg,
				transparent,
				color-mix(in oklab, var(--c-primary) 45%, transparent) 12%,
				color-mix(in oklab, var(--c-primary) 45%, transparent) 88%,
				transparent
			);
	}

	/* 卡片与时间轴的连接点 */
	:deep(.memo-item) {
		position: relative;
		margin: 0;
	}

	:deep(.memo-item::before) {
		content: "";
		position: absolute;
		top: 1.42rem;
		left: -1.42rem;
		width: 7px;
		height: 7px;
		border-radius: 50%;
		box-shadow:
			0 0 0 3px var(--c-bg-1),
			0 0 0 4px color-mix(in oklab, var(--c-primary) 40%, transparent);
		background: var(--c-primary);
		transition: transform 0.24s ease;
	}

	:deep(.memo-item:hover::before) {
		transform: scale(1.35);
	}
}

.memos-empty {
	padding: 4rem 0;
	font-size: 0.86rem;
	text-align: center;
	color: var(--c-text-3);
}

/* ── 加载更多 ── */
.memos-loadmore {
	display: flex;
	justify-content: center;
	padding: 1.6rem 0 2rem;
}

.loadmore-btn {
	display: inline-flex;
	align-items: center;
	gap: 0.35rem;
	padding: 0.5rem 2rem;
	border: 1px solid var(--c-border);
	border-radius: 999px;
	background: var(--c-bg-1);
	font-size: 0.82rem;
	letter-spacing: 0.04em;
	color: var(--c-text-2);
	transition: color 0.24s ease, background 0.24s ease, box-shadow 0.24s ease, border-color 0.24s ease;
	cursor: pointer;

	&:hover:not(:disabled) {
		border-color: transparent;
		box-shadow: 0 10px 22px var(--c-primary-soft);
		background: var(--c-primary);
		color: #FFF;
	}

	&:disabled {
		color: var(--c-text-3);
		cursor: not-allowed;
	}
}

.memos-end {
	display: flex;
	align-items: center;
	gap: 0.7rem;
	padding: 2rem 0 1rem;
	font-size: 0.76rem;
	letter-spacing: 0.1em;
	color: var(--c-text-3);

	&::before,
	&::after {
		content: "";
		flex: 1;
		height: 1px;
		background: linear-gradient(90deg, transparent, var(--c-border));
	}

	&::after {
		background: linear-gradient(270deg, transparent, var(--c-border));
	}
}

@media (max-width: 900px) {
	.memos-overview {
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}

	.memos-stat.is-note {
		display: none;
	}

	.memos-group {
		grid-template-columns: minmax(0, 1fr);
		gap: 0.45rem;
	}

	.memos-rail {
		flex-direction: row;
		align-items: baseline;
		gap: 0.4rem;
		position: static;
		padding: 0.35rem 0.7rem;
		border-radius: 0.7rem;
	}

	.memos-rail-date {
		flex-direction: row;
		align-items: baseline;
		gap: 0.3rem;

		b {
			font-size: 1.05rem;
		}

		span {
			margin-top: 0;
		}
	}

	.memos-stack {
		padding-left: 0;

		&::before {
			display: none;
		}

		:deep(.memo-item::before) {
			display: none;
		}
	}
}

@media (max-width: 768px) {
	.memos-toolbar {
		position: static;
		margin-bottom: 0.6rem;
		padding: 0.32rem 0.38rem;
	}

	.memos-loadmore {
		padding: 1.2rem 0 1.6rem;
	}
}
</style>
