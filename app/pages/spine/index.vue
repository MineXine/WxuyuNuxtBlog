<!--
  /spine 路由 — 模型图鉴（模型浏览界面）

  版式参考《少年三国志2》品质图鉴：
    顶部牌匾 + 资源计数 → 品质圆钮筛选 + 「品质由左到右，由高到低排序」→ 竖版卡牌网格
    （立绘 + 已拥有/未拥有角标 + 名字绶带）→ 左侧头像气泡 / 右侧分类导航（红点）。

  数据源：type 为 model 的内容文章（content/spine/*.md），构建期取数并静态化（SSG）。
  frontmatter：ModelName / ModelQuality / ModelPortrait / ModelAssets
-->
<script setup lang="ts">
import type { ArticleProps } from '~/types/article'
import { isSpineModelCached, preloadSpineModel } from '~/utils/spineAssets'

useSeoMeta({
	title: '模型图鉴',
	description: 'Spine 3.5 骨架模型图鉴：按品质与分类浏览，点击卡牌进入动作预览与骨骼调试。',
})

const layoutStore = useLayoutStore()
layoutStore.setAside([])

const route = useRoute()

// 构建期取数 → SSG 时直接写进 HTML
const { data: listRaw } = await useAsyncData('index_models', () => useModelIndexOptions(), { default: () => [] })
const { listSorted } = useArticleSort(listRaw)

const models = computed(() => listSorted.value as ArticleProps[])

/* ── 品质（由高到低，数组顺序即权重） ── */
interface QualityMeta {
	key: string
	label: string
	ring: string
}

const QUALITIES: QualityMeta[] = [
	{ key: '金', label: '金', ring: '#E9C584' },
	{ key: '橙金', label: '橙金', ring: '#E0A05A' },
	{ key: '紫', label: '紫', ring: '#B48BE0' },
	{ key: '蓝', label: '蓝', ring: '#79AEE8' },
	{ key: '绿', label: '绿', ring: '#7CC79A' },
	{ key: '粉', label: '粉', ring: '#E39BC0' },
	{ key: '红', label: '红', ring: '#DE7C6E' },
]

/** 悬停/聚焦卡片时预热模型资源，点进去时基本已经就绪 */
function warmModel(item: ArticleProps) {
	if (isSpineModelCached(item.ModelAssets))
		return
	preloadSpineModel(item.ModelAssets)
}

function qualityRank(item: ArticleProps) {
	const index = QUALITIES.findIndex(q => q.key === item.ModelQuality)
	return index === -1 ? QUALITIES.length : index
}

function qualityRing(item: ArticleProps) {
	return QUALITIES.find(q => q.key === item.ModelQuality)?.ring ?? '#C9AC82'
}

/** 每个品质的模型数量，用于圆钮的「有内容 / 空」状态 */
const qualityCounts = computed(() => {
	const map = new Map<string, number>()
	for (const item of models.value) {
		if (!item.ModelQuality)
			continue
		map.set(item.ModelQuality, (map.get(item.ModelQuality) ?? 0) + 1)
	}
	return map
})

/* ── 分类（右侧导航） ── */
/** 图鉴固定分类（复刻游戏内的可选项），数据里多出的分类会追加在后面 */
const GAME_CATEGORIES = [
	{ name: '武将', icon: 'ph:user-bold' },
	{ name: '神兵', icon: 'ph:sword-bold' },
	{ name: '神兽', icon: 'ph:paw-print-bold' },
	{ name: '红颜', icon: 'ph:heart-straight-bold' },
	{ name: '军师', icon: 'ph:notebook-bold' },
	{ name: '战法', icon: 'ph:scroll-bold' },
	{ name: '合击', icon: 'ph:lightning-bold' },
	{ name: '副将', icon: 'ph:shield-bold' },
	{ name: '坐骑', icon: 'ph:horse-bold' },
]

const categories = computed(() => {
	const counters = new Map<string, number>()
	for (const item of models.value) {
		const key = item.categories?.[0] || '未分类'
		counters.set(key, (counters.get(key) ?? 0) + 1)
	}
	const rail = GAME_CATEGORIES.map(c => ({ ...c, count: counters.get(c.name) ?? 0 }))
	for (const [name, count] of counters) {
		if (!GAME_CATEGORIES.some(c => c.name === name))
			rail.push({ name, icon: getCategoryIcon(name), count })
	}
	return rail
})

