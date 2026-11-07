<!--
  MemosHero.vue — 碎碎念页面顶部横幅

  新版式：
  - 圆角封面 + 双层遮罩（底部深、左侧深），保证文字可读
  - 左下：eyebrow 小标 + 主标题 + 签名
  - 右下：圆形头像（白描边 + 柔光）
  - 悬停时封面轻微推近，保持页面有呼吸感
-->
<script setup lang="ts">
interface Props {
	/** 主标题（站点作者名） */
	title: string
	/** 副标题（站点签名） */
	desc?: string
	/** 头像地址 */
	avatar?: string
	/** 封面图地址 */
	cover?: string
}

withDefaults(defineProps<Props>(), {
	desc: '',
	avatar: '',
	cover: '',
})
</script>

<template>
<header class="memos-hero">
	<NuxtImg
		v-if="cover"
		class="memos-hero-cover"
		:src="cover"
		:alt="title"
		loading="eager"
		fetchpriority="high"
		decoding="async"
	/>
	<span class="memos-hero-mask" aria-hidden="true" />
	<span class="memos-hero-grid" aria-hidden="true" />
	<span class="memos-hero-glow" aria-hidden="true" />

	<div class="memos-hero-inner">
		<div class="memos-hero-text">
			<span class="memos-hero-eyebrow">
				<i aria-hidden="true" />
				MEMOS · 碎碎念
			</span>
			<h1 class="memos-hero-name">
				{{ title }}
			</h1>
			<span class="memos-hero-rule" aria-hidden="true" />
			<p v-if="desc" class="memos-hero-desc">
				{{ desc }}
			</p>
		</div>

		<div v-if="avatar" class="memos-hero-avatar">
			<img :src="avatar" :alt="title" loading="eager" decoding="async">
		</div>
	</div>

	<span class="memos-hero-scroll" aria-hidden="true">
		<Icon name="ph:caret-down-bold" />
	</span>
</header>
</template>

<style scoped lang="scss">
.memos-hero {
	position: relative;
	overflow: hidden;
	height: clamp(210px, 26vw, 320px);
	margin-bottom: 0.9rem;
	border: 1px solid var(--c-border);
	border-radius: 1.25rem;
	box-shadow:
		0 22px 48px rgb(0 0 0 / 12%),
		inset 0 1px 0 rgb(255 255 255 / 18%);
	background: var(--c-bg-2);
	isolation: isolate;

	&-cover {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		transform: scale(1.02);
		transition: transform 0.9s cubic-bezier(0.22, 0.61, 0.36, 1);
		object-fit: cover;
		object-position: center 36%;
		z-index: 0;
	}

	&:hover &-cover {
		transform: scale(1.06);
	}

	/* 遮罩：底部深、左侧深，保证文字始终可读 */
	&-mask {
		position: absolute;
		inset: 0;
		background:
			linear-gradient(180deg, rgb(0 0 0 / 0%) 26%, rgb(0 0 0 / 68%) 100%),
			linear-gradient(90deg, rgb(0 0 0 / 52%) 0%, rgb(0 0 0 / 10%) 55%, rgb(0 0 0 / 22%) 100%);
		pointer-events: none;
		z-index: 1;
	}

	/* 细网格：给封面一层“界面感” */
	&-grid {
		position: absolute;
		inset: 0;
		background:
			linear-gradient(rgb(255 255 255 / 7%) 1px, transparent 1px) 0 0 / 100% 26px,
			linear-gradient(90deg, rgb(255 255 255 / 7%) 1px, transparent 1px) 0 0 / 26px 100%;
		mask-image: linear-gradient(180deg, rgb(0 0 0 / 55%), transparent 72%);
		pointer-events: none;
		z-index: 1;
	}

	/* 主色光晕 */
	&-glow {
		position: absolute;
		opacity: 0.55;
		right: -6%;
		bottom: -28%;
		width: 46%;
		height: 90%;
		border-radius: 50%;
		background: radial-gradient(circle, color-mix(in oklab, var(--c-primary) 40%, transparent) 0%, transparent 70%);
		filter: blur(18px);
		pointer-events: none;
		z-index: 1;
	}

	&-inner {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 1rem;
		position: absolute;
		inset: auto 1.5rem 1.25rem 1.6rem;
		z-index: 2;
	}

	&-text {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		min-width: 0;
	}

	/* 眉标：小圆点 + 字距 */
	&-eyebrow {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		font-size: 0.66rem;
		font-weight: 600;
		letter-spacing: 0.22em;
		color: rgb(255 255 255 / 74%);

		i {
			width: 6px;
			height: 6px;
			border-radius: 50%;
			box-shadow: 0 0 0 3px rgb(255 255 255 / 16%);
			background: var(--c-primary);
		}
	}

	&-name {
		margin: 0;
		font-size: clamp(1.4rem, 2.8vw, 2rem);
		font-weight: 800;
		letter-spacing: 0.04em;
		line-height: 1.2;
		text-shadow: 0 2px 18px rgb(0 0 0 / 50%);
		color: #FFF;
	}

	/* 标题下的短线 */
	&-rule {
		display: block;
		width: 3.2rem;
		height: 2px;
		margin: 0.1rem 0 0.15rem;
		border-radius: 2px;
		background: linear-gradient(90deg, var(--c-primary), transparent);
	}

	&-desc {
		max-width: 32rem;
		margin: 0;
		font-size: 0.83rem;
		line-height: 1.55;
		text-shadow: 0 1px 10px rgb(0 0 0 / 55%);
		color: rgb(255 255 255 / 88%);
	}

	/* 头像：双层光环 */
	&-avatar {
		flex: none;
		position: relative;
		overflow: hidden;
		width: 4.1rem;
		height: 4.1rem;
		border: 2px solid rgb(255 255 255 / 92%);
		border-radius: 50%;
		box-shadow:
			0 0 0 4px rgb(255 255 255 / 14%),
			0 0 0 8px rgb(255 255 255 / 6%),
			0 12px 28px rgb(0 0 0 / 38%);
		transition: transform 0.5s cubic-bezier(0.22, 0.61, 0.36, 1);

		img {
			display: block;
			width: 100%;
			height: 100%;
			object-fit: cover;
		}
	}

	/* 右下角滚动提示 */
	&-scroll {
		display: grid;
		place-items: center;
		position: absolute;
		right: 1.4rem;
		bottom: 1.35rem;
		width: 1.7rem;
		height: 1.7rem;
		border: 1px solid rgb(255 255 255 / 26%);
		border-radius: 50%;
		background: rgb(0 0 0 / 22%);
		backdrop-filter: blur(6px);
		font-size: 0.72rem;
		color: rgb(255 255 255 / 78%);
		animation: memos-scroll-hint 2.4s ease-in-out infinite;
		pointer-events: none;
		z-index: 2;
	}
}

@keyframes memos-scroll-hint {
	0%,
	100% {
		opacity: 0.75;
		transform: translateY(0);
	}

	50% {
		opacity: 1;
		transform: translateY(4px);
	}
}

@media (max-width: 768px) {
	.memos-hero {
		height: 180px;
		border-radius: 1rem;

		&-inner {
			inset: auto 0.95rem 0.9rem 1rem;
		}

		&-eyebrow {
			font-size: 0.6rem;
			letter-spacing: 0.18em;
		}

		&-desc {
			display: -webkit-box;
			overflow: hidden;
			font-size: 0.74rem;
			-webkit-line-clamp: 1;
			-webkit-box-orient: vertical;
		}

		&-avatar {
			width: 3.1rem;
			height: 3.1rem;
		}

		&-scroll {
			display: none;
		}
	}
}
</style>
