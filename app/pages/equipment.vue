<script lang="ts" setup>
import { computed, ref } from 'vue'
import { equipment } from '~/equipment'
import { useLayoutStore } from '~/stores/layout'

/** 去除 HTML 标签（评论引用时用） */
const TAG_RE = /<[^>]+>/g

const layoutStore = useLayoutStore()
layoutStore.setAside(['blog-stats', 'blog-tech', 'blog-log'])

useSeoMeta({
	title: '我的装备',
})

// 新增状态管理
const activeCategory = ref('硬件')

// 计算属性过滤设备
const filteredEquipment = computed(() =>
	equipment.filter(item => item.categroy === activeCategory.value),
)

function handleTabClick(category: string) {
	activeCategory.value = category
}

function goComment(content: string) {
	const textarea = document.querySelector('.atk-textarea') as HTMLTextAreaElement
	if (textarea) {
		textarea.value = `> ${content.replace(TAG_RE, '')}\n\n`
		textarea.focus()
		textarea.scrollIntoView({ behavior: 'smooth', block: 'center' })
	}
}

const getCategoryCount = computed(() => (category: string) => {
	return equipment.filter(item => item.categroy === category).length
})
</script>

<template>
<div id="icat-equipment">
	<div class="equipment-category">
		<!-- 顶部导航栏 -->
		<div class="categories-tabs">
			<div class="tabs-container">
				<div
					v-for="category in ['硬件', '外设']"
					:key="category"
					class="category-tab"
					:class="{ active: activeCategory === category }"
					:style="{ '--tab-color': category === '硬件' ? '#3af' : category === '外设' ? '#3ba' : '' }"
					@click="handleTabClick(category)"
				>
					<icon :name="category === '硬件' ? 'ph-laptop-bold' : (category === '外设' ? 'ph-package-bold' : '')" />
					<span>{{ category }}</span>
					<span>{{ getCategoryCount(category) }}</span>
				</div>
			</div>
		</div>
		<!-- 设备展示区 -->
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
// 装备页面样式优化 (苏晓河编写，2025年2月5日)
// 优化重点：提升加载性能，使用SCSS嵌套结构，语义化类名

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
				}

				.active {
					background: color-mix(in srgb, var(--tab-color) 10%, transparent);
					font-weight: 600;
				}

				.active, :hover {
					border-color: var(--tab-color);
					color: var(--tab-color);
				}
			}
		}

		.category-title {
			margin: 20px 7px 0;
			font-size: 1.5rem;
			font-weight: 600;
			color: var(--icat-fontcolor);
		}

		.category-desc {
			margin: 0.5rem 7px 1rem;
			font-size: 0.9rem;
			line-height: 1.4;
			color: var(--icat-secondtext);
		}

		.equipment-list {
			display: grid;
			grid-template-columns: minmax(0, 1fr);
			gap: 16px;
			padding: 10px 0 0;
		}
	}
}

// 响应式设计：卡片内部区域重排已移入 EquipmentCard 组件
@media screen and (max-width: 768px) {
	#icat-equipment .equipment-category {
		margin: 0.5rem;

		.equipment-list {
			gap: 10px;
		}
	}
}

@media screen and (max-width: 480px) {
	#icat-equipment .equipment-category {
		margin: 0.25rem;

		.category-title {
			margin: 10px 7px 0;
			font-size: 1.25rem;
		}
	}
}
</style>