const activeQuality = ref('')
const activeCategory = ref('')

const visibleModels = computed(() => {
	const list = models.value.filter((item) => {
		const qualityOk = !activeQuality.value || item.ModelQuality === activeQuality.value
		const categoryOk = !activeCategory.value || (item.categories?.[0] || '未分类') === activeCategory.value
		return qualityOk && categoryOk
	})
	return list.toSorted((a, b) => qualityRank(a) - qualityRank(b)
		|| String(b.date ?? '').localeCompare(String(a.date ?? '')))
})

/* ── 卡面信息 ── */
function assetCount(assets?: ArticleProps['ModelAssets']) {
	if (!assets)
		return 0
	return [assets.ModelSkel, assets.ModelImage, assets.ModelAtlas].filter(Boolean).length
}

function isOwned(item: ArticleProps) {
	return assetCount(item.ModelAssets) === 3
}

function displayName(item: ArticleProps) {
	const title = item.title ?? ''
	const tail = title.split('·').pop()?.trim()
	return tail || item.ModelName || title || '未命名模型'
}

/** 立绘：优先 frontmatter 指定，其次文章封面，最后用离屏渲染的缩略图兜底 */
const { thumbs, done, total } = useSpineThumbnails(() =>
	models.value
		.filter(item => !item.ModelPortrait && !item.image)
		.map(item => ({ key: item.path, assets: item.ModelAssets })),
)

function portraitOf(item: ArticleProps) {
	return item.ModelPortrait || item.image || thumbs.value[item.path] || ''
}

/* ── 顶部计数 ── */
const ownedCount = computed(() => models.value.filter(isOwned).length)
const assetTotal = computed(() => models.value.reduce((sum, item) => sum + assetCount(item.ModelAssets), 0))

/* ── 右侧导航：分类 + 工具入口 ── */
const tools = [{ label: '本地预览', icon: 'ph:folder-simple-bold', url: '/spine/local' }]
const isLocalRoute = computed(() => route.path.startsWith('/spine/local'))

/** 补足整行空位：默认铺满两行（4 列 × 2），筛选时至少铺满一行 */
const emptySlots = computed(() => {
	const target = activeQuality.value || activeCategory.value ? 4 : 8
	return Math.max(0, target - visibleModels.value.length)
})
</script>

<template>
<div class="codex">
	<!-- 四角金饰 -->
	<span class="codex-corner is-tl" aria-hidden="true" />
	<span class="codex-corner is-tr" aria-hidden="true" />
	<span class="codex-corner is-bl" aria-hidden="true" />
	<span class="codex-corner is-br" aria-hidden="true" />

	<!-- 顶栏 -->
	<header class="codex-top">
		<div class="codex-title">
			<span class="codex-seal">
				<Icon name="ph:mountains-bold" />
			</span>
			<div class="codex-plaque">
				<h1>模型图鉴</h1>
			</div>
			<span class="codex-help" title="文章类型为「模型」的 Spine 3.5 骨架资源">?</span>
		</div>

		<div class="codex-stats">
			<span class="codex-stat" title="已拥有 / 收录总数">
				<i class="codex-gem is-blue" />
				{{ ownedCount }}/{{ models.length }}
			</span>
			<span class="codex-stat" title="资源文件总数（骨架 / 贴图 / 图集）">
				<i class="codex-gem is-gold" />
				{{ assetTotal }}
			</span>
			<span class="codex-stat" title="分类数量">
				<i class="codex-gem is-jade" />
				{{ categories.length }}
			</span>
			<UtilLink class="codex-icon-btn" to="/spine/local" title="本地文件预览">
				<Icon name="ph:folder-open-bold" />
			</UtilLink>
		</div>
	</header>

	<div class="codex-body">
		<main class="codex-main">
			<!-- 品质圆钮：固定整条品质阶梯，缺内容的品质变暗 -->
			<div class="codex-medals">
				<button
					class="codex-medal"
					:class="{ 'is-active': !activeQuality }"
					style="

