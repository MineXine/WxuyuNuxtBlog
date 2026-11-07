<script lang="ts">
/** ModelImage 允许多张贴图（多页图集），用逗号或竖线分隔 */
</script>

<script setup lang="ts">
import { loadSpine35Runtime } from '~/composables/useSpineViewer'
import { preloadSpineModel } from '~/utils/spineAssets'

const IMAGE_LIST_SPLIT_RE = /\s*[,|;]\s*/

const route = useRoute()

const layoutStore = useLayoutStore()
layoutStore.setAside(['toc', 'blog-presence'])

const { data: post } = await useAsyncData(
	route.path,
	() => queryCollection('content').path(route.path).first(),
)

const contentStore = useContentStore()
const { toc, meta } = storeToRefs(contentStore)

const excerpt = computed(() => post.value?.description || '')

function setTocAndMeta() {
	toc.value = post.value?.body.toc
	meta.value = post.value?.meta
}

setTocAndMeta()

if (post.value) {
	useSeoMeta({
		title: post.value.title,
		ogType: 'article',
		ogImage: post.value.image,
		description: post.value.description,
	})
	layoutStore.setAside(post.value.meta?.aside as WidgetName[] | undefined)
}
else {
	const event = useRequestEvent()
	event && setResponseStatus(event, 404)
	route.meta.title = '404'
	layoutStore.setAside(['blog-log'])
}

/**
 * 模型文章：预加载运行时脚本与贴图。
 *
 * - 运行时脚本用 preload：后面由 loadSpine35Runtime() 注入的同 URL 脚本会直接命中预加载缓存，
 *   省掉一次往返。
 * - 贴图用 preload as=image（1~2MB 的大头）：浏览器在解析 HTML 时就开始下载，
 *   随后的 fetch() 直接命中 HTTP 缓存，与 Cache Storage 双保险。
 *   骨架 / 图集走 fetch()，体量小且需要 ArrayBuffer，不再额外声明。
 */
const modelPrefetchLinks = computed(() => {
	if (post.value?.type !== 'model')
		return []
	const assets = post.value.ModelAssets ?? {}
	const images = String(assets.ModelImage ?? '')
		.split(IMAGE_LIST_SPLIT_RE)
		.filter(Boolean)
	return [
		{ rel: 'preload', as: 'script', href: '/vendor/spine35/spine-webgl.js' },
		{ rel: 'preload', as: 'script', href: '/vendor/spine35/spine35-skel.js' },
		...images.map(src => ({ rel: 'preload', as: 'image', href: src, crossorigin: 'anonymous' })),
	]
})

/**
 * 模型文章：空闲时预热运行时 + 解析三件套，
 * 滚动到预览器时通常已经命中内存缓存，直接出图。
 */
onMounted(() => {
	if (post.value?.type !== 'model')
		return
	const assets = post.value.ModelAssets
	const warm = () => {
		void loadSpine35Runtime().catch(() => {})
		preloadSpineModel(assets)
	}
	const idle = (window as any).requestIdleCallback as undefined | ((cb: () => void, opts?: { timeout: number }) => void)
	if (idle)
		idle(warm, { timeout: 1800 })
	else
		setTimeout(warm, 320)
})

useHead(() => ({ link: modelPrefetchLinks.value }))

if (import.meta.dev) {
	watchEffect(() => {
		setTocAndMeta()
		layoutStore.setAside(post.value?.meta?.aside as WidgetName[] | undefined)
	})
}
</script>

<template>
<template v-if="post">
	<PostHeader v-bind="post" />
	<PostExcerpt v-if="excerpt" :excerpt />

	<!-- type: model 的文章在正文前嵌入 Spine 模型预览 -->
	<SpineModelViewer
		v-if="post.type === 'model'"
		:assets="post.ModelAssets"
		:name="post.ModelName || post.title"
		:type="post.type"
	/>

	<!-- 使用 float-in 动画会导致搜索跳转不准确 -->
	<ContentRenderer
		class="article"
		:class="getPostTypeClassName(post?.type, { prefix: 'md' })"
		:value="post"
		tag="article"
	/>

	<PostFooter v-bind="post" />
	<PostSurround />
	<PostComment />
</template>

<ZError
	v-else
	icon="solar:confounded-square-bold-duotone"
	title="内容为空或页面不存在"
/>
</template>
