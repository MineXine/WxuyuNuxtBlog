<script setup lang="ts">
import MetingPlayer from '~/components/player/MetingPlayer.vue'

withDefaults(defineProps<{
	tag?: string
}>(), {
	tag: 'div',
})
const appConfig = useAppConfig()
</script>

<template>
<div class="blog-header-row">
	<UtilLink class="blog-header">
		<NuxtImg
			:src="appConfig.header.logo"
			class="blog-logo round-cobblestone"
			:class="{ circle: appConfig.header.showTitle }"
			:alt="appConfig.title"
		/>
		<div v-if="appConfig.header.showTitle" class="blog-text">
			<component :is="tag" class="header-title">
				<span
					v-for="(char, charIndex) in appConfig.title"
					:key="charIndex"
					class="split-char"
					:style="getFixedDelay((charIndex + 1) * .1)"
					v-text="char"
				/>
			</component>

			<div class="header-subtitle">
				{{ appConfig.header.subtitle }}
			</div>
		</div>
	</UtilLink>

	<!-- 音乐播放器胶囊：停在 blog-text 旁边，移动端不显示 -->
	<MetingPlayer v-if="appConfig.header.showTitle" />
</div>
</template>

<style lang="scss" scoped>
.blog-header-row {
	display: flex;
	align-items: center;
	gap: 0.5rem;

	/* 标题区优先保住宽度，别被胶囊挤成竖排 */
	.blog-header {
		flex: 3 1 auto;
		min-width: 0;
	}

	.blog-text {
		overflow: hidden;
		min-width: 0;
	}

	.header-title {
		overflow: hidden;
		white-space: nowrap;
	}

	.header-subtitle {
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}
}

.blog-header {
	contain: layout;
	display: flex;
	align-items: center;
	gap: 0.5em;
	position: relative;
	margin: clamp(1rem, 2rem, 5vh) 1rem min(1rem, 5vh);
	line-height: 1.4;
	color: var(--c-text);
	user-select: none;
}

.blog-logo {
	height: 3em;
	border-radius: 50%;

	&.circle {
		width: 3em;
		box-shadow: var(--box-shadow-1), var(--box-shadow-3);
	}
}

.header-title {
	font-family: "LXGW WenKai GB Screen", "LXGW WenKai", "Noto Sans SC", sans-serif;
	font-size: 1.5em;
	font-synthesis: none;
	font-variation-settings: "wght" 600, "BEVL" 100;

	> .split-char {
		animation: 3.14s infinite alternate vf-weight, 2.72s infinite alternate vf-bevel;
		animation-delay: var(--delay);
		animation-play-state: paused;
	}
}

.header-subtitle {
	opacity: 0.5;
	font-size: 0.8em;
}

@keyframes vf-weight {
	0% { font-weight: 600; }
	38.2% { font-weight: 300; }
	100% { font-weight: 900; }
}

@keyframes vf-bevel {
	from { font-variation-settings: "BEVL" 100; }
	to { font-variation-settings: "BEVL" 1; }
}
</style>