--ring: #E4C07A;"
					type="button"
					@click="activeQuality = ''"
				>
					<span class="codex-medal-core">全</span>
				</button>
				<button
					v-for="quality in QUALITIES"
					:key="quality.key"
					class="codex-medal"
					:class="{ 'is-active': activeQuality === quality.key, 'is-dim': !qualityCounts.get(quality.key) }"
					:style="{ '--ring': quality.ring }"
					type="button"
					:title="`${quality.label}品质 · ${qualityCounts.get(quality.key) ?? 0} 个模型`"
					@click="activeQuality = activeQuality === quality.key ? '' : quality.key"
				>
					<span class="codex-medal-core" :class="{ 'is-long': quality.label.length > 1 }">{{ quality.label }}</span>
					<span v-if="qualityCounts.get(quality.key)" class="codex-medal-count">{{ qualityCounts.get(quality.key) }}</span>
				</button>
			</div>

			<div class="codex-divider">
				<i class="codex-divider-line" aria-hidden="true" />
				<span class="codex-divider-text">品质由左到右，由高到低排序{{ activeCategory ? ` · ${activeCategory}` : '' }}</span>
				<i class="codex-divider-line" aria-hidden="true" />
			</div>

			<!-- 挂杆：呼应原图里「卡牌挂在木杆上」的形态 -->
			<div class="codex-shelf" aria-hidden="true">
				<i v-for="n in 5" :key="`shelf-${n}`" />
			</div>

			<!-- 卡牌网格 -->
			<ul v-if="visibleModels.length" class="codex-grid">
				<li v-for="item in visibleModels" :key="item.path">
					<UtilLink
						:to="item.path"
						class="codex-card"
						:title="item.title"
						@pointerenter="warmModel(item)"
						@focus="warmModel(item)"
					>
						<div class="codex-portrait">
							<img
								v-if="portraitOf(item)"
								:src="portraitOf(item)"
								:alt="displayName(item)"
								loading="lazy"
							>
							<span v-else class="codex-portrait-empty">
								<Icon name="ph:circle-notch-bold" class="codex-spin" />
								<em>{{ item.ModelName }}</em>
							</span>
							<span
								class="codex-portrait-glow"
								aria-hidden="true"
								:style="{ '--quality-ring': qualityRing(item) }"
							/>
						</div>

						<span class="codex-own" :class="isOwned(item) ? 'is-own' : 'is-lack'">
							{{ isOwned(item) ? '已拥有' : '未拥有' }}
						</span>

						<div class="codex-plate" :style="{ '--quality-ring': qualityRing(item) }">
							<strong>{{ displayName(item) }}</strong>
							<em>{{ item.ModelName }}</em>
						</div>
					</UtilLink>
				</li>

				<li v-for="n in emptySlots" :key="`slot-${n}`" class="codex-slot" aria-hidden="true">
					<div class="codex-slot-card">
						<span class="codex-own is-lack">未拥有</span>
						<span class="codex-slot-face">
							<Icon name="ph:user-focus-bold" />
						</span>
						<span class="codex-slot-plate">待收录</span>
					</div>
				</li>
			</ul>

			<div v-else class="codex-empty">
				<Icon name="ph:cube-bold" />
				<p>当前筛选下没有模型</p>
				<span>换一个品质或分类，或在 content/spine 下新建 type: model 的文章</span>
			</div>

			<p v-if="total && done < total" class="codex-progress">
				缩略图 {{ done }}/{{ total }}
			</p>
		</main>

		<!-- 右栏：分类导航 -->
		<nav class="codex-rail is-right" aria-label="模型分类">
			<button
				class="codex-nav"
				:class="{ 'is-active': !activeCategory }"
				type="button"
				@click="activeCategory = ''"
			>
				<Icon name="ph:circles-four-bold" />
				<span class="codex-nav-text">全部</span>
			</button>
			<button
				v-for="category in categories"
				:key="category.name"
				class="codex-nav"
				:class="{ 'is-active': activeCategory === category.name, 'is-dim': !category.count }"
				type="button"
				@click="activeCategory = activeCategory === category.name ? '' : category.name"
			>
				<span v-if="category.count" class="codex-nav-dot" />
				<Icon :name="category.icon" />
				<span class="codex-nav-text">{{ category.name }}</span>
			</button>

			<span class="codex-nav-sep" aria-hidden="true" />

			<UtilLink
				v-for="tool in tools"
				:key="tool.url"
				class="codex-nav is-tool"
				:class="{ 'is-active': isLocalRoute }"
				:to="tool.url"
			>
				<Icon :name="tool.icon" />
				<span class="codex-nav-text">{{ tool.label }}</span>
			</UtilLink>

			<a class="codex-nav is-tool" href="/spine-ui/board.html" target="_blank" rel="noopener">
				<Icon name="ph:palette-bold" />
				<span class="codex-nav-text">UI 规范</span>
			</a>
		</nav>
	</div>
