<!-- content/EquipmentItem.vue -->
<script lang="ts" setup>
/**
 * EquipmentItem — 装备卡片的独立调用入口（MDC）
 *
 * 文章 / 文档里可直接写：
 *
 * ```md
 * ::equipment-item{name="天选4"}
 * ::
 *
 * ::equipment-item{name="iPhone XR" category="外设" show-comment="false"}
 * ::
 * ```
 *
 * 真正的卡片实现见 `app/components/equipment/EquipmentCard.vue`，
 * 本组件只负责「按名字取数据 + 转成卡片 props」。
 */
import { equipment } from '~/equipment'
import EquipmentCard from '../equipment/EquipmentCard.vue'

const props = withDefaults(defineProps<{
	/** 设备名（对应 app/equipment.ts 中的 name） */
	name?: string
	/** 分类（设备名重名时用于消歧，如 硬件 / 外设） */
	category?: string
	/** 是否显示快速评论按钮（文章内一般关闭） */
	showComment?: boolean | string
	/** 是否显示分类徽标 */
	showCategory?: boolean | string
	/** 是否显示品牌区 */
	showBrand?: boolean | string
	/** 是否显示底部操作区 */
	showActions?: boolean | string
}>(), {
	name: '',
	category: '',
	showComment: false,
	showCategory: true,
	showBrand: true,
	showActions: true,
})

/**
 * 布尔化
 *
 * MDC 传入的属性都是字符串，`showComment="false"` 会被当成真值，
 * 这里统一转换成真正的布尔值。
 *
 * @param value 原始值
 * @returns 布尔值
 */
function toBool(value: boolean | string | undefined, fallback = true): boolean {
	if (typeof value === 'boolean')
		return value
	if (value === undefined || value === null || value === '')
		return fallback
	return !['false', '0', 'off', 'no'].includes(String(value).toLowerCase())
}

/** 按名称（可选分类）查找设备 */
const device = computed(() => {
	const keyword = props.name.trim()
	if (!keyword)
		return undefined
	return equipment.find(item => (
		item.name === keyword
		&& (!props.category || item.categroy === props.category)
	)) ?? equipment.find(item => item.name === keyword)
})

/** 未找到时的提示文案 */
const notFound = computed(() => {
	if (!props.name.trim())
		return '未指定设备名称'
	return `未找到设备「${props.name}」`
})
</script>

<template>
<EquipmentCard
	v-if="device"
	:item="device"
	:show-comment="toBool(showComment, false)"
	:show-category="toBool(showCategory, true)"
	:show-brand="toBool(showBrand, true)"
	:show-actions="toBool(showActions, true)"
/>
<div v-else class="equipment-not-found">
	{{ notFound }}
</div>
</template>

<style lang="scss" scoped>
.equipment-not-found {
	padding: 0.8rem 1rem;
	border: 1px dashed var(--c-border);
	border-radius: 10px;
	font-size: 0.85rem;
	text-align: center;
	color: var(--c-text-3);
}
</style>
