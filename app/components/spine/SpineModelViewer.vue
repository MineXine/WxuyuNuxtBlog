<!--
  SpineModelViewer.vue — 模型文章内嵌预览器

  数据来自文章 frontmatter：
    ModelName  模型名称
    ModelAssets.ModelSkel  / ModelImage / ModelAtlas  骨架 / 贴图 / 图集（public 下的静态路径）

  渲染在挂载后进行（构建期只输出占位骨架），因此页面本身可被完全静态化（SSG）。
-->
<script setup lang="ts">
import type { SpineInfo } from '~/composables/useSpineViewer'
import type { SpineModelAssets } from '~/utils/spineAssets'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { loadSpine35Runtime, SpineViewer } from '~/composables/useSpineViewer'
import { fetchSpineModel } from '~/utils/spineAssets'

interface Props {
	assets?: SpineModelAssets
	/** 模型名称（文章 ModelName） */
	name?: string
	/** 文章类型 key（用于类型徽章） */
	type?: string
	/** 紧凑模式：隐藏工具栏与文件清单，只保留舞台（说说 / MDC 内嵌场景） */
	compact?: boolean
}

const props = withDefaults(defineProps<Props>(), {
	assets: () => ({}),
	name: '',
	type: 'model',
	compact: false,
})

const canvasRef = ref<HTMLCanvasElement | null>(null)
const loading = ref(false)
const progress = ref(0)
const fromCache = ref(false)
const cacheSource = ref<'memory' | 'cache' | 'mixed' | 'network'>('network')
const loadMs = ref(0)
const errorMsg = ref('')
const info = ref<SpineInfo | null>(null)
const animations = ref<string[]>([])
const animation = ref('')
const playing = ref(true)
const zoomPercent = ref(100)
const showBones = ref(false)
const background = ref<'dark' | 'light' | 'grid'>('dark')

let viewer: SpineViewer | null = null
let stageObserver: ResizeObserver | null = null

/** 缓存来源文案 */
const cacheLabel = computed(() => {
	switch (cacheSource.value) {
		case 'memory':
			return '内存缓存'
		case 'cache':
			return '磁盘缓存'
		case 'mixed':
			return '部分缓存'
		default:
			return '网络加载'
	}
})

const hasAssets = computed(() => Boolean(
	props.assets?.ModelSkel && props.assets?.ModelAtlas && props.assets?.ModelImage,
))

const assetInfo = computed(() => props.assets ?? {})

async function loadModel() {
	if (!hasAssets.value || !canvasRef.value)
		return
	loading.value = true
	errorMsg.value = ''
	progress.value = 0.02
	try {
		// 运行时与模型资源并行：谁慢等谁，避免串行空等
		const [spine, data] = await Promise.all([
			loadSpine35Runtime(),
			fetchSpineModel(props.assets, (ratio) => {
				progress.value = Math.max(progress.value, ratio)
			}),
		])
		if (!viewer)
			viewer = new SpineViewer(canvasRef.value, spine)

		// 舞台尺寸变化（DevTools 停靠、侧栏折叠、全屏切换）时再校一次视口
		const stage = canvasRef.value.parentElement
		if (stage && !stageObserver && typeof ResizeObserver !== 'undefined') {
			stageObserver = new ResizeObserver(() => {
				requestAnimationFrame(() => viewer?.refresh())
			})
			stageObserver.observe(stage)
		}

		const meta = viewer.load(data.json, data.atlasText, data.textures)
		fromCache.value = data.fromCache
		cacheSource.value = data.source
		loadMs.value = data.loadMs
		animations.value = meta.animations
		animation.value = meta.animations[0] ?? ''
		viewer.showBones = showBones.value
		viewer.playing = playing.value
		viewer.play(animation.value)
		viewer.fit()
		viewer.zoom = zoomPercent.value / 100
		info.value = meta

		// 挂载当帧容器可能还没拿到最终尺寸（尤其是从缓存秒开时），布局稳定后再校一次
		await nextTick()
		requestAnimationFrame(() => {
			viewer?.refresh()
			viewer?.fit()
			if (viewer)
				viewer.zoom = zoomPercent.value / 100
			// 布局稳定后再补一帧，避免首帧按旧尺寸算出的视口比例
			requestAnimationFrame(() => viewer?.refresh())
		})
	}
	catch (err) {
		errorMsg.value = err instanceof Error ? err.message : String(err)
		info.value = null
	}
	finally {
		loading.value = false
	}
}

