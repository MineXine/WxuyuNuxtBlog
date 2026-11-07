<!--
  SpineModel.vue — MDC 组件：在正文 / 说说里嵌入 Spine 模型预览

  用法：
    ::spine-model{name="9100140-a"}
    ::spine-model{name="9100140-a" compact}

  - name：模型名（对应模型文章的 ModelName）
  - compact：紧凑模式（隐藏工具栏与文件清单，只保留舞台），说说卡片里推荐开启
-->
<script setup lang="ts">
const props = withDefaults(defineProps<{
	/** 模型名（ModelName） */
	name?: string
	/** 覆盖标题 */
	title?: string
	/** 紧凑模式：只显示舞台 */
	compact?: boolean
}>(), {
	name: '',
	title: '',
	compact: false,
})

const { index } = useSpineModelIndex()

/** 按模型名取条目 */
const entry = computed(() => {
	if (!props.name)
		return undefined
	return index.value.get(props.name)
})
</script>

<template>
<SpineModelViewer
	v-if="entry"
	:assets="entry.assets"
	:name="title || entry.title"
	type="model"
	:compact="compact"
/>
<p v-else-if="name" class="spine-model-missing">
	未找到模型「{{ name }}」
</p>
</template>

<style scoped lang="scss">
.spine-model-missing {
	margin: 0.6rem 0;
	padding: 0.8rem 1rem;
	border: 1px dashed var(--c-border);
	border-radius: 0.6rem;
	font-size: 0.8rem;
	text-align: center;
	color: var(--c-text-3);
}
</style>