</div>
</template>

<style lang="scss" scoped>
.codex {
	--wood-0: #1B0F08;
	--wood-1: #2C1A10;
	--wood-2: #3E2615;
	--wood-3: #55351D;
	--gold: #E9C584;
	--gold-2: #C79A57;
	--gold-3: #8A6234;
	--ink: #F3E3C6;
	--ink-dim: #C9AC82;

	display: flex;
	flex-direction: column;
	position: relative;
	overflow: hidden;
	min-height: 62vh;
	margin: 0.75rem;
	padding: 0.7rem 0.9rem 1.1rem;
	border: 2px solid var(--gold-3);
	border-color: #6B4526;
	border-radius: 14px;
	box-shadow:
		inset 0 0 70px rgb(0 0 0 / 55%),
		inset 0 1px 0 rgb(255 214 160 / 18%),
		0 18px 42px rgb(0 0 0 / 22%);
	background:
		url("/spine-ui/bg-hall.svg") center / 100% 100% no-repeat,
		radial-gradient(120% 80% at 50% 0%, var(--wood-3) 0%, var(--wood-2) 38%, var(--wood-1) 70%, var(--wood-0) 100%);
	color: var(--ink);

	/* 内描金 + 四边压暗 */
	&::before {
		content: "";
		position: absolute;
		inset: 0;
		border-radius: inherit;
		box-shadow:
			inset 0 0 0 1px rgb(233 197 132 / 16%),
			inset 0 0 64px rgb(0 0 0 / 52%);
		pointer-events: none;
		z-index: 0;
	}
}

/* 四角金饰 */
.codex-corner {
	position: absolute;
	opacity: 0.8;
	width: 3.6rem;
	height: 3.6rem;
	background: url("/spine-ui/corner-ornament.svg") center / 100% 100% no-repeat;
	pointer-events: none;
	z-index: 1;

	&.is-tl {
		top: 2px;
		left: 2px;
	}

	&.is-tr {
		top: 2px;
		right: 2px;
		transform: rotate(90deg);
	}

	&.is-bl {
		bottom: 2px;
		left: 2px;
		transform: rotate(-90deg);
	}

	&.is-br {
		right: 2px;
		bottom: 2px;
		transform: rotate(180deg);
	}
}

/* ── 顶栏 ── */
.codex-top {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 0.8rem;
	position: relative;
	padding-bottom: 0.55rem;
	border-bottom: 1px solid rgb(233 197 132 / 22%);
	z-index: 2;
}

.codex-title {
	display: flex;
	align-items: center;
	gap: 0.6rem;
	min-width: 0;
}

.codex-plaque {
	display: flex;
	align-items: center;
	padding: 0.15rem 1.5rem 0.2rem;
	background: url("/spine-ui/plaque.svg") center / 100% 100% no-repeat;

	h1 {
		margin: 0;
		font-family: var(--font-serif, serif);
		font-size: clamp(1.1rem, 2.2vw, 1.5rem);
		font-weight: 800;
		letter-spacing: 0.14em;
		white-space: nowrap;
		text-shadow: 0 1px 0 #000, 0 0 14px rgb(233 197 132 / 35%);
		color: var(--gold);
	}
}