function resetView() {
	zoomPercent.value = 100
	viewer?.fit()
}

watch(animation, (value) => {
	viewer?.play(value)
})
watch(playing, (value) => {
	if (viewer)
		viewer.playing = value
})
watch(zoomPercent, (value) => {
	if (viewer)
		viewer.zoom = value / 100
})
watch(showBones, (value) => {
	if (viewer)
		viewer.showBones = value
})

onMounted(loadModel)
onBeforeUnmount(() => {
	stageObserver?.disconnect()
	stageObserver = null
	viewer?.dispose()
	viewer = null
})
</script>

<template>
<section class="spine-model" :class="{ 'is-compact': compact }">
	<header class="spine-model-head">
		<div class="spine-model-title">
			<PostTypeBadge :type="type" />
			<span class="spine-model-name">{{ name || '未命名模型' }}</span>
		</div>
		<div class="spine-model-meta">
			<span v-if="info" class="spine-chip">Spine {{ info.version }}</span>
			<span v-if="info" class="spine-chip">{{ info.bones }} 骨骼</span>
			<span v-if="info" class="spine-chip">{{ info.slots }} 槽位</span>
			<span v-if="info" class="spine-chip">{{ info.animations.length }} 动作</span>
			<span v-if="info" class="spine-chip" :class="`is-cache is-${cacheSource}`">{{ cacheLabel }}</span>
			<span v-if="info && loadMs" class="spine-chip">{{ loadMs }} ms</span>
		</div>
	</header>

	<div v-if="!compact" class="spine-model-bar" :class="{ 'is-disabled': !info }">
		<label class="spine-field">
			<span>动画</span>
			<select v-model="animation" class="spine-select">
				<option value="">Setup Pose</option>
				<option v-for="animName in animations" :key="animName" :value="animName">{{ animName }}</option>
			</select>
		</label>
		<button class="spine-btn" type="button" @click="playing = !playing">
			<Icon :name="playing ? 'ph:pause-bold' : 'ph:play-bold'" />
			{{ playing ? '暂停' : '播放' }}
		</button>
		<label class="spine-field is-range">
			<span>缩放 {{ zoomPercent }}%</span>
			<input v-model.number="zoomPercent" type="range" min="10" max="400" step="5" class="spine-range">
		</label>
		<button class="spine-btn" type="button" @click="resetView">
			<Icon name="ph:arrows-out-line-vertical-bold" />
			适配
		</button>
		<label class="spine-toggle">
			<input v-model="showBones" type="checkbox">
			<span>骨骼线框</span>
		</label>
		<div class="spine-bg">
			<button
				v-for="item in (['dark', 'light', 'grid'] as const)"
				:key="item"
				class="spine-bg-dot"
				:class="[`is-${item}`, { 'is-active': background === item }]"
				type="button"
				:title="item === 'dark' ? '深色背景' : item === 'light' ? '浅色背景' : '棋盘背景'"
				@click="background = item"
			/>
		</div>
	</div>

	<div class="spine-model-stage" :class="`is-${background}`">
		<canvas ref="canvasRef" class="spine-model-canvas" />

		<p v-if="!hasAssets" class="spine-model-tip">
			该文章未配置完整的 ModelAssets（需 ModelSkel / ModelImage / ModelAtlas 三项）
		</p>
		<div v-else-if="loading" class="spine-model-loading">
			<Icon name="ph:spinner-gap-bold" class="spine-spin" />
			<span>正在加载模型 {{ Math.round(progress * 100) }}%</span>
			<i class="spine-model-progress" aria-hidden="true">
				<b :style="{ width: `${Math.max(4, Math.round(progress * 100))}%` }" />
			</i>
		</div>
		<transition name="spine-fade">
			<p v-if="errorMsg" class="spine-model-error">
				<Icon name="ph:warning-circle-bold" />
				{{ errorMsg }}
			</p>
		</transition>
	</div>

	<p v-if="assetInfo.ModelSkel && !compact" class="spine-model-files">
		<span>{{ assetInfo.ModelSkel }}</span>
		<span>{{ assetInfo.ModelAtlas }}</span>
		<span>{{ assetInfo.ModelImage }}</span>
	</p>
