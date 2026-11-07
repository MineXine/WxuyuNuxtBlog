<script setup lang="ts">
import type { HotItem } from '~/types/hot'

const props = defineProps<{
	item: HotItem
	rank: number
	platform: string
	/** 布局模式：'grid' 竖向卡片 / 'row' 横向单列（featured 开启时此项被忽略） */
	layout?: 'grid' | 'row'
	/**
   * 「首条单栏大卡 + 其余两栏卡片」布局开关
   *
   * - 不传（undefined）：跟随全局 appConfig.hotGetConfig.featuredLayout
   * - true：单独开启（即使全局关闭）
   * - false：单独关闭（即使全局开启）
   *
   * 注：两栏由外层容器（.hot-grid）负责，本组件只负责首条大卡与跨列。
   */
	featured?: boolean
}>()

const appConfig = useAppConfig()

/** 最终是否启用 featured 布局：组件 prop 优先于全局开关 */
const isFeatured = computed(() => {
	if (typeof props.featured === 'boolean')
		return props.featured
	return Boolean((appConfig.hotGetConfig as any)?.featuredLayout)
})

/** 首条（全局第一名）渲染为单栏大卡；featured 模式下其余卡片强制竖向，避免横向卡塞进两栏 */
const isFeaturedLead = computed(() => isFeatured.value && props.rank === 1)

const itemLink = computed(() => {
	const url = props.item.url || props.item.mobileUrl || ''
	return typeof url === 'string' ? url.trim() : ''
})

const hasValidLink = computed(() => !!itemLink.value)
/** featured 开启时不再走 row 横向布局，统一由 featured 接管 */
const isRow = computed(() => props.layout === 'row' && !isFeatured.value)
const descText = computed(() => props.item.desc?.trim() || '暂无描述')

// 封面图：referrerpolicy="no-referrer" 破解防盗链 + 加载失败时隐藏
const coverSrc = computed(() => props.item.cover || '')
const hasCover = computed(() => !!coverSrc.value)
const coverFailed = ref(false)
function onCoverError() {
	coverFailed.value = true
}

const hotText = computed(() => {
	const h = props.item.hot
	if (h == null)
		return ''
	return h >= 1e6 ? `${(h / 1e6).toFixed(1)}M` : h >= 1e4 ? `${(h / 1e4).toFixed(1)}万` : String(h)
})

// rank 前 3 名特殊样式
const rankClass = computed(() => ({
	'is-top1': props.rank === 1,
	'is-top2': props.rank === 2,
	'is-top3': props.rank === 3,
}))

// 平台图标映射
const PLATFORM_ICON: Record<string, string> = {
	'哔哩哔哩': 'ph:video-camera',
	'微博': 'ph:chat-centered-text',
	'抖音': 'ph:music-notes',
	'知乎': 'ph:question',
	'36氪': 'ph:trend-up',
	'百度': 'ph:magnifying-glass',
}
const platformIcon = computed(() => PLATFORM_ICON[props.platform] || 'ph:hash')
</script>

