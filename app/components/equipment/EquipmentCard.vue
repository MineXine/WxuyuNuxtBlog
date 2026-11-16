<script lang="ts" setup>
import type { item } from '~/types/equipment'

interface Props {
	/** 设备数据 */
	item: item
}

const props = defineProps<Props>()

const emit = defineEmits<{
	/** 请求快速评论（携带设备描述，交由页面写入评论框） */
	comment: [desc: string]
}>()

/** 分类色：硬件蓝 / 外设青 */
const categoryColor = computed(() => (props.item.categroy === '硬件' ? '#3af' : '#3ba'))

/**
 * 品牌关键词 → iconfont 类名
 *
 * 卡片未显式指定 brand.icon 时，按品牌名 / 设备名自动匹配，
 * 匹配不到则回退到首字徽标。
 */
const BRAND_ICON_RULES: { icon: string, keywords: string[] }[] = [
	{ icon: 'icon-ASUS', keywords: ['华硕', '天选', '玩家国度', 'asus', 'rog'] },
	{ icon: 'icon-lianfake', keywords: ['联想', 'lenovo', '小新', '拯救者'] },
	{ icon: 'icon-xiaolong', keywords: ['小米', 'xiaomi', '红米', 'redmi'] },
	{ icon: 'icon-NVDIA', keywords: ['nvidia', '英伟达', '显卡', 'rtx', 'gtx'] },
	{ icon: 'icon-AMD', keywords: ['amd', '锐龙', 'ryzen'] },
	{ icon: 'icon-INTEL', keywords: ['intel', '英特尔', '酷睿', 'core'] },
	{ icon: 'icon-VIVO', keywords: ['vivo'] },
	{ icon: 'icon-OPPO', keywords: ['oppo', '一加', 'oneplus'] },
]

/** 品牌 iconfont 类名（无则空） */
const brandIcon = computed(() => {
	const explicit = props.item.brand?.icon
	if (explicit)
		return explicit
	const haystack = `${props.item.brand?.name ?? ''} ${props.item.name}`.toLowerCase()
	for (const rule of BRAND_ICON_RULES) {
		if (rule.keywords.some(keyword => haystack.includes(keyword.toLowerCase())))
			return rule.icon
	}
	return ''
})

/**
 * 硬件品牌 → iconfont 类名
 *
 * 阿里图标库里的类名由图标名生成，与品牌英文名拼写不一定一致
 * （例如 NVIDIA 在图标库中叫 NVDIA），这里统一做一次映射。
 */
const HARDWARE_ICON_MAP: Record<string, string> = {
	AMD: 'icon-AMD',
	INTEL: 'icon-INTEL',
	NVIDIA: 'icon-NVDIA',
	NVDIA: 'icon-NVDIA',
}
/**
 * 配置项对应的硬件品牌图标
 *
 * 芯片取 CPU 品牌、显卡取 GPU 品牌，其余项不显示图标。
 *
 * @param key 配置项名称
 * @returns iconfont 图标类名（无则空）
 */
function hardwareIcon(key: string): string {
	const hardware = props.item.brand_hardware
	if (!hardware)
		return ''
	const brand = key === '芯片' ? hardware.CPU : key === '显卡' ? hardware.GPU : ''
	if (!brand)
		return ''
	return HARDWARE_ICON_MAP[brand.toUpperCase()] ?? ''
}
/** 品牌占位文字（无 Logo 且无图标时取品牌名或设备名首字） */
const brandInitial = computed(() => (props.item.brand?.name || props.item.name).slice(0, 1))

/** 发起快速评论 */
function requestComment() {
	emit('comment', props.item.desc)
}
</script>

<template>
<article class="equipment-card">
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
		<p class="opinion-text">
			{{ item.desc }}
		</p>
	</section>

	<!-- 设备配置显示区域 -->
	<section class="equipment-specs">
		<div class="card-specs">
			<div v-for="([key, value]) in Object.entries(item.info ?? {})" :key="key" class="spec-item">
				<div class="spec-label">
					{{ key }}
					<i
						v-if="hardwareIcon(key)"
						class="iconfont spec-icon"
						:class="hardwareIcon(key)"
					/>
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
		<i v-else-if="brandIcon" class="iconfont brand-icon" :class="brandIcon" />
		<span v-else class="brand-fallback">{{ brandInitial }}</span>
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
		<div class="card-category" :style="{ '--category-color': categoryColor }">
			{{ item.categroy }}
		</div>
	</div>

	<!-- 设备购入日期显示位置 -->
	<div class="equipment-purchase">
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
		<button class="comment-btn" type="button" aria-label="快速评论" @click="requestComment">
			<icon name="ph:chats-bold" />
		</button>
	</div>
</article>
</template>

<style lang="scss" scoped>
/* 图标字体（阿里 iconfont · 项目 5253176） */
@font-face {
	font-family: iconfont;  /* Project id 5253176 */
	src:
		url("//at.alicdn.com/t/c/font_5253176_0198qrotr7hr.woff2?t=1794805528711") format("woff2"),
		url("//at.alicdn.com/t/c/font_5253176_0198qrotr7hr.woff?t=1794805528711") format("woff"),
		url("//at.alicdn.com/t/c/font_5253176_0198qrotr7hr.ttf?t=1794805528711") format("truetype");
}

.iconfont {
	font-family: iconfont;
	font-size: 16px;
	font-style: normal;
	-webkit-font-smoothing: antialiased;
	-moz-osx-font-smoothing: grayscale;
}

/* 品牌图标：类名来自 iconfont 官方生成结果，保留原始大小写 */
/* stylelint-disable selector-class-pattern, selector-pseudo-element-colon-notation */
.icon-AMD::before {
	content: "\e606";
}