</section>
</template>

<style lang="scss" scoped>
.spine-model {
	display: flex;
	flex-direction: column;
	gap: 0.6rem;
	min-width: 0;
	margin: 1rem 0;
}

.spine-model-head {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	justify-content: space-between;
	gap: 0.5rem;
}

.spine-model-title {
	display: inline-flex;
	align-items: center;
	gap: 0.5rem;
}

.spine-model-name {
	font-size: 1.02rem;
	font-weight: 700;
	font-variant-numeric: tabular-nums;
}

.spine-model-meta {
	display: inline-flex;
	flex-wrap: wrap;
	gap: 0.35rem;
}

.spine-chip {
	padding: 0.12rem 0.45rem;
	border: 1px solid var(--c-border);
	border-radius: 999px;
	background: var(--c-bg-2);
	font-size: 0.7rem;
	white-space: nowrap;
	color: var(--c-text-3);
}

.spine-model-bar {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 0.55rem 0.8rem;
	padding: 0.55rem 0.7rem;
	border: 1px solid var(--c-border);
	border-radius: 0.5rem;
	background: var(--c-bg-1);

	&.is-disabled {
		opacity: 0.55;
		pointer-events: none;
	}
}

.spine-field {
	display: flex;
	align-items: center;
	gap: 0.4rem;
	font-size: 0.78rem;
	white-space: nowrap;
	color: var(--c-text-2);
}

.spine-select {
	max-width: 11rem;
	padding: 0.25rem 1.3rem 0.25rem 0.5rem;
	border: 1px solid var(--c-border);
	border-radius: 0.4rem;
	background: var(--c-bg-2);
	font-size: 0.78rem;
	color: var(--c-text-1);
}

.spine-range {
	width: 7rem;
	accent-color: var(--c-primary);
}

.spine-btn {
	display: inline-flex;
	align-items: center;
	gap: 0.3rem;
	padding: 0.28rem 0.65rem;
	border: 1px solid var(--c-border);
	border-radius: 0.4rem;
	background: var(--c-bg-2);
	font-size: 0.78rem;
	color: var(--c-text-1);
	transition: border-color 0.2s ease, color 0.2s ease;
	cursor: pointer;

	&:hover {
		border-color: var(--c-primary);
		color: var(--c-primary);
	}
}

.spine-toggle {
	display: inline-flex;
	align-items: center;
	gap: 0.3rem;
	font-size: 0.78rem;
	color: var(--c-text-2);
	cursor: pointer;

	input {
		accent-color: var(--c-primary);
	}
}

.spine-bg {
	display: inline-flex;
	align-items: center;
	gap: 0.35rem;
	margin-left: auto;
}

