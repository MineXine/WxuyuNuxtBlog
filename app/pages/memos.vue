<!--
  /memos 路由 — 碎碎念页面

  页面骨架对齐参考站点 `.page_main`：
    <div class="page-main">
      <MemosHero />        ← 封面横幅 + 右下角作者信息
      <MemosTimeline />    ← 标签导航 + 行式信息流
    </div>

  默认配置从 app.config.ts 的 memos 段读取。
-->
<script setup lang="ts">
interface MemosPageConfig {
	/** 横幅封面图 */
	cover?: string
	/** 横幅主标题，缺省取站点作者名 */
	heroTitle?: string
	/** 横幅副标题，缺省取站点签名 */
	heroDesc?: string
}

const appConfig = useAppConfig()
const layoutStore = useLayoutStore()

// 设置侧边栏组件
layoutStore.setAside(['blog-stats', 'blog-tech', 'blog-log'])

const memosCfg = computed(() => (appConfig.memos ?? {}) as MemosPageConfig)

const heroTitle = computed(() => memosCfg.value.heroTitle || appConfig.author?.name || '碎碎念')
const heroDesc = computed(() => memosCfg.value.heroDesc || appConfig.subtitle || '')
const heroAvatar = computed(() => appConfig.author?.avatar || '')
const heroCover = computed(() => memosCfg.value.cover || '/image/PageCover/moment.avif')

useHead({
	title: '碎碎念 · Memos',
	meta: [{ name: 'description', content: '记录在 Memos 上的碎碎念' }],
})
</script>

<template>
<div class="page-main">
	<MemosHero
		:title="heroTitle"
		:desc="heroDesc"
		:avatar="heroAvatar"
		:cover="heroCover"
	/>
	<MemosTimeline />
</div>
</template>

<style scoped lang="scss">
.page-main {
	display: flex;
	flex-direction: column;
	position: relative;
	min-width: 0;
	margin: 1rem;
	z-index: 1;
}

@media (max-width: 768px) {
	.page-main {
		margin: 0.6rem 0.75rem;
	}
}
</style>