.codex-seal {
	display: grid;
	place-items: center;
	width: 1.9rem;
	height: 1.9rem;
	border: 1px solid var(--gold-2);
	border-radius: 0.35rem;
	box-shadow: inset 0 0 8px rgb(0 0 0 / 60%);
	background: linear-gradient(160deg, #6B3F1F, #3A2110);
	font-size: 1rem;
	color: var(--gold);
}

.codex-help {
	display: grid;
	place-items: center;
	width: 1.05rem;
	height: 1.05rem;
	border: 1px solid rgb(233 197 132 / 55%);
	border-radius: 50%;
	font-size: 0.62rem;
	font-weight: 700;
	color: var(--gold);
	cursor: help;
}

.codex-stats {
	display: flex;
	align-items: center;
	gap: 0.75rem;
	font-size: 0.78rem;
	color: var(--gold);
	font-variant-numeric: tabular-nums;
}

.codex-stat {
	display: inline-flex;
	align-items: center;
	gap: 0.3rem;
	white-space: nowrap;
}

.codex-gem {
	width: 0.62rem;
	height: 0.62rem;
	border-radius: 1px;
	box-shadow: 0 0 6px currentcolor;
	transform: rotate(45deg);

	&.is-blue {
		background: linear-gradient(135deg, #7FB8FF, #2C6BD6);
		color: #7FB8FF;
	}

	&.is-gold {
		background: linear-gradient(135deg, #FFDD9A, #C68A2B);
		color: #FFDD9A;
	}

	&.is-jade {
		background: linear-gradient(135deg, #9BEBC3, #2E9E72);
		color: #9BEBC3;
	}
}

.codex-icon-btn {
	display: grid;
	place-items: center;
	width: 1.75rem;
	height: 1.75rem;
	border: 1px solid var(--gold-3);
	border-radius: 0.35rem;
	background: linear-gradient(160deg, #5A361A, #2C190E);
	font-size: 0.95rem;
	text-decoration: none;
	color: var(--gold);
	transition: border-color 0.2s ease, color 0.2s ease;

	&:hover {
		border-color: var(--gold);
		color: #FFF0D2;
	}
}

/* ── 主体：内容 + 右栏分类 ── */
.codex-body {
	display: grid;
	flex: 1;
	grid-template-columns: minmax(0, 1fr) 7.2rem;
	gap: 0.9rem;
	position: relative;
}

/* 中间主区 */
.codex-main {
	min-width: 0;
	padding-top: 0.35rem;
}

/* 品质圆钮：一整条品质阶梯（宽度铺满，缺内容的品质变暗） */
.codex-medals {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 0.6rem;
	overflow-x: auto;
	width: 100%;
	margin: 0.1rem 0 0;
	padding: 0.62rem 2.1rem;
	background: url("/spine-ui/bar-quality.svg") center / 100% 100% no-repeat;
	scrollbar-width: none;
	filter: drop-shadow(0 8px 18px rgb(0 0 0 / 35%));

	&::-webkit-scrollbar { display: none; }
}

.codex-medal {
	display: flex;
	flex: none;
	position: relative;
	padding: 0;
	border: none;
	background: none;
	cursor: pointer;
}

.codex-medal-core {
	display: grid;
	place-items: center;
	width: 2.9rem;
	height: 2.9rem;
	border: none;
	border-radius: 50%;
	box-shadow:
		0 4px 10px rgb(0 0 0 / 45%),
		inset 0 0 0 1px rgb(0 0 0 / 35%);
	background:
		url("/spine-ui/medal-ring.svg") center / 100% 100% no-repeat,
		radial-gradient(circle at 50% 26%, #FFFDF4 0%, color-mix(in oklab, var(--ring, #C79A57) 42%, #FFF6E2) 46%, color-mix(in oklab, var(--ring, #C79A57) 82%, #7A4E1E) 100%);
	font-size: 0.82rem;
	font-weight: 800;
	letter-spacing: 0;
	text-shadow: 0 1px 0 rgb(255 255 255 / 55%);
	color: color-mix(in oklab, var(--ring, #8A5A28) 42%, #2A160C);
	transition: transform 0.2s ease, box-shadow 0.2s ease, color 0.2s ease;
}

.codex-medal:hover .codex-medal-core {
	transform: translateY(-2px);
}

.codex-medal.is-active .codex-medal-core {
	box-shadow:
		0 0 18px rgb(255 213 138 / 70%),
		0 0 0 2px rgb(255 226 178 / 55%);
	background:
		url("/spine-ui/medal-ring.svg") center / 100% 100% no-repeat,
		radial-gradient(circle at 50% 30%, #FFEBC2, #D9A85C 62%, #8A5C25);
	color: #33200E;
}

/* 该品质下暂无模型：变暗但仍可点击查看空态 */
.codex-medal-core.is-long {
	font-size: 0.62rem;
	letter-spacing: -0.02em;
}

.codex-medal.is-dim .codex-medal-core {
	opacity: 0.62;
	filter: saturate(0.8);
}

.codex-medal-count {
	position: absolute;
	right: 0.05rem;
	bottom: -0.02rem;
	min-width: 0.85rem;
	padding: 0 0.14rem;
	border: 1px solid rgb(58 36 16 / 45%);
	border-radius: 999px;
	box-shadow: 0 1px 3px rgb(0 0 0 / 50%);
	background: linear-gradient(180deg, #FBEBC6, #C79A57);
	font-size: 0.52rem;
	font-weight: 800;
	line-height: 0.85rem;
	text-align: center;
	color: #33200E;
}

/* 排序提示分割线 */
.codex-divider {
	display: flex;
	align-items: center;
	gap: 0.65rem;
	margin: 0.4rem 0 0.9rem;
}

.codex-divider-line {
	flex: 1;
	position: relative;
	height: 1px;
	background: linear-gradient(90deg, transparent, rgb(216 174 112 / 75%));

	&::after {
		content: "";
		position: absolute;
		top: 50%;
		right: -2px;
		width: 6px;
		height: 6px;
		box-shadow: 0 0 7px rgb(233 197 132 / 45%);
		background: linear-gradient(135deg, #FCE7BC, #B37F3E);
		transform: translateY(-50%) rotate(45deg);
	}

	&:last-child {
		background: linear-gradient(270deg, transparent, rgb(216 174 112 / 75%));

		&::after {
			right: auto;
			left: -2px;
		}
	}
}

.codex-divider-text {
	font-size: 0.68rem;
	letter-spacing: 0.12em;
	white-space: nowrap;
	color: var(--ink-dim);
}

/* 挂杆 */
.codex-shelf {
	display: flex;
	align-items: center;
	justify-content: space-around;
	height: 0.7rem;
	margin: 0 -0.2rem 0.45rem;
	border-top: 1px solid rgb(233 197 132 / 55%);
	border-bottom: 1px solid rgb(0 0 0 / 65%);
	box-shadow:
		0 4px 10px rgb(0 0 0 / 40%),
		inset 0 1px 0 rgb(255 226 178 / 25%);
	background: linear-gradient(180deg, #7A4A28, #4A2716 45%, #2A150C);

	i {
		width: 6px;
		height: 6px;
		box-shadow: 0 0 7px rgb(233 197 132 / 55%);
		background: linear-gradient(135deg, #FCE7BC, #B37F3E);
		transform: rotate(45deg);
	}
}

/* 卡牌网格 */
.codex-grid {
	display: grid;
	grid-template-columns: repeat(4, minmax(0, 1fr));
	gap: 0.7rem;
	margin: 0;
	padding: 0;
	list-style: none;
}

.codex-card {
	display: flex;
	flex-direction: column;
	position: relative;
	padding: 0.42rem;
	border: none;
	border-radius: 0.5rem;
	box-shadow:
		0 10px 22px rgb(0 0 0 / 42%),
		0 0 0 1px rgb(0 0 0 / 55%);
	background: linear-gradient(180deg, #5C3618, #31190D 55%, #1E0F07);
	text-decoration: none;
	color: inherit;
	transition: transform 0.24s ease, box-shadow 0.24s ease;

	/* 金框图（含四角回纹与顶部挂坠） */
	&::before {
		content: "";
		position: absolute;
		inset: -3px;
		background: url("/spine-ui/frame-card.svg") center / 100% 100% no-repeat;
		pointer-events: none;
		z-index: 4;
	}

	&:hover {
		box-shadow:
			0 16px 30px rgb(0 0 0 / 55%),
			0 0 22px rgb(233 197 132 / 32%);
		transform: translateY(-4px);

		.codex-portrait-glow { opacity: 0.9; }

		.codex-portrait img { transform: scale(1.3); }
	}
}

/* 已拥有 / 未拥有 角标 */
.codex-own {
	display: grid;
	place-items: center;
	position: absolute;
	top: -0.1rem;
	right: 0.28rem;
	width: 1.45rem;
	height: 3.8rem;
	padding: 0.28rem 0 1rem;
	background: url("/spine-ui/ribbon-owned.svg") center / 100% 100% no-repeat;
	font-size: 0.6rem;
	font-weight: 700;
	letter-spacing: 0.14em;
	line-height: 1.15;
	text-align: center;
	text-shadow: 0 1px 2px rgb(0 0 0 / 55%);
	color: #EAF7E4;
	filter: drop-shadow(0 3px 5px rgb(0 0 0 / 45%));
	writing-mode: vertical-rl;
	z-index: 5;

	&.is-lack {
		background-image: url("/spine-ui/ribbon-locked.svg");
		color: #FFE6DF;
	}
}

/* 立绘区 */
.codex-portrait {
	position: relative;
	overflow: hidden;
	aspect-ratio: 3 / 4;
	border: 1px solid rgb(0 0 0 / 60%);
	border-radius: 0.3rem;
	box-shadow: inset 0 0 18px rgb(0 0 0 / 70%);
	background: radial-gradient(80% 60% at 50% 30%, #4A2C17, #1B0E07 75%);

	/* 顶部/底部压暗，衬托绶带与铭牌 */
	&::after {
		content: "";
		position: absolute;
		inset: 0;
		background: linear-gradient(180deg, rgb(0 0 0 / 38%) 0%, transparent 26%, transparent 64%, rgb(0 0 0 / 62%) 100%);
		pointer-events: none;
	}

	img {
		display: block;
		width: 100%;
		height: 100%;

		/* 立绘多为带暗边的整幅插画，放大一点让主体更满卡面 */
		transform: scale(1.22);
		transition: transform 0.35s ease;
		object-fit: cover;
		object-position: center 34%;
	}
}

.codex-portrait-glow {
	position: absolute;
	opacity: 0;
	inset: 0;
	background: radial-gradient(70% 55% at 50% 42%, color-mix(in oklab, var(--quality-ring, #FFD896) 30%, transparent), transparent 70%);
	transition: opacity 0.25s ease;
	pointer-events: none;
}

.codex-portrait-empty {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 0.35rem;
	position: absolute;
	inset: 0;
	font-size: 1.3rem;
	color: var(--gold-3);

	em {
		font-size: 0.66rem;
		font-style: normal;
		letter-spacing: 0.04em;
	}
}

.codex-spin {
	animation: codex-spin 1s linear infinite;
}

@keyframes codex-spin {
	to { transform: rotate(360deg); }
}

/* 名字绶带 */
.codex-plate {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 0.05rem;
	position: relative;
	margin-top: 0.32rem;
	padding: 0.42rem 0.6rem 0.5rem;
	background: url("/spine-ui/plate-name.svg") center / 100% 100% no-repeat;
	filter: drop-shadow(0 3px 6px rgb(0 0 0 / 45%));

	strong {
		overflow: hidden;
		max-width: 100%;
		font-family: var(--font-serif, serif);
		font-size: 0.95rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		white-space: nowrap;
		text-overflow: ellipsis;
		text-shadow: 0 1px 0 #000;
		color: #F6E3BC;
	}

	em {
		overflow: hidden;
		max-width: 100%;
		font-size: 0.6rem;
		font-style: normal;
		letter-spacing: 0.02em;
		white-space: nowrap;
		text-overflow: ellipsis;
		color: rgb(201 172 130 / 75%);
		font-variant-numeric: tabular-nums;
	}
}

/* 待收录占位格：做成「未拥有」暗卡，和真卡同尺寸 */
.codex-slot {
	display: flex;
	min-width: 0;
}

.codex-slot-card {
	display: flex;
	flex: 1;
	flex-direction: column;
	position: relative;
	padding: 0.42rem;
	border: none;
	border-radius: 0.5rem;
	box-shadow:
		inset 0 0 18px rgb(0 0 0 / 70%),
		0 8px 18px rgb(0 0 0 / 30%);
	background: linear-gradient(180deg, #2C1A0E, #180D06 60%, #110804);

	&::before {
		content: "";
		position: absolute;
		opacity: 0.4;
		inset: -3px;
		background: url("/spine-ui/frame-card.svg") center / 100% 100% no-repeat;
		pointer-events: none;
	}
}

.codex-slot-face {
	display: grid;
	place-items: center;
	aspect-ratio: 3 / 4;
	border: 1px solid rgb(0 0 0 / 60%);
	border-radius: 0.3rem;
	background:
		radial-gradient(80% 60% at 50% 34%, rgb(96 62 36 / 45%), transparent 72%),
		linear-gradient(180deg, #241307, #150A05);
	font-size: 2rem;
	color: rgb(199 154 87 / 20%);
}

.codex-slot-plate {
	margin-top: 0.3rem;
	padding: 0.34rem 0.4rem 0.4rem;
	border-top: 1px solid rgb(199 154 87 / 18%);
	background: linear-gradient(180deg, #3A2213, #241308);
	font-family: var(--font-serif, serif);
	font-size: 0.8rem;
	font-weight: 700;
	letter-spacing: 0.2em;
	text-align: center;
	color: rgb(201 172 130 / 58%);
}

/* 空态 */
.codex-empty {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 0.35rem;
	padding: 3rem 1rem;
	text-align: center;
	color: var(--ink-dim);

	> :first-child {
		opacity: 0.6;
		font-size: 2.6rem;
	}

	p {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 600;
		color: var(--gold);
	}

	span {
		opacity: 0.8;
		font-size: 0.72rem;
	}
}

.codex-progress {
	margin: 0.6rem 0 0;
	font-size: 0.64rem;
	text-align: right;
	color: rgb(201 172 130 / 55%);
	font-variant-numeric: tabular-nums;
}

/* ── 右栏导航 ── */
.codex-rail.is-right {
	display: flex;
	flex-direction: column;
	align-self: stretch;
	gap: 0.08rem;
	padding: 0.55rem 0.5rem;
	border: 1px solid rgb(122 69 38 / 55%);
	border-radius: 0.6rem;
	box-shadow:
		inset 0 1px 0 rgb(255 226 178 / 14%),
		inset 0 0 0 1px rgb(233 197 132 / 10%),
		0 10px 22px rgb(0 0 0 / 28%);
	background:
		linear-gradient(180deg, rgb(74 40 22 / 82%) 0%, rgb(32 16 9 / 86%) 100%),
		repeating-linear-gradient(0deg, rgb(255 255 255 / 2%) 0 1px, transparent 1px 6px);
}

.codex-nav {
	display: flex;
	align-items: center;
	gap: 0.4rem;
	position: relative;
	padding: 0.5rem 0.35rem;
	border: none;
	border-bottom: 1px solid rgb(199 154 87 / 16%);
	border-radius: 0.35rem;
	background: transparent;
	font-size: 0.83rem;
	letter-spacing: 0.06em;
	text-align: left;
	text-decoration: none;
	color: var(--ink-dim);
	transition: background 0.2s ease, color 0.2s ease;
	cursor: pointer;

	&:last-of-type {
		border-bottom: none;
	}

	&:hover {
		background: rgb(255 214 160 / 10%);
		color: var(--gold);
	}

	&.is-active {
		box-shadow: inset 2px 0 0 var(--gold);
		background: linear-gradient(90deg, rgb(233 197 132 / 18%), transparent);
		font-weight: 700;
		color: var(--gold);
	}

	/* 该分类下暂无模型 */
	&.is-dim:not(.is-active) {
		opacity: 0.42;
	}
}

.codex-nav-dot {
	position: absolute;
	top: 0.3rem;
	right: 0.25rem;
	width: 0.32rem;
	height: 0.32rem;
	border-radius: 50%;
	box-shadow: 0 0 6px #E4534A;
	background: #E4534A;
}

.codex-nav-text {
	overflow: hidden;
	white-space: nowrap;
	text-overflow: ellipsis;
}

.codex-nav-sep {
	height: 1px;
	margin: 0.35rem 0.25rem;
	background: linear-gradient(90deg, transparent, rgb(199 154 87 / 45%), transparent);
}

/* ── 响应式 ── */
@media (max-width: 1200px) {
	.codex-grid {
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}
}

@media (max-width: 900px) {
	/* 移动端隐藏左右装饰栏，分类改到网格上方 */
	.codex-body {
		grid-template-columns: minmax(0, 1fr);
	}

	.codex-rail.is-right {
		flex: none;
		flex-flow: row wrap;
		align-items: center;
		align-self: start;
		gap: 0.2rem;
		padding: 0.3rem;
	}

	.codex-nav {
		padding: 0.3rem 0.5rem;
		border-bottom: none;
	}

	.codex-nav-sep {
		display: none;
	}

	.codex {
		margin: 0.5rem;
		padding: 0.55rem 0.6rem 0.9rem;
	}

	.codex-stats {
		gap: 0.5rem;
		font-size: 0.7rem;
	}

	.codex-medal-core {
		width: 2.3rem;
		height: 2.3rem;
		font-size: 0.66rem;
	}

	.codex-divider {
		font-size: 0.64rem;
		letter-spacing: 0.04em;
	}
}

@media (max-width: 700px) {
	.codex-grid {
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.55rem;
	}

	/* 移动端只补两行空位，避免页面过长 */
	.codex-grid > .codex-slot:nth-child(n+7) {
		display: none;
	}
}
</style>
