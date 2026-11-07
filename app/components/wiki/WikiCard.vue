<!--
  WikiCard.vue — 文档卡片

  复刻 Stellar 主题 wiki 列表的横向卡片：左侧方形预览图，右侧分类标签 + 标题 + 摘要。
-->
<script setup lang="ts">
import type { ArticleProps } from '~/types/article'

const props = defineProps<{
	item: ArticleProps
}>()

const categoryLabel = computed(() => props.item.categories?.[0] || '未分类')
</script>

<template>
<UtilLink class="wiki-card" :to="item.path" :title="item.title">
	<span class="wiki-card-preview" :class="{ 'is-empty': !item.image }">
		<img v-if="item.image" :src="item.image" :alt="item.title" loading="lazy">
		<Icon v-else name="ph:file-text-bold" />
	</span>

	<span class="wiki-card-body">
		<span class="wiki-card-cap">{{ categoryLabel }}</span>
		<strong class="wiki-card-title">{{ item.title }}</strong>
		<span class="wiki-card-desc">{{ item.description || '暂无摘要' }}</span>
	</span>

	<Icon class="wiki-card-arrow" name="ph:arrow-up-right-bold" />
</UtilLink>
</template>

<style lang="scss" scoped>
.wiki-card {
	display: grid;
	grid-template-columns: 8rem minmax(0, 1fr) auto;
	align-items: center;
	gap: 1.1rem;
	position: relative;
	padding: 1.05rem 1.2rem;
	border: 1px solid var(--c-border);
	border-radius: 1rem;
	box-shadow: 0 1px 2px rgb(0 0 0 / 4%);
	background: var(--c-bg-1);
	text-decoration: none;
	color: inherit;
	transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease;

	&:hover {
		border-color: var(--c-primary-soft);
		box-shadow: 0 10px 28px rgb(0 0 0 / 8%);
		transform: translateY(-2px);

		.wiki-card-arrow {
			opacity: 1;
			transform: translate(0, 0);
		}
	}
}

.wiki-card-preview {
	display: grid;
	place-items: center;
	overflow: hidden;
	aspect-ratio: 16 / 10;
	border-radius: 0.75rem;
	background: var(--c-bg-2);
	font-size: 1.6rem;
	color: var(--c-text-3);

	img {
		display: block;
		width: 100%;
		height: 100%;
		background: var(--c-bg-2);

		/* 封面多为横幅，方形预览格里用 contain 保留完整构图 */
		object-fit: contain;
	}
}

.wiki-card-body {
	display: flex;
	flex-direction: column;
	gap: 0.3rem;
	min-width: 0;
}

.wiki-card-cap {
	align-self: flex-start;
	padding: 0.1rem 0.45rem;
	border-radius: 999px;
	background: var(--c-bg-2);
	font-size: 0.68rem;
	font-weight: 600;
	letter-spacing: 0.02em;
	color: var(--c-text-3);
}

.wiki-card-title {
	overflow: hidden;
	font-size: 1.16rem;
	font-weight: 700;
	line-height: 1.45;
	white-space: nowrap;
	text-overflow: ellipsis;
	color: var(--c-text-1);
}

.wiki-card-desc {
	display: -webkit-box;
	overflow: hidden;
	font-size: 0.82rem;
	-webkit-line-clamp: 2;
	line-height: 1.6;
	color: var(--c-text-3);
	-webkit-box-orient: vertical;
}

.wiki-card-arrow {
	opacity: 0;
	font-size: 1rem;
	color: var(--c-primary);
	transform: translate(-4px, 4px);
	transition: opacity 0.22s ease, transform 0.22s ease;
}

@media (max-width: 700px) {
	.wiki-card {
		grid-template-columns: 3.6rem minmax(0, 1fr);
		gap: 0.75rem;
		padding: 0.85rem;
	}

	.wiki-card-title {
		font-size: 1rem;
	}

	.wiki-card-arrow {
		display: none;
	}
}
</style>
