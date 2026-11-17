<script lang="ts" setup>
import { computed, ref } from 'vue'
import EquipmentCard from '~/components/equipment/EquipmentCard.vue'
import { equipment } from '~/equipment'
import { useLayoutStore } from '~/stores/layout'

const layoutStore = useLayoutStore()
layoutStore.setAside(['blog-stats', 'blog-tech', 'blog-site-info', 'blog-archive', 'blog-log'])

useSeoMeta({
	title: '我的装备',
})

/** 分类配置（图标 + 主题色），新增分类只需在这里补一项 */
const CATEGORIES = [
	{ name: '硬件', icon: 'ph:laptop-bold', color: '#3af' },
	{ name: '外设', icon: 'ph:package-bold', color: '#3ba' },
] as const

/** 当前选中的分类 */
const activeCategory = ref<string>(CATEGORIES[0].name)

/** 按分类过滤设备 */
const filteredEquipment = computed(() =>
	equipment.filter(item => item.categroy === activeCategory.value),
)

/** 切换分类 */
function handleTabClick(category: string) {
	activeCategory.value = category
}

/** 各分类的设备数量 */
const getCategoryCount = computed(() => (category: string) =>
	equipment.filter(item => item.categroy === category).length,
)

/** 去除描述里的 HTML 标签 */
const HTML_TAG_RE = /<[^>]+>/g

/**
 * 快速评论：把设备描述带入评论框
 *
 * 由 EquipmentCard 的 comment 事件触发。
 *
 * @param content 设备描述
 */
function goComment(content: string) {
	const textarea = document.querySelector('.atk-textarea') as HTMLTextAreaElement
	if (textarea) {
		textarea.value = `> ${content.replace(HTML_TAG_RE, '')}\n\n`
		textarea.focus()
		textarea.scrollIntoView({ behavior: 'smooth', block: 'center' })
	}
}
</script>

<template>
<div id="icat-equipment">
	<div class="equipment-category">
		<!-- 顶部导航栏 -->
		<div class="categories-tabs">
			<div class="tabs-container">
				<div
					v-for="category in CATEGORIES"
					:key="category.name"
					class="category-tab"
					:class="{ active: activeCategory === category.name }"
					:style="{ '--tab-color': category.color }"
					@click="handleTabClick(category.name)"
				>
					<icon :name="category.icon" />
					<span>{{ category.name }}</span>
					<span>{{ getCategoryCount(category.name) }}</span>
				</div>
			</div>
		</div>

		<!-- 设备展示区：卡片由 EquipmentCard 组件渲染 -->
		<div class="equipment-list">
			<EquipmentCard
				v-for="(item, index) in filteredEquipment"
				:key="item.name + index"
				:item="item"
				@comment="goComment"
			/>
		</div>
	</div>
</div>
<PostComment key="/equipment" />
</template>

<style lang="scss" scoped>
/**
 * 装备页布局
 *
 * 卡片本体样式在 components/equipment/EquipmentCard.vue 内（组件自带 scoped 样式），
 * 这里只负责：分类导航 + 列表栅格。
 */
#icat-equipment {
	--category-color-one: #3AF;
	--category-color-two: #3BA;

	padding-bottom: 12px;

	.equipment-category {
		margin: 1rem;
		padding-top: 1rem;

		.categories-tabs {
			display: flex;
			justify-content: center;
			overflow-x: auto;
			margin-bottom: 2rem;
			-webkit-overflow-scrolling: touch;

			.tabs-container {
				display: flex;
				flex-wrap: wrap;
				justify-content: center;
				gap: 0.5rem;
				padding: 0.5rem;

				.category-tab {
					display: flex;
					align-items: center;
					gap: 0.5rem;
					padding: 0.6rem 1.2rem;
					border: 2px solid var(--c-border);
					border-radius: 0.6rem;
					background: transparent;
					font-size: 0.95rem;
					white-space: nowrap;
					color: var(--c-text-2);
					transition: all 0.3s ease;
					cursor: pointer;

					&.active {
						border-color: var(--tab-color);
						background: color-mix(in srgb, var(--tab-color) 10%, transparent);
						font-weight: 600;
						color: var(--tab-color);
					}

					&:hover {
						border-color: var(--tab-color);
						color: var(--tab-color);
					}
				}
			}
		}

		/* 设备展示栅格 */
		.equipment-list {
			display: grid;
			grid-template-columns: repeat(2, 1fr);
			gap: 16px;
			padding: 10px 0 0;
		}
	}
}

/* 响应式设计 */
@media screen and (max-width: 1024px) {
	#icat-equipment .equipment-category .equipment-list {
		grid-template-columns: repeat(2, 1fr);
		gap: 12px;
	}
}

@media screen and (max-width: 768px) {
	#icat-equipment .equipment-category {
		margin: 0.5rem;

		.equipment-list {
			grid-template-columns: 1fr;
			gap: 10px;
		}
	}
}

@media screen and (max-width: 480px) {
	#icat-equipment .equipment-category {
		margin: 0.25rem;
	}
}
</style>
