<!--
  PostTypeBadge.vue — 文章类型徽章

  类型标签来自 blog.config 的 article.types[type].label，
  用于在列表与详情页显式展示文章类型（技术 / 故事 / 模型）。
-->
<script setup lang="ts">
const props = withDefaults(defineProps<{
	type?: string
	/** 是否为紧凑形态（列表卡片内） */
	compact?: boolean
}>(), {
	type: undefined,
	compact: false,
})

const label = computed(() => getArticleTypeLabel(props.type))
</script>

<template>
<span v-if="label" class="post-type-badge" :class="[`is-${type}`, { 'is-compact': compact }]">
	<Icon name="ph:shapes-bold" class="post-type-badge-icon" />
	{{ label }}
</span>
</template>

<style lang="scss" scoped>
.post-type-badge {
	display: inline-flex;
	align-items: center;
	gap: 0.25rem;
	padding: 0.15rem 0.5rem;
	border: 1px solid var(--c-primary-soft);
	border-radius: 999px;
	background: var(--c-primary-soft);
	font-size: 0.72rem;
	font-weight: 600;
	letter-spacing: 0.02em;
	white-space: nowrap;
	color: var(--c-primary);

	&.is-compact {
		padding: 0.1rem 0.4rem;
		font-size: 0.68rem;
	}

	&.is-model {
		border-color: #7A6BFF33;
		background: #7A6BFF22;
		color: #6E5DFF;
	}
}

.post-type-badge-icon {
	opacity: 0.85;
	font-size: 0.8em;
}

:global(.dark) .post-type-badge.is-model {
	border-color: #A79CFF55;
	background: #A79CFF22;
	color: #B3A8FF;
}
</style>
