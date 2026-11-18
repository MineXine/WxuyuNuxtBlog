<script lang="ts" setup>
/**
 * EquipmentCard — 装备卡片（独立调用组件）
 *
 * 从 `app/pages/equipment.vue` 抽离出来的卡片实现，
 * 页面与 MDC 入口（`content/EquipmentItem.vue`）共用同一份代码。
 *
 * 用法一：页面里直接遍历
 * ```vue
 * <EquipmentCard v-for="item in list" :key="item.name" :item="item" @comment="onComment" />
 * ```
 *
 * 用法二：文章 / 文档里用 MDC（见 `content/EquipmentItem.vue`）
 * ```md
 * ::equipment-item{name="天选4"}
 * ::
 * ```
 */
import type { item } from '~/types/equipment'

const props = withDefaults(defineProps<{
	/** 设备数据（见 `app/equipment.ts`） */
	item: item
	/** 显示设备图片 */
	showImage?: boolean
	/** 显示分类徽标 */
	showCategory?: boolean
	/** 显示品牌区（品牌名 + Logo / iconfont） */
	showBrand?: boolean
	/** 显示参数表 */
	showSpecs?: boolean
	/** 显示短评 */
	showOpinion?: boolean
	/** 显示底部（入手时间 + 价格） */
	showFooter?: boolean
	/** 显示操作区（详情链接 + 快速评论） */
	showActions?: boolean
	/** 显示快速评论按钮（操作区内） */
	showComment?: boolean
}>(), {
	showImage: true,
	showCategory: true,
	showBrand: false,
	showSpecs: true,
	showOpinion: true,
	showFooter: true,
	showActions: true,
	showComment: true,
})

const emit = defineEmits<{
	/** 点击快速评论：把设备描述抛给父级，由父级决定如何打开评论区 */
	comment: [desc: string]
}>()

/** 分类配色 */
const CATEGORY_COLOR: Record<string, string> = {
	硬件: '#3af',
	外设: '#3ba',
}

/** 当前分类色 */
const categoryColor = computed(() => (
	props.item.categroy_color ?? CATEGORY_COLOR[props.item.categroy] ?? '#3af'
))

/** 参数表：键值对 */
const specEntries = computed(() => Object.entries(props.item.info ?? {}))

/** 标签：数组与对象两种写法都兼容 */
const tags = computed(() => {
	const tag = props.item.tag
	if (!tag)
		return []
	if (Array.isArray(tag))
		return tag.map(text => ({ key: text, text }))
	return Object.entries(tag).map(([key, value]) => ({ key, text: String(value) }))
})
</script>

<template>
<article class="equipment-card">
	<div v-if="showImage" class="equipment-image">
		<img
			:src="item.image"
			:alt="item.name"
			loading="lazy"
		>
	</div>
	<div class="equipment-content">
		<div class="equipment-header">
			<h3 class="card-name">
				{{ item.name }}
			</h3>
			<div
				v-if="showCategory"
				class="card-category"
				:style="{ '--category-color': categoryColor }"
			>
				{{ item.categroy }}
			</div>
		</div>
		<div v-if="showBrand && item.brand?.name" class="card-brand">
			<img
				v-if="item.brand.logo"
				class="card-brand-logo"
				:src="item.brand.logo"
				:alt="item.brand.name"
			>
			<i v-else-if="item.brand.icon" :class="item.brand.icon" />
			<span class="card-brand-name">{{ item.brand.name }}</span>
		</div>
		<div v-if="showOpinion && item.desc" class="equipment-opinion">
			{{ item.desc }}
		</div>
		<div v-if="showSpecs && specEntries.length" class="card-specs">
			<div
				v-for="([key, value]) in specEntries"
				:key="key"
				class="spec-item"
			>
				<div class="spec-label">
					{{ key }}
				</div>
				<div class="spec-value">
					{{ value }}
				</div>
			</div>
		</div>
		<div v-if="tags.length" class="card-tags">
			<span
				v-for="tag in tags"
				:key="tag.key"
				class="tag"
			>
				{{ tag.text }}
			</span>
		</div>
		<div v-if="showFooter" class="card-footer">
			<div class="purchase-info">
				<Icon name="ph-calendar-bold" style="font-size: 16px;" />
				{{ item.date }}
			</div>
			<div v-if="item.money !== undefined" class="price-info">
				￥{{ item.money }}
			</div>
		</div>
		<div v-if="showActions" class="equipment-actions">
			<a
				v-if="item.src"
				class="equipment-link"
				:href="item.src"
				:title="`跳转到${item.name}的产品详情`"
				target="_blank"
				rel="noopener noreferrer"
			>
				详情
			</a>
			<button
				v-if="showComment"
				class="comment-btn"
				type="button"
				:title="`快速评论「${item.name}」`"
				aria-label="快速评论"
				@click="emit('comment', item.desc)"
			>
				<Icon name="ph-chats-bold" />
			</button>
		</div>
	</div>
</article>
</template>

