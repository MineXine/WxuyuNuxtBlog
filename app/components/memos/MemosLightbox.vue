<!--
  MemosLightbox.vue — 图片灯箱
-->
<script setup lang="ts">
import { computed } from 'vue'
import { useLightboxKeyboard } from '~/composables/useLightbox'

interface Props {
	open: boolean
	images: string[]
	index: number
}

const props = defineProps<Props>()
const emit = defineEmits<{
	close: []
	switch: [delta: number]
}>()

const current = computed(() => props.images[props.index] ?? '')

function close() {
	emit('close')
}
function prev() {
	emit('switch', -1)
}
function next() {
	emit('switch', 1)
}

useLightboxKeyboard(
	{ open: props.open, index: props.index, images: props.images },
	close,
	d => emit('switch', d),
)
</script>

<template>
<Teleport to="body">
	<Transition name="lb-anim">
		<div v-if="open" class="lb-mask" @click.self="close">
			<button class="lb-close" type="button" aria-label="关闭" @click="close">
				✕
			</button>
			<button v-if="images.length > 1" class="lb-prev" type="button" aria-label="上一张" @click="prev">
				‹
			</button>
			<button v-if="images.length > 1" class="lb-next" type="button" aria-label="下一张" @click="next">
				›
			</button>
			<div class="lb-stage">
				<img v-if="current" :src="current" :alt="`图片-${index + 1}`" class="lb-img" referrerpolicy="no-referrer">
			</div>
			<div v-if="images.length > 1" class="lb-counter">
				{{ index + 1 }} / {{ images.length }}
			</div>
		</div>
	</Transition>
</Teleport>
</template>

<style scoped lang="scss">
.lb-mask {
	display: flex;
	align-items: center;
	justify-content: center;
	position: fixed;
	inset: 0;
	background: rgb(0 0 0 / 85%);
	backdrop-filter: blur(8px);
	z-index: 999999;
}

.lb-stage {
	display: flex;
	align-items: center;
	justify-content: center;
	max-width: 90vw;
	max-height: 90vh;
}

.lb-img {
	max-width: 100%;
	max-height: 90vh;
	border-radius: 4px;
	box-shadow: 0 0 32px rgb(0 0 0 / 50%);
	object-fit: contain;
}

.lb-close,
.lb-prev,
.lb-next {
	display: flex;
	align-items: center;
	justify-content: center;
	position: absolute;
	border: none;
	border-radius: 50%;
	background: rgb(255 255 255 / 10%);
	color: #FFF;
	transition: background 0.2s ease;
	cursor: pointer;

	&:hover {
		background: rgb(255 255 255 / 20%);
	}
}

.lb-close {
	top: 1.5rem;
	right: 1.5rem;
	width: 2.5rem;
	height: 2.5rem;
	font-size: 1.25rem;
}

.lb-prev {
	top: 50%;
	left: 1.5rem;
	width: 3rem;
	height: 3rem;
	font-size: 2rem;
	transform: translateY(-50%);
}

.lb-next {
	top: 50%;
	right: 1.5rem;
	width: 3rem;
	height: 3rem;
	font-size: 2rem;
	transform: translateY(-50%);
}

.lb-counter {
	position: absolute;
	bottom: 1.5rem;
	left: 50%;
	padding: 0.25rem 0.75rem;
	border-radius: 12px;
	background: rgb(0 0 0 / 40%);
	font-size: 0.875rem;
	color: rgb(255 255 255 / 85%);
	transform: translateX(-50%);
}

// 动画
.lb-anim-enter-active,
.lb-anim-leave-active {
	transition: opacity 0.2s ease;
}

.lb-anim-enter-from,
.lb-anim-leave-to {
	opacity: 0;
}
</style>
