<script setup lang="ts">
import type { MetingPlayMode } from '~/meting.config'
import { METING_MODE_ICON, METING_MODE_LABEL, metingConfig, useMetingRuntimeConfig } from '~/meting.config'

const props = defineProps<{
	show?: boolean
	open?: boolean
	duration?: number
	onClose?: () => void
}>()
const emit = defineEmits<{
	close: []
}>()

// 兼容两种调用方：
// - 本地 usePopoverStore: 传 show
// - @bikariya/modals:     传 open
const visible = computed(() => Boolean(props.open ?? props.show))

function handleClose() {
	if (props.onClose) {
		props.onClose()
	}
	else {
		emit('close')
	}
}

// Meting 播放器运行时配置（开关 / 音量 / 播放模式）
const { enabled, volume, mode, setEnabled, setVolume, setMode } = useMetingRuntimeConfig()
const modeList: MetingPlayMode[] = ['list', 'single', 'random']
</script>

<template>
<Transition name="float-in">
	<div v-if="visible" class="popover-mask" @click="handleClose" />
</Transition>

<Transition name="float-in">
	<div v-if="visible" class="popover-panel">
		<div class="panel-header">
			<h2>
				音乐选择器
			</h2>
			<div class="header-right">
				<label class="music-toggle" title="开关音乐播放器">
					<span class="toggle-label">播放器</span>
					<input
						type="checkbox"
						:checked="enabled"
						class="toggle-input"
						@change="setEnabled(($event.target as HTMLInputElement).checked)"
					>
					<span class="toggle-track">
						<span class="toggle-thumb" />
					</span>
				</label>
				<button class="close-btn" aria-label="关闭" @click="handleClose">
					<Icon name="ph:x-bold" />
				</button>
			</div>
		</div>

		<div class="panel-content">
			<div class="setting-row">
				<span class="setting-label">播放模式</span>
				<div class="mode-list">
					<button
						v-for="item in modeList"
						:key="item"
						type="button"
						class="mode-btn"
						:class="{ 'is-active': mode === item }"
						@click="setMode(item)"
					>
						<Icon :name="METING_MODE_ICON[item]" />
						<span>{{ METING_MODE_LABEL[item] }}</span>
					</button>
				</div>
			</div>
			<div class="setting-row">
				<span class="setting-label">音量</span>
				<input
					type="range"
					class="volume-range"
					min="0"
					max="100"
					:value="Math.round(volume * 100)"
					@input="setVolume(Number(($event.target as HTMLInputElement).value) / 100)"
				>
			</div>
			<p class="setting-tip">
				歌单 ID：{{ metingConfig.playlistId }}（在 <code>app/meting.config.ts</code> 里改）
			</p>
		</div>
	</div>
</Transition>
</template>

<style lang="scss" scoped>
.popover-mask {
	position: fixed;
	inset: 0;
	background-color: #0003;
	backdrop-filter: blur(0.2em);
	transition: opacity var(--delay, 200);
	z-index: 100;

	&.v-enter-from,
	&.v-leave-to {
		opacity: 0;
	}
}

.popover-panel {
	--float-distance: 20vh;

	position: fixed;
	overflow-y: auto;
	top: 50%;
	left: 50%;
	width: 95%;
	max-width: 500px;
	max-height: 85vh;
	max-height: 85dvh;
	padding: 1.2em;
	border: 1px solid var(--c-primary);
	border-radius: 1em;
	box-shadow: 0 0.25em 0.5em var(--ld-shadow);
	background-color: var(--ld-bg-card);
	transform: translate(-50%, -50%);
	transition: all var(--delay, 200);
	z-index: 1000;

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 1em;

		h2 {
			margin: 0;
			font-size: 1.2em;
			font-weight: 600;
			color: var(--c-text);
		}

		.header-right {
			display: flex;
			align-items: center;
			gap: 0.6em;
		}

		.close-btn {
			padding: 0.4em;
			border: none;
			border-radius: 0.5em;
			background-color: transparent;
			color: var(--c-text-2);
			transition: all 0.1s;
			cursor: pointer;

			&:hover {
				background-color: var(--c-bg-soft);
				color: var(--c-text-1);
			}
		}

		.music-toggle {
			display: inline-flex;
			align-items: center;
			gap: 0.4em;
			cursor: pointer;
			user-select: none;

			.toggle-label {
				font-size: 0.78em;
				color: var(--c-text-2);
			}

			.toggle-input {
				position: absolute;
				opacity: 0;
				width: 0;
				height: 0;
				pointer-events: none;
			}

			.toggle-track {
				position: relative;
				width: 2.4em;
				height: 1.3em;
				border-radius: 1em;
				background: var(--c-border, hsl(0deg 0% 80%));
				transition: background 0.2s ease;

				.toggle-thumb {
					position: absolute;
					top: 0.15em;
					left: 0.15em;
					width: 1em;
					height: 1em;
					border-radius: 50%;
					box-shadow: 0 1px 3px hsl(0deg 0% 0% / 18%);
					background: #FFF;
					transition: transform 0.2s ease;
				}
			}

			.toggle-input:checked + .toggle-track {
				background: var(--c-primary, hsl(355deg 70% 62%));

				.toggle-thumb {
					transform: translateX(1.1em);
				}
			}
		}
	}

	.panel-content {
		display: flex;
		flex-direction: column;
		gap: 0.9em;
		font-size: 0.95em;
		line-height: 1.6;
		color: var(--c-text-1);

		.setting-row {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 0.8em;
		}

		.setting-label {
			font-size: 0.85em;
			white-space: nowrap;
			color: var(--c-text-2);
		}

		.mode-list {
			display: flex;
			gap: 0.4em;
		}

		.mode-btn {
			display: inline-flex;
			align-items: center;
			gap: 0.3em;
			padding: 0.3em 0.6em;
			border: 1px solid var(--c-border);
			border-radius: 0.5em;
			background: transparent;
			font-size: 0.78em;
			color: var(--c-text-2);
			transition: all 0.15s;
			cursor: pointer;

			&.is-active {
				border-color: var(--c-primary);
				background: var(--c-primary-soft);
				color: var(--c-primary);
			}
		}

		.volume-range {
			flex: 1;
			max-width: 12em;
			accent-color: var(--c-primary);
		}

		.setting-tip {
			margin: 0;
			font-size: 0.78em;
			color: var(--c-text-3);
		}
	}
}

.float-in-enter-active,
.float-in-leave-active {
	transition: all var(--delay, 200);
}

.float-in-enter-from,
.float-in-leave-to {
	opacity: 0;
	transform: translate(-50%, calc(-50% - 20vh));
}

@media (max-width: 768px) {
	.popover-panel {
		width: 95vw;
		max-height: 75vh;
		max-height: 75dvh;
	}
}
</style>
