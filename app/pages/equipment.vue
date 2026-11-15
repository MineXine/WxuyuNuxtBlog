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
			<div v-for="(item, index) in filteredEquipment" :key="item.name + index" class="equipment-card">
				<!-- 设备图片占位显示区域 -->
				<figure class="equipment-image">
					<img
						:src="item.image"
						:alt="item.name"
						loading="lazy"
					>
				</figure>

				<!-- 设备评价显示区域 -->
				<section class="equipment-opinion">
					<span class="area-label">设备评价</span>
					<p class="opinion-text">
						{{ item.desc }}
					</p>
				</section>

				<!-- 设备配置显示区域 -->
				<section class="equipment-specs">
					<span class="area-label">设备配置</span>
					<div class="card-specs">
						<div v-for="([key, value]) in Object.entries(item.info ?? {})" :key="key" class="spec-item">
							<div class="spec-label">
								{{ key }}
							</div>
							<div class="spec-value">
								{{ value }}
							</div>
						</div>
					</div>
				</section>

				<!-- 设备品牌图片显示区域 -->
				<div class="equipment-brand" :title="item.brand?.name">
					<img v-if="item.brand?.logo" :src="item.brand.logo" :alt="item.brand?.name" loading="lazy">
					<span v-else class="brand-fallback">{{ (item.brand?.name || item.name).slice(0, 1) }}</span>
				</div>

				<!-- 设备标签显示区域 -->
				<div class="card-tags">
					<span v-for="tag in (item.tag ?? [])" :key="tag" class="tag">
						{{ tag }}
					</span>
				</div>

				<!-- 设备名称显示区域 -->
				<div class="equipment-name">
					<h3 class="card-name">
						{{ item.name }}
					</h3>
					<div
						class="card-category"
						:style="{ '--category-color': item.categroy === '硬件' ? '#3af' : '#3ba' }"
					>
						{{ item.categroy }}
					</div>
				</div>

				<!-- 设备购入日期显示位置 -->
				<div class="equipment-purchase">
					<span class="area-label">购入日期</span>
					<div class="purchase-info">
						<icon name="ph:calendar-bold" />
						<span>{{ item.date }}</span>
					</div>
					<div class="price-info">
						￥{{ item.money }}
					</div>
				</div>

				<!-- 功能区域显示位置 -->
				<div class="equipment-actions">
					<a class="equipment-link" :href="item.src" :title="`跳转到${item.name}的产品详情`" target="_blank" rel="noopener noreferrer">
						详情
					</a>
					<button class="comment-btn" type="button" aria-label="快速评论" @click="goComment(item.desc)">
						<icon name="ph:chats-bold" />
					</button>
				</div>
			</div>
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

			/**
       * 设备卡片（电脑端版式）
       *
       *  ┌──────────────────┬────────────────────────────────────┐
       *  │                  │  设备评价显示区域                    │
       *  │ 设备图片占位区域  ├────────────────────────────────────┤
       *  │                  │  设备配置显示区域                    │
       *  ├──────────┬───────┴──────────────┬─────────────────────┤
       *  │ 品牌图片  │  设备标签显示区域     │ 设备购入日期显示位置 │
       *  ├──────────┤                      ├─────────────────────┤
       *  │ 设备名称  │                      │ 功能区域显示位置     │
       *  └──────────┴──────────────────────┴─────────────────────┘
       */
			.equipment-card {
				display: grid;
				grid-template: "image opinion opinion" auto "image specs   specs" auto "brand tags    purchase" auto "name  tags    actions" auto / minmax(170px, 26%) minmax(0, 1fr) minmax(150px, 20%);
				align-items: start;
				gap: 0.7rem 1rem;
				overflow: hidden;
				padding: 0.85rem;
				border: 1px solid var(--icat-secondbg);
				border-radius: 12px;
				background: var(--icat-card-bg);
				transition: transform 0.3s ease, box-shadow 0.3s ease;

				&:hover {
					box-shadow: 0 4px 12px rgb(0 0 0 / 10%);
					transform: translateY(-2px);
				}

				/* 区域标题 */
				.area-label {
					display: inline-block;
					margin-bottom: 0.3rem;
					padding: 0.1rem 0.45rem;
					border-radius: 0.3rem;
					background: color-mix(in srgb, var(--category-color-one) 10%, transparent);
					font-size: 0.68rem;
					font-weight: 600;
					letter-spacing: 0.04em;
					white-space: nowrap;
					color: var(--category-color-one);
				}

				/* ── 设备图片占位显示区域 ── */
				.equipment-image {
					display: flex;
					grid-area: image;
					align-items: center;
					justify-content: center;
					position: relative;
					overflow: hidden;
					width: 100%;
					min-height: 190px;
					border: 1px solid var(--c-border);
					border-radius: 10px;
					background: rgb(255 255 255);

					img {
						width: 100%;
						height: 100%;
						padding: 0.8rem;
						transition: transform 0.3s;
						object-fit: contain;
					}
				}

				/* ── 设备评价显示区域 ── */
				.equipment-opinion {
					grid-area: opinion;
					min-width: 0;

					.opinion-text {
						display: -webkit-box;
						overflow: hidden;
						overflow-wrap: anywhere;
						margin: 0;
						font-size: 0.9rem;
						-webkit-line-clamp: 2;
						line-clamp: 2;
						line-height: 1.6;
						color: var(--c-text-2);
						-webkit-box-orient: vertical;
					}
				}

				/* ── 设备配置显示区域 ── */
				.equipment-specs {
					grid-area: specs;
					min-width: 0;

					.card-specs {
						display: grid;
						grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
						gap: 0.45rem 0.6rem;
						font-size: 0.8rem;

						.spec-item {
							display: flex;
							flex-direction: column;
							gap: 0.1rem;
							padding: 0.3rem 0.5rem;
							border-radius: 0.5rem;
							background: color-mix(in srgb, var(--icat-secondbg) 45%, transparent);
							transition: background 0.24s ease;

							&:hover {
								background: color-mix(in srgb, var(--category-color-one) 10%, transparent);
							}
						}

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

				/* ── 设备品牌图片显示区域 ── */
				.equipment-brand {
					display: flex;
					grid-area: brand;
					align-items: center;
					justify-content: center;
					overflow: hidden;
					width: 100%;
					min-height: 44px;
					padding: 0.35rem;
					border: 1px solid var(--c-border);
					border-radius: 8px;
					background: var(--c-bg-soft);

					img {
						max-width: 100%;
						max-height: 34px;
						object-fit: contain;
					}

					.brand-fallback {
						font: 700 1.05rem / 1 var(--font-serif);
						color: var(--category-color-one);
					}
				}

				/* ── 设备标签显示区域 ── */
				.card-tags {
					display: flex;
					flex-wrap: wrap;
					grid-area: tags;
					align-content: flex-start;
					gap: 0.3rem;
					min-width: 0;

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

				/* ── 设备名称显示区域 ── */
				.equipment-name {
					display: flex;
					flex-wrap: wrap;
					grid-area: name;
					align-items: center;
					gap: 0.4rem;
					min-width: 0;

					.card-name {
						overflow: hidden;
						margin: 0;
						font-size: 1.05rem;
						font-weight: 700;
						line-height: 1.25;
						white-space: nowrap;
						text-overflow: ellipsis;
						color: var(--icat-fontcolor);
					}

					.card-category {
						flex-shrink: 0;
						padding: 0.15rem 0.5rem;
						border-radius: 0.4rem;
						background: color-mix(in srgb, var(--category-color) 10%, transparent);
						font-size: 0.7rem;
						font-weight: 600;
						white-space: nowrap;
						color: var(--category-color);
					}
				}

				/* ── 设备购入日期显示位置 ── */
				.equipment-purchase {
					display: flex;
					flex-direction: column;
					grid-area: purchase;
					align-items: flex-start;
					gap: 0.15rem;
					min-width: 0;
					font-size: 0.75rem;
					color: var(--c-text-2);

					.purchase-info {
						display: flex;
						align-items: center;
						gap: 0.3rem;
						white-space: nowrap;

						.icon {
							font-size: 0.9rem;
						}
					}

					.price-info {
						font-weight: 700;
						color: var(--icat-fontcolor);
						font-variant-numeric: tabular-nums;
					}
				}

				/* ── 功能区域显示位置 ── */
				.equipment-actions {
					display: flex;
					flex-wrap: wrap;
					grid-area: actions;
					align-items: center;
					gap: 0.4rem;

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
	}
}

// 响应式设计：卡片内部区域按可用宽度重排
@media screen and (max-width: 1024px) {
	#icat-equipment .equipment-category .equipment-list {
		.equipment-card {
			grid-template-areas:
				"image opinion"
				"image specs"
				"image tags"
				"brand purchase"
				"name  actions";
			grid-template-columns: minmax(140px, 34%) minmax(0, 1fr);

			.equipment-image {
				min-height: 170px;
			}
		}
	}
}

@media screen and (max-width: 768px) {
	#icat-equipment .equipment-category {
		margin: 0.5rem;

		.equipment-list {
			gap: 10px;

			.equipment-card {
				grid-template-areas:
					"image"
					"name"
					"brand"
					"opinion"
					"specs"
					"tags"
					"purchase"
					"actions";
				grid-template-columns: minmax(0, 1fr);

				.equipment-image {
					min-height: 200px;
				}

				.card-specs {
					grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
				}
			}
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

		.equipment-list .equipment-card {
			padding: 0.7rem;

			.equipment-image {
				min-height: 160px;
			}
		}
	}
}
</style>
