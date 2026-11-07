<!--
  MemosCatNav.vue — 碎碎念标签导航

  版式：
  - 单行横向滚动、隐藏滚动条，作为筛选工具栏的左侧内容
  - 胶囊按钮：透明底 + 细边，选中态强调色填充
  - 切换时带一次轻微弹出动画
-->
<script setup lang="ts">
interface Props {
	/** 全部标签（去重后） */
	tags: string[]
	/** 当前选中的标签，空串表示「全部」 */
	active?: string
}

const props = withDefaults(defineProps<Props>(), {
	active: '',
})

const emit = defineEmits<{
	select: [tag: string]
}>()

const items = computed(() => [
	{ key: '', label: '全部' },
	...props.tags.map(tag => ({ key: tag, label: tag })),
])
</script>

<template>
<nav class="memos-cat-nav" aria-label="碎碎念标签筛选">
	<ul class="memos-cat-list">
		<li v-for="item in items" :key="item.key || 'all'">
			<button
				type="button"
				class="memos-cat"
				:class="{ 'is-active': active === item.key }"
				:aria-pressed="active === item.key"
				@click="emit('select', item.key)"
			>
				<span>{{ item.label }}</span>
			</button>
		</li>
	</ul>
</nav>
</template>

<style scoped lang="scss">
.memos-cat-nav {
	flex: 1;
	min-width: 0;
}

.memos-cat-list {
	display: flex;
	flex-flow: row nowrap;
	align-items: center;
	gap: 0.35rem;
	overflow-x: auto;
	margin: 0;
	padding: 0.1rem 0.15rem;
	scrollbar-width: none;

	&::-webkit-scrollbar {
		display: none;
	}

	li {
		flex: none;
		list-style: none;
	}
}

.memos-cat {
	display: flex;
	align-items: center;
	padding: 0.24rem 0.68rem;
	border: 1px solid var(--c-border);
	border-radius: 999px;
	background: transparent;
	font-size: 0.76rem;
	line-height: 1.5;
	text-decoration: none;
	color: var(--c-text-3);
	transition: color 0.22s ease, background 0.22s ease, border-color 0.22s ease, box-shadow 0.22s ease;
	cursor: pointer;

	&:hover {
		border-color: var(--c-primary-soft);
		background: var(--c-bg-2);
		color: var(--c-primary);
	}

	&.is-active {
		border-color: transparent;
		box-shadow: 0 6px 14px var(--c-primary-soft);
		background: var(--c-primary);
		color: #FFF;
		animation: memos-cat-pop 0.32s cubic-bezier(0.34, 1.56, 0.64, 1) both;

		/* 深色主题下 --c-primary 亮度很高，白字对比不足 → 改用深色字 */
		:global(.dark) & {
			box-shadow: 0 6px 14px var(--c-primary-soft);
			color: #2B0F0F;
		}
	}
}

@keyframes memos-cat-pop {
	from {
		opacity: 0.6;
		transform: scale(0.94);
	}

	to {
		opacity: 1;
		transform: scale(1);
	}
}
</style>