.spine-bg-dot {
	width: 1.05rem;
	height: 1.05rem;
	padding: 0;
	border: 2px solid transparent;
	border-radius: 50%;
	transition: border-color 0.2s ease;
	cursor: pointer;

	&.is-dark { background: #14161A; }
	&.is-light { background: #F1F3F5; }

	&.is-grid {
		background: repeating-conic-gradient(#D8DBE0 0% 25%, #F5F6F8 0% 50%) 50% / 0.55rem 0.55rem;
	}

	&.is-active {
		border-color: var(--c-primary);
	}
}

.spine-model-stage {
	display: flex;

	// 不参与 flex 收缩：DevTools 停靠导致视口变矮时，舞台不会被压扁
	flex: none;
	align-items: center;
	justify-content: center;
	position: relative;
	overflow: hidden;

	// 高度只跟宽度走（aspect-ratio），不再用 vh：
	// DevTools 停靠/收起只改变视口高度，舞台尺寸不变，模型不会被瞬时的 CSS/缓冲差异拉扁或拉长
	width: 100%;
	min-height: 300px;
	max-height: 620px;
	aspect-ratio: 4 / 3;
	border: 1px solid var(--c-border);
	border-radius: 0.6rem;
	box-sizing: border-box;

	&.is-dark { background: #14161A; }
	&.is-light { background: #F1F3F5; }

	&.is-grid {
		background: repeating-conic-gradient(#E3E6EA 0% 25%, #F7F8FA 0% 50%) 50% / 1.2rem 1.2rem;
	}
}

.spine-model.is-compact {
	gap: 0.4rem;
	margin: 0.6rem 0;

	.spine-model-head {
		padding: 0 0.15rem;
	}

	.spine-model-name {
		font-size: 0.92rem;
	}

	.spine-model-stage {
		min-height: 220px;
		max-height: 420px;
		aspect-ratio: 16 / 10;
		border-radius: 0.85rem;
	}
}

.spine-model-canvas {
	display: block;
	width: 100%;
	height: 100%;

	// 画布的 CSS 盒与像素缓冲由运行时统一推导，这里只负责占位
	box-sizing: border-box;
	cursor: grab;
	touch-action: none;

	&:active {
		cursor: grabbing;
	}
}

.spine-model-tip {
	position: absolute;
	margin: 0;
	padding: 0 1rem;
	font-size: 0.82rem;
	text-align: center;
	color: var(--c-text-3);
}

.spine-model-loading {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 0.4rem 0.5rem;
	position: absolute;
	min-width: 11rem;
	padding: 0.45rem 0.95rem 0.55rem;
	border-radius: 0.6rem;
	background: rgb(0 0 0 / 58%);
	font-size: 0.78rem;
	color: #FFF;
}

.spine-model-progress {
	display: block;
	flex: 1 0 100%;
	overflow: hidden;
	height: 2px;
	border-radius: 999px;
	background: rgb(255 255 255 / 22%);

	b {
		display: block;
		height: 100%;
		border-radius: inherit;
		background: linear-gradient(90deg, #F0D197, #D9A85C);
		transition: width 0.2s ease;
	}
}

.spine-chip.is-cache {
	border-color: color-mix(in oklab, #4F9A6A 45%, var(--c-border));
	color: color-mix(in oklab, #4F9A6A 70%, var(--c-text-2));

	/* 走网络时用中性色，避免和「已缓存」混淆 */
	&.is-network {
		border-color: var(--c-border);
		color: var(--c-text-3);
	}

	/* 部分命中：琥珀色提示还有资源要走网络 */
	&.is-mixed {
		border-color: color-mix(in oklab, #D9A85C 45%, var(--c-border));
		color: color-mix(in oklab, #D9A85C 75%, var(--c-text-2));
	}
}

.spine-spin {
	animation: spine-spin 1s linear infinite;
}

@keyframes spine-spin {
	to { transform: rotate(360deg); }
}

.spine-model-error {
	display: flex;
	align-items: center;
	gap: 0.35rem;
	position: absolute;
	bottom: 0.7rem;
	left: 50%;
	max-width: calc(100% - 1.4rem);
	margin: 0;
	padding: 0.42rem 0.85rem;
	border: 1px solid var(--c-error, #D55);
	border-radius: 0.5rem;
	background: color-mix(in oklab, var(--c-error, #D55) 12%, var(--c-bg-1));
	font-size: 0.78rem;
	color: var(--c-error, #D55);
	transform: translateX(-50%);
}

.spine-fade-enter-active,
.spine-fade-leave-active {
	transition: opacity 0.25s ease, transform 0.25s ease;
}

.spine-fade-enter-from,
.spine-fade-leave-to {
	opacity: 0;
	transform: translate(-50%, 6px);
}

.spine-model-files {
	display: flex;
	flex-wrap: wrap;
	gap: 0.3rem 0.8rem;
	margin: 0;
	font-family: var(--font-monospace, ui-monospace, monospace);
	font-size: 0.7rem;
	color: var(--c-text-3);

	span {
		overflow: hidden;
		max-width: 100%;
		white-space: nowrap;
		text-overflow: ellipsis;
	}
}

@media (max-width: 768px) {
	.spine-model-stage {
		min-height: 260px;
		max-height: 58vh;
		aspect-ratio: 1 / 1;
	}

	.spine-range {
		width: 5rem;
	}
}
</style>