<template>
<div class="hot-card" :class="[{ 'hot-card--row': isRow, 'hot-card--featured': isFeaturedLead }]">
	<!-- ============ featured 首位：单栏大卡（封面左 + 信息右） ============ -->
	<div
		v-if="isFeaturedLead"
		class="hot-card-hero" :class="[{ 'hot-card-hero--no-cover': !(hasCover && !coverFailed) }]"
	>
		<div v-if="hasCover && !coverFailed" class="hot-card-cover hot-card-cover--hero">
			<img
				:src="coverSrc"
				:alt="item.title"
				referrerpolicy="no-referrer"
				loading="lazy"
				@error="onCoverError"
			>
		</div>
		<div class="hot-card-body">
			<div class="hot-card-header">
				<h6 class="hot-card-title">
					<component
						:is="hasValidLink ? 'a' : 'span'"
						class="hot-card-link"
						:href="hasValidLink ? itemLink : undefined"
						:target="hasValidLink ? '_blank' : undefined"
						:rel="hasValidLink ? 'noopener noreferrer' : undefined"
					>
						{{ item.title }}
					</component>
				</h6>
				<div class="hot-card-desc">
					{{ descText }}
				</div>
			</div>
			<div class="hot-card-footer">
				<div class="hot-card-footer-left">
					<Icon :name="platformIcon" class="hot-card-platform-icon" />
					<span class="hot-card-hot">{{ hotText ? `热度 ${hotText}` : platform }}</span>
				</div>
				<div class="hot-card-footer-right">
					<div class="hot-card-rank" :class="rankClass">
						{{ rank }}
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- ============ row 横向布局：封面左 + 信息右 ============ -->
	<div v-else-if="isRow" class="hot-card-row">
		<div v-if="hasCover && !coverFailed" class="hot-card-cover hot-card-cover--row">
			<img
				:src="coverSrc"
				:alt="item.title"
				referrerpolicy="no-referrer"
				loading="lazy"
				@error="onCoverError"
			>
		</div>
		<div class="hot-card-body">
			<div class="hot-card-header">
				<h6 class="hot-card-title">
					<component
						:is="hasValidLink ? 'a' : 'span'"
						class="hot-card-link"
						:href="hasValidLink ? itemLink : undefined"
						:target="hasValidLink ? '_blank' : undefined"
						:rel="hasValidLink ? 'noopener noreferrer' : undefined"
					>
						{{ item.title }}
					</component>
				</h6>
				<div class="hot-card-desc">
					{{ descText }}
				</div>
			</div>
			<div class="hot-card-footer">
				<div class="hot-card-footer-left">
					<Icon :name="platformIcon" class="hot-card-platform-icon" />
					<span class="hot-card-hot">{{ hotText ? `热度 ${hotText}` : platform }}</span>
				</div>
				<div class="hot-card-footer-right">
					<div class="hot-card-rank" :class="rankClass">
						{{ rank }}
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- ============ grid 竖向布局：封面在上 ============ -->
	<template v-else>
		<div class="hot-card-top">
			<div v-if="hasCover && !coverFailed" class="hot-card-cover">
				<img
					:src="coverSrc"
					:alt="item.title"
					referrerpolicy="no-referrer"
					loading="lazy"
					@error="onCoverError"
				>
			</div>
			<h6 class="hot-card-title">
				<component
					:is="hasValidLink ? 'a' : 'span'"
					class="hot-card-link"
					:href="hasValidLink ? itemLink : undefined"
					:target="hasValidLink ? '_blank' : undefined"
					:rel="hasValidLink ? 'noopener noreferrer' : undefined"
				>
					{{ item.title }}
				</component>
			</h6>
			<div class="hot-card-desc">
				{{ descText }}
			</div>
		</div>
		<div class="hot-card-footer">
			<div class="hot-card-footer-left">
				<Icon :name="platformIcon" class="hot-card-platform-icon" />
				<span class="hot-card-hot">{{ hotText ? `热度 ${hotText}` : platform }}</span>
			</div>
			<div class="hot-card-footer-right">
				<div class="hot-card-rank" :class="rankClass">
					{{ rank }}
				</div>
			</div>
		</div>
	</template>
</div>
</template>

<style lang="scss" scoped>
/* stylelint-disable custom-property-pattern, selector-class-pattern */

/* --thyuu--* 为站点既有设计令牌命名；hot-card--xxx 为既有 BEM 修饰符命名 */

