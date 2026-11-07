<!--
  /wiki/{slug} — 文档详情

  版式参考 Stellar 主题的 wiki 文章页：
    面包屑 → 居中封面（图 + 标题 + 摘要 + 开始阅读）→ 左侧文档树 + 正文 → 上下篇。
  内容来自 content/wiki/*.md，页面在构建期静态生成（SSG）。
-->
<script setup lang="ts">
import type { Toc } from '@nuxt/content'
import type { ArticleProps } from '~/types/article'

const route = useRoute()
const layoutStore = useLayoutStore()
layoutStore.setAside([])

const slug = String(route.params.slug)

const { data: doc } = await useAsyncData(
	`wiki-doc-${slug}`,
	() => queryCollection('content').path(`/wiki/${slug}`).first(),
)

const { data: listRaw } = await useAsyncData('index_wiki', () => useWikiIndexOptions(), { default: () => [] })
const { listSorted } = useArticleSort(listRaw)
const docs = computed(() => listSorted.value as ArticleProps[])

const currentIndex = computed(() => docs.value.findIndex(item => item.path === doc.value?.path))
const prevDoc = computed(() => (currentIndex.value > 0 ? docs.value[currentIndex.value - 1] : null))
const nextDoc = computed(() => (currentIndex.value >= 0 && currentIndex.value < docs.value.length - 1
	? docs.value[currentIndex.value + 1]
	: null))

const toc = computed<Toc | undefined>(() => (doc.value?.body as { toc?: Toc } | undefined)?.toc)

if (doc.value) {
	useSeoMeta({
		title: doc.value.title,
		description: doc.value.description,
		ogType: 'article',
		ogImage: doc.value.image,
	})
}
else {
	const event = useRequestEvent()
	event && setResponseStatus(event, 404)
	route.meta.title = '404'
}
</script>

<template>
<div v-if="doc" class="wiki-doc">
	<nav class="wiki-crumb" aria-label="面包屑">
		<UtilLink to="/">
			主页
		</UtilLink>
		<Icon name="ph:caret-right-bold" />
		<UtilLink to="/wiki">
			文档
		</UtilLink>
		<Icon name="ph:caret-right-bold" />
		<span class="is-current">{{ doc.categories?.[0] || '未分类' }}</span>
	</nav>

	<header class="wiki-cover">
		<div v-if="doc.image" class="wiki-cover-art">
			<img :src="doc.image" :alt="doc.title">
		</div>
		<h1 class="wiki-cover-title">
			{{ doc.title }}
		</h1>
		<p v-if="doc.description" class="wiki-cover-desc">
			{{ doc.description }}
		</p>

		<div class="wiki-cover-meta">
			<UtilDate :date="doc.updated || doc.date" icon="ph:clock-counter-clockwise-bold" />
			<span class="wiki-cover-tag">{{ doc.categories?.[0] }}</span>
		</div>

		<a class="wiki-cta" href="#doc-content">
			开始阅读
			<Icon name="ph:arrow-down-bold" />
		</a>
	</header>

	<!-- 移动端：文档树折叠 -->
	<details class="wiki-tree-mobile">
		<summary>
			文档目录
			<Icon name="ph:caret-down-bold" />
		</summary>
		<WikiDocTree :docs="docs" :current="doc.path" :toc="toc" />
	</details>

	<div class="wiki-body">
		<aside class="wiki-tree">
			<WikiDocTree :docs="docs" :current="doc.path" :toc="toc" />
		</aside>

		<ContentRenderer
			id="doc-content"
			class="article wiki-article"
			:value="doc"
			tag="article"
		/>
	</div>

	<nav class="wiki-pager" aria-label="上下篇">
		<UtilLink v-if="prevDoc" class="wiki-pager-item" :to="prevDoc.path">
			<Icon name="ph:arrow-left-bold" />
			<span>
				<em>上一篇</em>
				<strong>{{ prevDoc.title }}</strong>
			</span>
		</UtilLink>
		<UtilLink v-if="nextDoc" class="wiki-pager-item is-next" :to="nextDoc.path">
			<span>
				<em>下一篇</em>
				<strong>{{ nextDoc.title }}</strong>
			</span>
			<Icon name="ph:arrow-right-bold" />
		</UtilLink>
	</nav>
</div>

<ZError
	v-else
	icon="solar:confounded-square-bold-duotone"
	title="文档不存在"
/>
</template>

<style lang="scss" scoped>
.wiki-doc {
	min-width: 0;
	margin: 1rem;
}

/* 面包屑 */
.wiki-crumb {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 0.3rem;
	margin-bottom: 0.9rem;
	font-size: 0.76rem;
	color: var(--c-text-3);

	:deep(a) {
		text-decoration: none;
		color: var(--c-text-3);

		&:hover {
			color: var(--c-primary);
		}
	}

	.is-current {
		font-weight: 700;
		color: var(--c-text-2);
	}

	> :deep(.icon), > svg {
		opacity: 0.6;
		font-size: 0.6rem;
	}
}