.icon-NVDIA::before {
	content: "\e701";
}

.icon-xiaolong::before {
	content: "\e60b";
}

.icon-lianfake::before {
	content: "\e67e";
}

.icon-INTEL::before {
	content: "\e610";
}

.icon-VIVO::before {
	content: "\e61e";
}

.icon-ASUS::before {
	content: "\e60f";
}

.icon-OPPO::before {
	content: "\e612";
}
/* stylelint-enable selector-class-pattern, selector-pseudo-element-colon-notation */

/**
 * 设备卡片（电脑端版式）
 *
 *  ┌──────────────────┬────────────────────────────────────┐
 *  │                  │ 设备评价显示区域                    │
 *  │ 设备图片占位区域  ├────────────────────────────────────┤
 *  │                  │ 设备配置显示区域                    │
 *  ├──────────┬───────┴──────────────┬─────────────────────┤
 *  │ 品牌图片  │ 设备标签显示区域     │ 设备购入日期显示位置 │
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

	/* 区域标题 */
	.area-label {
		display: inline-block;
		margin-bottom: 0.3rem;
		padding: 0.1rem 0.45rem;
		border-radius: 0.3rem;
		background: color-mix(in srgb, var(--category-color-one, #3AF) 10%, transparent);
		font-size: 0.68rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		white-space: nowrap;
		color: var(--category-color-one, #3AF);
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
				border: 1px solid var(--icat-secondbg);
				border-radius: 0.5rem;
				transition: background 0.24s ease;

				&:hover {
					background: color-mix(in srgb, var(--category-color-one, #3AF) 10%, transparent);
				}
			}

			.spec-label {
				display: flex;
				align-items: center;
				gap: 0.25rem;
				font-size: 0.7rem;
				font-weight: 500;
				color: var(--c-text-2);
			}

			/* 硬件品牌图标 */
			.spec-icon {
				font-size: 0.9rem;
				line-height: 1;
				color: var(--c-text-3);
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
			color: var(--category-color-one, #3AF);
		}

		/* 品牌 iconfont 图标 */
		.brand-icon {
			font-size: 1.35rem;
			line-height: 1;
			color: var(--c-text-2);
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

/* 响应式设计：卡片内部区域按可用宽度重排 */
@media screen and (max-width: 1024px) {
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

/**
 * 移动端版式
 *
 *  ┌────────────────────────┐
 *  │      设备图片占位区域   │
 *  ├────────────────────────┤
 *  │ 设备名称            分类 │
 *  │ 设备评价                  │
 *  │ 芯片        │ 内存        │
 *  │ 显卡        │ 存储        │
 *  │ 设备标签                   │
 *  │ ─────────────────────────│
 *  │ 购入日期         价格      │
 *  │ 详情              评论     │
 *  └────────────────────────┘
 *
 * 与桌面端的差异：
 * - 取消「设备品牌图片显示区域」（移动端空间有限，图标已含在设备图中）
 * - 名称与分类同行，分类靠右
 * - 配置固定两列，标签在上、值在下，去掉色块
 * - 购入日期与价格同行，上方加分隔线
 * - 详情按钮在左、评论按钮在右
 */
@media screen and (max-width: 768px) {
	.equipment-card {
		grid-template-areas:
			"image"
			"name"
			"opinion"
			"specs"
			"tags"
			"purchase"
			"actions";
		grid-template-columns: minmax(0, 1fr);
		gap: 0.6rem;

		/* 设备图片：无边框融入卡片，图片居中 */
		.equipment-image {
			min-height: 170px;
			border-color: transparent;
			border-radius: 12px;
			background: transparent;

			img {
				height: 170px;
				padding: 0.4rem;
			}
		}

		/* 设备品牌图片显示区域：移动端隐藏 */
		.equipment-brand {
			display: none;
		}

		/* 设备名称：与分类同行，分类靠右 */
		.equipment-name {
			justify-content: space-between;
			gap: 0.5rem;

			.card-name {
				font-size: 1.15rem;
			}
		}

		/* 设备评价：紧跟名称 */
		.equipment-opinion {
			margin-top: -0.2rem;

			.opinion-text {
				font-size: 0.85rem;
				-webkit-line-clamp: 3;
				line-clamp: 3;
			}
		}

		/* 设备配置：固定两列，标签在上、值在下 */
		.equipment-specs .card-specs {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 0.55rem 0.9rem;

			.spec-item {
				gap: 0;
				padding: 0;
				border: none;
				border-radius: 0;
				background: transparent;

				&:hover {
					background: transparent;
				}
			}

			.spec-label {
				font-size: 0.68rem;
				color: var(--c-text-3);
			}

			.spec-icon {
				font-size: 0.85rem;
			}

			.spec-value {
				font-size: 0.8rem;
				line-height: 1.45;
			}
		}

		/* 设备标签 */
		.card-tags {
			gap: 0.35rem;
		}

		/* 设备购入日期：与价格同行，上方加虚线分隔 */
		.equipment-purchase {
			flex-direction: row;
			align-items: center;
			gap: 0.9rem;
			padding-top: 0.6rem;
			border-top: 1px dashed var(--c-border);
		}

		/* 功能区域：详情在左、评论在右 */
		.equipment-actions {
			justify-content: space-between;

			.equipment-link {
				padding: 6px 18px;
				border: 1px solid var(--c-border);
				border-radius: 999px;
				background: transparent;

				&:hover {
					border-color: var(--icat-blue);
					background: var(--icat-blue);
				}
			}
		}
	}
}

@media screen and (max-width: 480px) {
	.equipment-card {
		padding: 0.7rem;

		.equipment-image {
			min-height: 150px;

			img {
				height: 150px;
			}
		}
	}
}
</style>
