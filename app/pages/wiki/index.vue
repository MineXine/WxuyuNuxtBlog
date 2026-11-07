<!--
  /wiki — 文档首页

  版式参考 Stellar 主题的 wiki 列表：
    顶部胶囊标签栏（所有分类）→ 纵向排列的横向卡片（预览图 + 分类 + 标题 + 摘要）。
  数据源：type 为 wiki 的内容文章（content/wiki/*.md），构建期取数并静态化（SSG）。
-->
<script setup lang="ts">
import type { ArticleProps } from '~/types/article'

useSeoMeta({
	title: '文档',
	description: '站点与模型相关的使用文档：模型接入、二进制骨架格式、站点魔改速查。',
})

const layoutStore = useLayoutStore()
// 文档页不挂小组件，让正文拿到完整宽度
layoutStore.setAside([])

const { data: listRaw } = await useAsyncData('index_wiki', () => useWikiIndexOptions(), { default: () => [] })
const { listSorted } = useArticleSort(listRaw)

const docs = computed(() => listSorted.value as ArticleProps[])

const categories = computed(() => {
	const names = docs.value.map(item => item.categories?.[0] || '未分类')
	return [...new Set(names)]
})

const activeCategory = ref('')
const visibleDocs = computed(() =>
	activeCategory.value
		? docs.value.filter(item => (item.categories?.[0] || '未分类') === activeCategory.value)
		: docs.value,
)
</script>

<template>
<div class="wiki">
	<header class="wiki-head">
		<h1>文档</h1>
		<p>{{ docs.length }} 篇 · 按分类浏览</p>
	</header>

	<nav class="wiki-tabs" aria-label="文档分类">
		<button
			class="wiki-tab"
			:class="{ 'is-active': !activeCategory }"
			type="button"
			@click="activeCategory = ''"
		>
			所有项目
		</button>
		<button
			v-for="category in categories"
			:key="category"
			class="wiki-tab"
			:class="{ 'is-active': activeCategory === category }"
			type="button"
			@click="activeCategory = activeCategory === category ? '' : category"
		>
			{{ category }}
		</button>
	</nav>

	<ul v-if="visibleDocs.length" class="wiki-list">
		<li v-for="doc in visibleDocs" :key="doc.path">
			<WikiCard :item="doc" />
		</li>
	</ul>

	<ZError
		v-else
		icon="ph:book-open-bold"
		title="还没有文档"
	>
		<p class="wiki-empty-tip">
			在 content/wiki 下新建文章并设置 <code>type: wiki</code> 即可出现在这里。
		</p>
	</ZError>
</div>
</template>

<style lang="scss" scoped>
.wiki {
	min-width: 0;
	margin: 1rem;
}

.wiki-head {
	display: flex;
	flex-wrap: wrap;
	align-items: baseline;
	gap: 0.6rem;
	margin-bottom: 0.85rem;

	h1 {
		margin: 0;
		font-size: 1.5rem;
		font-weight: 700;
	}

	p {
		margin: 0;
		font-size: 0.8rem;
		color: var(--c-text-3);
	}
}

.wiki-tabs {
	display: flex;
	flex-wrap: wrap;
	gap: 0.3rem;
	margin-bottom: 1rem;
	padding: 0.32rem;
	border: 1px solid var(--c-border);
	border-radius: 0.8rem;
	box-shadow: 0 1px 2px rgb(0 0 0 / 4%);
	background: var(--c-bg-1);
}

.wiki-tab {
	padding: 0.35rem 0.8rem;
	border: none;
	border-radius: 0.55rem;
	background: transparent;
	font-size: 0.84rem;
	color: var(--c-text-3);
	transition: background 0.18s ease, color 0.18s ease;
	cursor: pointer;

	&:hover {
		background: var(--c-bg-2);
		color: var(--c-text-1);
	}

	&.is-active {
		background: var(--c-bg-2);
		font-weight: 700;
		color: var(--c-text-1);
	}
}

.wiki-list {
	display: flex;
	flex-direction: column;
	gap: 0.9rem;
	margin: 0;
	padding: 0;
	list-style: none;
}

.wiki-empty-tip {
	margin: 0;
	font-size: 0.82rem;
	line-height: 1.7;
	color: var(--c-text-3);

	code {
		padding: 0.1rem 0.3rem;
		border-radius: 0.25rem;
		background: var(--c-bg-2);
		font-size: 0.78rem;
	}
}

@media (max-width: 700px) {
	.wiki {
		margin: 0.6rem 0.75rem;
	}

	.wiki-head h1 {
		font-size: 1.2rem;
	}

	.wiki-tabs {
		gap: 0.2rem;
	}
}
</style>