<style lang="scss" scoped>
// 装备卡片样式（自 app/pages/equipment.vue 抽离，语义化类名 + SCSS 嵌套）
.equipment-card {
	overflow: hidden;
	border: 1px solid var(--icat-secondbg);
	border-radius: 12px;
	background: var(--icat-card-bg);
	transition: transform 0.3s ease, box-shadow 0.3s ease;

	&:hover {
		box-shadow: 0 4px 12px rgb(0 0 0 / 10%);
		transform: translateY(-2px);
	}

	.equipment-image {
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
		overflow: hidden;
		width: 100%;
		height: 240px;
		background: rgb(255 255 255);

		img {
			width: 100%;
			height: 100%;
			padding: 0.8rem;
			transition: transform 0.3s;
			object-fit: contain;

			&::before {
				content: attr(alt);
				display: grid;
				place-content: center;
				position: absolute;
				overflow: visible;
				inset: 0;
				padding: 0.5em;
				background-color: var(--c-border);
				font: 700 1.5rem / 1.2 var(--font-serif);
				word-break: normal;
				text-align: center;
				text-shadow: none;
				color: var(--c-bg-soft);
			}
		}
	}

	.equipment-content {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 0.8rem;
		min-width: 0;
		padding: 1rem;

		.equipment-header {
			display: flex;
			align-items: flex-start;
			justify-content: space-between;
			gap: 0.8rem;

			.card-name {
				overflow: hidden;
				margin-bottom: 8px;
				font-size: 1.125rem;
				font-weight: 700;
				line-height: 1.2;
				white-space: nowrap;
				text-overflow: ellipsis;
				color: var(--icat-fontcolor);
			}

			.card-category {
				flex-shrink: 0;
				padding: 0.3rem 0.8rem;
				border-radius: 0.4rem;
				background: color-mix(in srgb, var(--category-color) 10%, transparent);
				font-size: 0.75rem;
				font-weight: 600;
				white-space: nowrap;
				color: var(--category-color);
			}
		}

		.card-brand {
			display: flex;
			align-items: center;
			gap: 0.35rem;
			font-size: 0.8rem;
			color: var(--c-text-2);

			.card-brand-logo {
				width: auto;
				height: 1.1rem;
				object-fit: contain;
			}

			.card-brand-name {
				font-weight: 600;
			}
		}

		.card-specs {
			display: grid;
			grid-template-columns: repeat(2, 1fr);
			gap: 0.4rem;
			padding: 0;
			border-radius: 0;
			background: transparent;
			font-size: 0.8rem;

			.spec-item {
				display: flex;
				flex-direction: column;
				gap: 0.1rem;

				.spec-label {
					font-size: 0.7rem;
					font-weight: 500;
					color: var(--c-text-2);
				}

				.spec-value {
					overflow-wrap: anywhere;
					font-size: 0.8rem;
					color: var(--c-text);
				}
			}
		}

		.equipment-opinion {
			display: -webkit-box;
			overflow: hidden;
			overflow-wrap: anywhere;
			margin: 0;
			font-size: 0.9rem;
			-webkit-line-clamp: 2;
			line-clamp: 2;
			line-height: 1.4;
			color: var(--c-text-2);
			-webkit-box-orient: vertical;
		}

		.card-tags {
			display: flex;
			flex-wrap: wrap;
			gap: 0.3rem;

			.tag {
				display: inline-block;
				padding: 0.15rem 0.5rem;
				border-radius: 0.3rem;
				background: color-mix(in srgb, var(--c-primary) 10%, transparent);
				font-size: 0.7rem;
				white-space: nowrap;
				color: var(--c-primary);
			}
		}

		.card-footer,
		.card-footer div {
			display: flex;
			align-items: center;
		}

		.card-footer {
			flex-wrap: wrap;
			gap: 0.8rem;
			padding-top: 0.6rem;
			border-top: 1px solid var(--c-border);
			font-size: 0.75rem;
			color: var(--c-text-2);

			div {
				gap: 0.3rem;
			}
		}

		.equipment-actions {
			display: flex;
			align-items: center;
			justify-content: space-between;

			.equipment-link {
				padding: 6px 12px;
				border-radius: 6px;
				background: var(--icat-gray-op);
				font-size: 0.75rem;
				letter-spacing: 0.5px;
				text-decoration: none;
				color: var(--icat-fontcolor);
				transition: all 0.3s ease;

				&:hover {
					box-shadow: 0 8px 16px -4px var(--icat-black-op);
					background: var(--icat-blue);
					color: var(--icat-white);
				}
			}

			.comment-btn {
				display: flex;
				align-items: center;
				justify-content: center;
				padding: 6px 10px;
				border: none;
				border-radius: 6px;
				background: var(--icat-gray-op);
				color: var(--icat-fontcolor);
				transition: all 0.3s ease;
				cursor: pointer;

				&:hover {
					box-shadow: 0 8px 16px -4px var(--icat-black-op);
					background: var(--icat-blue);
					color: var(--icat-white);
				}

				.icon {
					font-size: 1rem;
				}
			}
		}
	}
}

// 响应式：移动端压缩图片高度
@media screen and (max-width: 768px) {
	.equipment-card .equipment-image img {
		height: 180px;
	}
}

@media screen and (max-width: 480px) {
	.equipment-card .equipment-image img {
		height: 160px;
	}
}
</style>