/* ── 共用变量 ── */
.hot-card {
	/* 卡片底色：浅色主题白卡；深色主题用中性深灰卡（否则白底白字不可读） */
	--c-bg-3: hsl(0deg 0% 100%);

	display: flex;
	flex-direction: column;
	justify-content: space-between;
	gap: 0.5em;
	overflow: hidden;
	min-height: 130px;
	padding: 0.8rem;
	border-radius: 0.5rem;
	background-color: var(--c-bg-3);

	.dark & {
		--c-bg-3: hsl(0deg 0% 16%);
	}

	/* ── 封面 ── */
	.hot-card-cover {
		overflow: hidden;
		width: 100%;
		aspect-ratio: 16 / 9;
		border-radius: 0.35rem;
		background: var(--c-bg-2, hsl(0deg 0% 96%));

		img {
			display: block;
			width: 100%;
			height: 100%;
			object-fit: cover;
		}
	}

	.hot-card-top {
		display: flex;
		flex-direction: column;
		gap: 0.5em;
		overflow-wrap: anywhere;
		word-break: break-all;
	}

	/* ── 标题 ── */
	.hot-card-title {
		display: -webkit-box;
		overflow: hidden;
		margin: 0;
		font-size: 0.9em;
		font-weight: 700;
		-webkit-line-clamp: 2;
		line-height: 1.4;
		word-break: break-all;
		text-overflow: ellipsis;
		text-transform: capitalize;
		-webkit-box-orient: vertical;

		.hot-card-link {
			word-break: break-all;
			text-decoration: none;
			color: inherit;
			transition: 0.7s cubic-bezier(0.6, 0.1, 0, 1), background-position 0s;
			cursor: pointer;

			&:where(:hover, :focus, :active) {
				color: hsl(var(--thyuu--main-color));
			}

			&:where(:not([role="button"], .button)) {
				background: var(--a-line-slide, linear-gradient(90deg, hsl(var(--thyuu--main-color) 0deg 70% 70% / 50%), hsl(var(--thyuu--subs-color) / 50%)) no-repeat var(--a-line-trans, 100%) 100% / 0 1px);

				&:hover {
					background-position-x: var(--a-line-trans, 0%);
					background-size: 100% 1px;
				}
			}
		}
	}

	/* ── 摘要 ── */
	.hot-card-desc {
		display: -webkit-box;
		overflow: hidden;
		font-size: 0.69rem;
		-webkit-line-clamp: 3;
		line-height: 1.5;
		text-overflow: ellipsis;
		-webkit-box-orient: vertical;
	}

	/* ── 底部 ── */
	.hot-card-footer {
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: space-between;
		gap: 0 0.5em;
		margin-top: 0.25em;
		font-size: 0.75rem;

		.hot-card-footer-left {
			display: flex;
			align-items: center;
			gap: 0.45em;
			overflow: hidden;
			min-width: 0;
		}
	}

	.hot-card-platform-icon {
		flex: none;
		opacity: 0.7;
		font-size: 0.95em;
	}

	.hot-card-hot {
		overflow: hidden;
		font-size: 0.68rem;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	.hot-card-footer-right { flex: none; }

	.hot-card-rank {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		min-width: 24px;
		border-radius: 6px;
		background-color: hsl(0deg 0% 90%);
		font-size: 12px;
		font-weight: 700;
		color: hsl(0deg 0% 40%);
		transition: all 0.3s;
		font-variant-numeric: tabular-nums;

		&.is-top1 {
			background-color: #EA444D;
			color: #FFF;
		}

		&.is-top2 {
			background-color: #ED702D;
			color: #FFF;
		}

		&.is-top3 {
			background-color: #EEAD3F;
			color: #FFF;
		}
	}

	/* ============ featured 首位单栏大卡 ============ */
	&.hot-card--featured {
		/* 跨满整行：容器为两栏时即为「单栏」效果 */
		grid-column: 1 / -1;
		gap: 0;
		min-height: auto;
		padding: 1rem 1.1rem;

		.hot-card-title {
			font-size: 1.05rem;
			-webkit-line-clamp: 2;
		}

		.hot-card-desc {
			font-size: 0.8rem;
			-webkit-line-clamp: 3;
		}

		.hot-card-hot { font-size: 0.74rem; }

		.hot-card-rank {
			width: 30px;
			height: 30px;
			min-width: 30px;
			border-radius: 8px;
			font-size: 14px;
		}
	}

	.hot-card-hero {
		display: grid;
		grid-template-columns: minmax(0, 44%) minmax(0, 1fr);
		align-items: stretch;
		gap: 1.1em;

		&--no-cover { grid-template-columns: minmax(0, 1fr); }
	}

	.hot-card-cover--hero {
		align-self: center;
		width: 100%;
		aspect-ratio: 16 / 9;
		border-radius: 0.5rem;
	}

	/* ============ row 横向布局 ============ */
	&.hot-card--row {
		flex-direction: row;
		gap: 0.8em;
		min-height: auto;
		padding: 0.7rem;
	}

	.hot-card-row {
		display: flex;
		gap: 0.8em;
		width: 100%;

		@media (max-width: 480px) {
			display: grid;
		}
	}

	.hot-card-cover--row {
		flex: none;
		width: 37%;
		aspect-ratio: auto;
		border-radius: 0.5rem;
	}

	.hot-card-body {
		display: flex;
		flex: 1;
		flex-direction: column;
		justify-content: space-between;
		gap: 0.25em;
		min-width: 0;

		.hot-card-header {
			display: grid;
			gap: 10px;
		}
	}
}

/* ── 响应式：小屏 row 封面缩小 ── */
@media (max-width: 480px) {
	.hot-card--row {
		.hot-card-cover--row {
			width: 100%;
		}
	}
}

/* ── 响应式：小屏 featured 大卡改为上下结构 ── */
@media (max-width: 600px) {
	.hot-card--featured {
		padding: 0.85rem;

		.hot-card-hero {
			grid-template-columns: minmax(0, 1fr);
			gap: 0.7em;
		}

		.hot-card-cover--hero {
			aspect-ratio: 16 / 9;
		}

		.hot-card-title { font-size: 0.95rem; }
	}
}
</style>