/* 封面 */
.wiki-cover {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 0.5rem;
	padding: 0.4rem 0 1.4rem;
	text-align: center;
}

.wiki-cover-art {
	overflow: hidden;
	width: min(100%, 30rem);
	aspect-ratio: 16 / 7;
	margin-bottom: 0.7rem;
	border: 1px solid var(--c-border);
	border-radius: 1.1rem;
	box-shadow: 0 12px 32px rgb(0 0 0 / 10%);

	img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
}

.wiki-cover-title {
	margin: 0;
	font-size: clamp(1.5rem, 3.2vw, 2rem);
	font-weight: 800;
	letter-spacing: 0.01em;
	line-height: 1.35;
}

.wiki-cover-desc {
	max-width: 36rem;
	margin: 0;
	font-size: 0.86rem;
	line-height: 1.7;
	color: var(--c-text-3);
}

.wiki-cover-meta {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	justify-content: center;
	gap: 0.5rem;
	font-size: 0.76rem;
	color: var(--c-text-3);
}

.wiki-cover-tag {
	padding: 0.08rem 0.45rem;
	border-radius: 999px;
	background: var(--c-bg-2);
	font-size: 0.7rem;
}

.wiki-cta {
	display: inline-flex;
	align-items: center;
	gap: 0.3rem;
	margin-top: 0.4rem;
	padding: 0.42rem 1.1rem;
	border-radius: 999px;
	background: var(--c-text-1);
	font-size: 0.8rem;
	font-weight: 600;
	text-decoration: none;
	color: var(--c-bg-1);
	transition: opacity 0.2s ease, transform 0.2s ease;

	&:hover {
		opacity: 0.85;
		transform: translateY(-1px);
	}
}

/* 文档树（移动端折叠） */
.wiki-tree-mobile {
	display: none;
	margin-bottom: 1rem;

	summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.55rem 0.8rem;
		border: 1px solid var(--c-border);
		border-radius: 0.7rem;
		background: var(--c-bg-1);
		font-size: 0.82rem;
		font-weight: 600;
		cursor: pointer;
	}

	&[open] summary {
		margin-bottom: 0.5rem;
	}
}

/* 正文两栏 */
.wiki-body {
	display: grid;
	grid-template-columns: 13.5rem minmax(0, 1fr);
	align-items: start;
	gap: 1.4rem;
}

.wiki-tree {
	position: sticky;
	top: 0.8rem;
}

.wiki-article {
	min-width: 0;
	margin: 0;
}

/* 上下篇 */
.wiki-pager {
	display: flex;
	flex-wrap: wrap;
	gap: 0.8rem;
	margin-top: 1.6rem;
}

.wiki-pager-item {
	display: flex;
	flex: 1;
	align-items: center;
	gap: 0.6rem;
	min-width: 12rem;
	padding: 0.7rem 0.9rem;
	border: 1px solid var(--c-border);
	border-radius: 0.8rem;
	background: var(--c-bg-1);
	font-size: 0.8rem;
	text-decoration: none;
	color: var(--c-text-2);
	transition: border-color 0.2s ease, transform 0.2s ease;

	&:hover {
		border-color: var(--c-primary-soft);
		transform: translateY(-1px);
	}

	&.is-next {
		justify-content: flex-end;
		text-align: right;
	}

	span {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	em {
		font-size: 0.68rem;
		font-style: normal;
		color: var(--c-text-3);
	}

	strong {
		overflow: hidden;
		font-size: 0.84rem;
		white-space: nowrap;
		text-overflow: ellipsis;
	}
}

@media (max-width: 900px) {
	.wiki-body {
		grid-template-columns: minmax(0, 1fr);
	}

	.wiki-tree {
		display: none;
	}

	.wiki-tree-mobile {
		display: block;

		:deep(.doc-tree) {
			margin-bottom: 0.6rem;
		}
	}
}

@media (max-width: 700px) {
	.wiki-doc {
		margin: 0.6rem 0.75rem;
	}

	.wiki-cover-art {
		aspect-ratio: 16 / 9;
	}
}
</style>
