<!--
  WikiDocTree.vue — 文档树

  左侧固定栏：按分类分组列出全部文档，当前文档高亮并展开其标题（h2/h3）。
-->
<script setup lang="ts">
import type { Toc, TocLink } from '@nuxt/content'
import type { ArticleProps } from '~/types/article'

const props = withDefaults(defineProps<{
	docs: ArticleProps[]
	current?: string
	toc?: Toc
}>(), {
	current: '',
	toc: undefined,
})

const groups = computed(() => {
	const map = new Map<string, ArticleProps[]>()
	for (const doc of props.docs) {
		const key = doc.categories?.[0] || '未分类'
		map.set(key, [...(map.get(key) ?? []), doc])
	}
	return Array.from(map.entries(), ([name, items]) => ({ name, items }))
})

/** 只展开两级标题，避免目录过长 */
const tocItems = computed(() => {
	const out: TocLink[] = []
	const walk = (links?: TocLink[]) => {
		for (const link of links ?? []) {
			if (link.depth <= 2)
				out.push(link)
			if (link.children?.length)
				walk(link.children)
		}
	}
	walk(props.toc?.links)
	return out
})
</script>

<template>
<nav class="doc-tree" aria-label="文档目录">
	<p class="doc-tree-head">
		<Icon name="ph:list-bullets-bold" />
		文档目录
	</p>

	<div v-for="group in groups" :key="group.name" class="doc-tree-group">
		<p class="doc-tree-group-name">
			{{ group.name }}
		</p>

		<template v-for="doc in group.items" :key="doc.path">
			<UtilLink
				class="doc-tree-link"
				:class="{ 'is-active': doc.path === current }"
				:to="doc.path"
			>
				<span class="doc-tree-dot" />
				<span class="doc-tree-text">{{ doc.title }}</span>
			</UtilLink>

			<ul v-if="doc.path === current && tocItems.length" class="doc-tree-toc">
				<li v-for="item in tocItems" :key="item.id">
					<a :href="`#${item.id}`" :class="{ 'is-sub': item.depth > 1 }">{{ item.text }}</a>
				</li>
			</ul>
		</template>
	</div>
</nav>
</template>

<style lang="scss" scoped>
.doc-tree {
	padding: 0.8rem 0.7rem;
	border: 1px solid var(--c-border);
	border-radius: 0.9rem;
	background: var(--c-bg-1);

	/* 顶部与内容区留白一致 */
	font-size: 0.8rem;
}

.doc-tree-head {
	display: flex;
	align-items: center;
	gap: 0.35rem;
	margin: 0 0 0.6rem;
	padding: 0 0.35rem;
	font-size: 0.75rem;
	font-weight: 700;
	letter-spacing: 0.08em;
	color: var(--c-text-3);
}

.doc-tree-group + .doc-tree-group {
	margin-top: 0.75rem;
	padding-top: 0.7rem;
	border-top: 1px dashed var(--c-border);
}

.doc-tree-group-name {
	opacity: 0.85;
	margin: 0 0 0.3rem;
	padding: 0 0.35rem;
	font-size: 0.7rem;
	color: var(--c-text-3);
}

.doc-tree-link {
	display: flex;
	align-items: center;
	gap: 0.45rem;
	padding: 0.34rem 0.45rem;
	border-radius: 0.45rem;
	line-height: 1.5;
	text-decoration: none;
	color: var(--c-text-2);
	transition: background 0.18s ease, color 0.18s ease;

	&:hover {
		background: var(--c-bg-2);
		color: var(--c-text-1);
	}

	&.is-active {
		background: var(--c-primary-soft);
		font-weight: 700;
		color: var(--c-primary);

		.doc-tree-dot {
			box-shadow: 0 0 0 3px var(--c-primary-soft);
			background: var(--c-primary);
		}
	}
}

.doc-tree-dot {
	flex: none;
	width: 0.3rem;
	height: 0.3rem;
	border-radius: 50%;
	background: var(--c-border);
}

.doc-tree-text {
	overflow: hidden;
	white-space: nowrap;
	text-overflow: ellipsis;
}

.doc-tree-toc {
	display: flex;
	flex-direction: column;
	gap: 0.05rem;
	margin: 0.15rem 0 0.3rem;
	padding: 0 0 0 1.1rem;
	list-style: none;

	a {
		display: block;
		overflow: hidden;
		padding: 0.16rem 0.3rem;
		border-left: 2px solid var(--c-border);
		font-size: 0.74rem;
		white-space: nowrap;
		text-decoration: none;
		text-overflow: ellipsis;
		color: var(--c-text-3);
		transition: border-color 0.18s ease, color 0.18s ease;

		&:hover {
			border-color: var(--c-primary);
			color: var(--c-primary);
		}

		&.is-sub {
			opacity: 0.85;
			padding-left: 0.75rem;
			font-size: 0.7rem;
		}
	}
}
</style>
