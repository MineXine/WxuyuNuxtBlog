<!--
  MemosItem.vue — 单条碎碎念（卡片布局）

  版式：
    头部：圆形头像 + 昵称／时间·可见范围 + 右侧分类胶囊
    正文：MDC 渲染内容 → 图片附件
    底部：剩余标签（可点击筛选）+ 「查看原文」

  内容渲染：优先走博客 MDC 渲染链路（ContentRenderer + useMdcRender），
  让 memo 里的 ::alert、:badge[]、::link-card 等 MDC 组件真实渲染；
  图片附件独立渲染，不走 MDC 语法。
-->
<script setup lang="ts">
import type { MemosClient } from '~/composables/useMemosApi'
import type { MemosComment, MemosMemo } from '~/types/memos'
import { useRelativeTime } from '~/composables/useLately'
import { useMdcRender } from '~/composables/useMdc'
import { renderMemoContent } from '~/utils/marked'
import { deviceIcon, formatDeviceLabel } from '~/utils/userAgent'

interface Props {
	memo: MemosMemo
	memosUrl: string
	/** 当前激活的标签（用于高亮） */
	activeTag?: string
}

const props = withDefaults(defineProps<Props>(), {
	activeTag: '',
})

const emit = defineEmits<{
	tagclick: [tag: string]
}>()

/** 匹配显式 `::image-bg-lightbox` 块（含块体），用于从 MDC 渲染内容中剔除 */
const IMAGE_BLOCK_RE = /::\s*image-bg-lightbox[\s\S]*?(?=\n::\s|\n$|$)/gi
/** 图片附件扩展名 */
const IMAGE_EXT_RE = /\.(?:jpe?g|png|gif|webp|bmp|avif|svg|heic|heif)$/i
/** 末尾斜杠 */
const TRAILING_SLASH_RE = /\/+$/

const appConfig = useAppConfig()

/** 原始 content */
const rawContent = computed(() => props.memo.content ?? '')

/**
 * 用于 MDC 渲染的 content：
 * - 剥除任何显式的 `::image-bg-lightbox` 块，避免与附件组件重复渲染
 * - 其余 MDC 块（::alert / :badge[] / ::link-card 等）走 ContentRenderer
 */
const contentForRender = computed(() =>
	rawContent.value
		.replace(IMAGE_BLOCK_RE, '')
		.trim(),
)

/** MDC 渲染：解析 memo.content → hast AST，交给 ContentRenderer 渲染博客 MDC 组件 */
const { body } = useMdcRender(() => contentForRender.value)

/** marked + DOMPurify 降级（解析失败或 MDC 尚未就绪时兜底） */
const html = computed(() => renderMemoContent(contentForRender.value))

/** 可渲染的图片附件（过滤掉无地址 / 非图片的附件，避免留下空图集） */
const imageAttachments = computed(() =>
	(props.memo.attachments ?? []).filter((att) => {
		const isImage = att.type?.startsWith('image/')
			|| IMAGE_EXT_RE.test(att.filename ?? '')
		const hasSrc = Boolean(att.src || att.externalLink || att.content)
		return isImage && hasSrc
	}),
)

/** 头像：memo 自带优先，缺失时回落到 memos 专用小图，最后用站点头像 */
const avatarSrc = computed(() =>
	props.memo.creatorAvatar
	|| appConfig.memos?.avatar
	|| appConfig.author?.avatar
	|| '',
)

/** 首标签作为卡片右上角分类，其余标签进入底部 */
const primaryTag = computed(() => props.memo.tags[0] ?? '')
const restTags = computed(() => props.memo.tags.slice(1))

/** 详情页 URL */
const memoUrl = computed(() => {
	const base = props.memosUrl.replace(TRAILING_SLASH_RE, '')
	return `${base}/m/${props.memo.id}`
})

/** 相对时间 + 悬浮绝对时间 */
const { display: relativeTime, tooltip } = useRelativeTime(() => props.memo.createdAt)

/** 可见范围 → 图标 + 文案 */
const visibilityMeta = computed(() => {
	switch (props.memo.visibility) {
		case 'PUBLIC':
			return { icon: 'ph:globe-simple-bold', text: '公开' }
		case 'PROTECTED':
			return { icon: 'ph:users-three-bold', text: '登录可见' }
		default:
			return { icon: 'ph:lock-simple-bold', text: '私密' }
	}
})

/** 头像加载失败时退回首字兜底，避免破图 */
const avatarFailed = ref(false)
watch(avatarSrc, () => {
	avatarFailed.value = false
})

/** 昵称首字（无头像时兜底） */
const initial = computed(() => (props.memo.creatorName || '我').trim().charAt(0))

/* ==================== 发布环境信息 ==================== */

/** IP 属地（发布时记录） */
const ipText = computed(() => props.memo.ipLocation?.text ?? '')
/** 设备信息（网页端 = 浏览器 + 版本号） */
const deviceLabel = computed(() => formatDeviceLabel(props.memo.device))
const deviceIconName = computed(() => deviceIcon(props.memo.device))

/* ==================== 互动（评论 / 喜欢 / 非喜欢 / 收藏） ==================== */

/** 说说上下文（由 MemosTimeline provide，未配置令牌时不可写） */
interface MemosContext {
	client: MemosClient | null
	token: string
}
const ctx = inject<MemosContext | null>('memos-client', null)
/** 是否具备写权限 */
const canWrite = computed(() => Boolean(ctx?.token && ctx?.client))

/** 互动计数（本地乐观更新） */
const stats = reactive({
	like: props.memo.stats?.likeCount ?? 0,
	dislike: props.memo.stats?.dislikeCount ?? 0,
	comment: props.memo.stats?.commentCount ?? 0,
	favorite: props.memo.stats?.favoriteCount ?? 0,
})
/** 本人互动状态 */
const liked = ref(false)
const disliked = ref(false)
const favorited = ref(props.memo.favorited)
/** 评论区 */
const commentOpen = ref(false)
const comments = ref<MemosComment[]>([...(props.memo.comments ?? [])])
const commentText = ref('')
const submitting = ref(false)
/** 互动错误提示 */
const actionError = ref('')

/** 统一的错误提示 */
function reportError(err: unknown) {
	actionError.value = err instanceof Error ? err.message : '操作失败，请稍后再试'
	window.setTimeout(() => {
		actionError.value = ''
	}, 3200)
}

/** 喜欢 / 非喜欢 */
async function toggleReaction(type: 'LIKE' | 'DISLIKE') {
	if (!ctx?.client || !canWrite.value) {
		reportError(new Error('当前说说实例未配置访问令牌，暂不能互动'))
		return
	}
	const isLike = type === 'LIKE'
	const before = isLike ? stats.like : stats.dislike
	const wasActive = isLike ? liked.value : disliked.value
	const nextActive = !wasActive

	// 乐观更新
	if (isLike) {
		liked.value = nextActive
		stats.like += nextActive ? 1 : -1
	}
	else {
		disliked.value = nextActive
		stats.dislike += nextActive ? 1 : -1
	}

	try {
		if (nextActive)
			await ctx.client.addReaction(props.memo, type)
		else
			await ctx.client.removeReaction(props.memo, type)
	}
	catch (err) {
		// 回滚
		if (isLike) {
			liked.value = wasActive
			stats.like = before
		}
		else {
			disliked.value = wasActive
			stats.dislike = before
		}
		reportError(err)
	}
}

/** 收藏 / 取消收藏 */
async function toggleFavorite() {
	if (!ctx?.client || !canWrite.value) {
		reportError(new Error('当前说说实例未配置访问令牌，暂不能互动'))
		return
	}
	const before = stats.favorite
	const next = !favorited.value
	favorited.value = next
	stats.favorite += next ? 1 : -1
	try {
		await ctx.client.setFavorite(props.memo, next)
	}
	catch (err) {
		favorited.value = !next
		stats.favorite = before
		reportError(err)
	}
}

/** 展开 / 收起评论区（首次展开时拉取评论） */
async function toggleComments() {
	commentOpen.value = !commentOpen.value
	if (!commentOpen.value || comments.value.length || !ctx?.client || !canWrite.value)
		return
	try {
		comments.value = await ctx.client.listComments(props.memo)
	}
	catch (err) {
		reportError(err)
	}
}

/** 发表评论 */
async function submitComment() {
	const content = commentText.value.trim()
	if (!content || !ctx?.client || !canWrite.value)
		return
	submitting.value = true
	try {
		const created = await ctx.client.createComment(props.memo, content)
		comments.value.push(created)
		stats.comment += 1
		commentText.value = ''
	}
	catch (err) {
		reportError(err)
	}
	finally {
		submitting.value = false
	}
}
</script>

<template>
<article
	class="memo-item"
	:data-id="`memo-${memo.id}`"
	:data-time="memo.createdAt.toISOString()"
>
	<header class="memo-head">
		<div class="memo-avatar">
			<img
				v-if="avatarSrc && !avatarFailed"
				:src="avatarSrc"
				:alt="memo.creatorName"
				loading="lazy"
				referrerpolicy="no-referrer"
				@error="avatarFailed = true"
			>
			<span v-else class="memo-avatar-fallback">{{ initial }}</span>
		</div>

		<div class="memo-who">
			<span class="memo-name">{{ memo.creatorName || '我' }}</span>
			<span class="memo-meta">
				<time :datetime="memo.createdAt.toISOString()" :title="tooltip">{{ relativeTime }}</time>
				<i aria-hidden="true">·</i>
				<span class="memo-vis">
					<Icon :name="visibilityMeta.icon" />
					{{ visibilityMeta.text }}
				</span>
			</span>
			<!-- 发布环境：IP 属地 + 设备（网页端显示浏览器与版本号） -->
			<span v-if="ipText || deviceLabel" class="memo-origin">
				<span v-if="ipText" class="memo-origin-item">
					<Icon name="ph:map-pin-bold" />
					{{ ipText }}
				</span>
				<span v-if="deviceLabel" class="memo-origin-item">
					<Icon :name="deviceIconName" />
					{{ deviceLabel }}
				</span>
			</span>
		</div>

		<button
			v-if="primaryTag"
			type="button"
			class="memo-cat"
			:class="{ 'is-active': activeTag === primaryTag }"
			@click="emit('tagclick', primaryTag)"
		>
			<Icon name="ph:tag-bold" />
			<span>{{ primaryTag }}</span>
		</button>
	</header>

	<div class="memo-content">
		<ContentRenderer v-if="body" :value="body" />
		<div v-else v-html="html" />
	</div>

	<MemosAttachments
		v-if="imageAttachments.length"
		variant="inline"
		:attachments="imageAttachments"
	/>

	<footer class="memo-foot">
		<div class="memo-tags">
			<button
				v-for="tag in restTags"
				:key="tag"
				type="button"
				class="memo-tag"
				:class="{ 'is-active': activeTag === tag }"
				@click="emit('tagclick', tag)"
			>
				#{{ tag }}
			</button>
		</div>

		<!-- 互动：评论 / 喜欢 / 非喜欢 / 收藏 -->
		<div class="memo-actions">
			<button
				type="button"
				class="memo-action"
				:class="{ 'is-active': commentOpen }"
				title="评论"
				@click="toggleComments"
			>
				<Icon name="ph:chat-circle-bold" />
				<span>评论</span>
				<em v-if="stats.comment">{{ stats.comment }}</em>
			</button>
			<button
				type="button"
				class="memo-action is-like"
				:class="{ 'is-active': liked }"
				:title="canWrite ? '喜欢' : '未配置访问令牌，暂不能互动'"
				@click="toggleReaction('LIKE')"
			>
				<Icon name="ph:thumbs-up-bold" />
				<span>喜欢</span>
				<em v-if="stats.like">{{ stats.like }}</em>
			</button>
			<button
				type="button"
				class="memo-action is-dislike"
				:class="{ 'is-active': disliked }"
				:title="canWrite ? '非喜欢' : '未配置访问令牌，暂不能互动'"
				@click="toggleReaction('DISLIKE')"
			>
				<Icon name="ph:thumbs-down-bold" />
				<span>非喜欢</span>
				<em v-if="stats.dislike">{{ stats.dislike }}</em>
			</button>
			<button
				type="button"
				class="memo-action is-star"
				:class="{ 'is-active': favorited }"
				:title="canWrite ? '收藏' : '未配置访问令牌，暂不能互动'"
				@click="toggleFavorite"
			>
				<Icon name="ph:star-bold" />
				<span>收藏</span>
				<em v-if="stats.favorite">{{ stats.favorite }}</em>
			</button>
		</div>
	</footer>

	<!-- 评论区 -->
	<transition name="memo-comment">
		<section v-if="commentOpen" class="memo-comments">
			<ul v-if="comments.length" class="memo-comment-list">
				<li v-for="item in comments" :key="item.id" class="memo-comment">
					<span class="memo-comment-head">
						<b>{{ item.creatorName || '访客' }}</b>
						<i v-if="item.ipLocation">{{ item.ipLocation }}</i>
					</span>
					<p>{{ item.content }}</p>
				</li>
			</ul>
			<p v-else class="memo-comment-empty">
				还没有评论，来抢沙发
			</p>

			<div v-if="canWrite" class="memo-comment-editor">
				<textarea
					v-model="commentText"
					class="memo-comment-input"
					rows="2"
					maxlength="500"
					placeholder="写下你的评论…"
				/>
				<button
					type="button"
					class="memo-comment-send"
					:disabled="submitting || !commentText.trim()"
					@click="submitComment"
				>
					{{ submitting ? '发送中' : '发送' }}
				</button>
			</div>
			<p v-else class="memo-comment-tip">
				当前说说实例未配置访问令牌，暂不能发表评论
			</p>

			<p v-if="actionError" class="memo-action-error">
				{{ actionError }}
			</p>

			<a class="memo-source-link" :href="memoUrl" target="_blank" rel="noopener">
				在 Memos 查看原文
				<Icon name="ph:arrow-up-right-bold" />
			</a>
		</section>
	</transition>
</article>
</template>

<style scoped lang="scss">
.memo-item {
	position: relative;

	// 不裁剪：时间轴上的节点圆点在卡片左侧外，不能被 overflow 切掉
	margin: 0 0 0.9rem;
	padding: 0.95rem 1rem 0.75rem 1.15rem;
	border: 1px solid var(--c-border);
	border-radius: 1.05rem;
	box-shadow:
		0 1px 2px rgb(0 0 0 / 4%),
		inset 0 1px 0 rgb(255 255 255 / 40%);
	background: var(--c-bg-1);
	transition: border-color 0.24s ease, box-shadow 0.24s ease, transform 0.24s ease;

	/* 卡片化：供时间线以双列瀑布流排布 */
	break-inside: avoid;

	/* 左侧主色竖条：静止时若隐若现，hover 时点亮 */
	&::after {
		content: "";
		position: absolute;
		opacity: 0;
		top: 0.9rem;
		bottom: 0.9rem;
		left: 0;
		width: 3px;
		border-radius: 0 3px 3px 0;
		background: linear-gradient(180deg, var(--c-primary), color-mix(in oklab, var(--c-primary) 35%, transparent));
		transform: scaleY(0.4);
		transform-origin: center;
		transition: opacity 0.26s ease, transform 0.26s ease;
	}

	&:hover {
		border-color: var(--c-primary-soft);
		box-shadow:
			0 16px 32px rgb(0 0 0 / 9%),
			inset 0 1px 0 rgb(255 255 255 / 55%);
		transform: translateY(-3px);

		&::after {
			opacity: 1;
			transform: scaleY(1);
		}
	}
}

/* ── 头部 ── */
.memo-head {
	display: flex;
	align-items: center;
	gap: 0.65rem;
	margin-bottom: 0.6rem;
}

.memo-avatar {
	flex: none;
	overflow: hidden;
	width: 2.35rem;
	height: 2.35rem;
	border-radius: 50%;
	box-shadow: 0 0 0 1px var(--c-border);
	background: var(--c-bg-2);
	transition: box-shadow 0.24s ease;

	img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	/* 悬停时头像描一圈主色，视线自然落到内容上 */
	.memo-item:hover & {
		box-shadow: 0 0 0 2px var(--c-bg-1), 0 0 0 3px var(--c-primary-soft);
	}

	&-fallback {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		font-size: 0.95rem;
		font-weight: 600;
		color: var(--c-text-3);
	}
}

.memo-who {
	display: flex;
	flex: 1;
	flex-direction: column;
	gap: 0.1rem;
	min-width: 0;
}

.memo-name {
	overflow: hidden;
	font-size: 0.9rem;
	font-weight: 600;
	line-height: 1.3;
	white-space: nowrap;
	text-overflow: ellipsis;
	color: var(--c-text-1);
}

.memo-meta {
	display: inline-flex;
	align-items: center;
	gap: 0.3rem;
	width: fit-content;
	padding: 0.08rem 0.5rem;
	border-radius: 999px;
	background: var(--c-bg-2);
	font-size: 0.7rem;
	line-height: 1.45;
	color: var(--c-text-3);

	i {
		opacity: 0.6;
		font-style: normal;
	}
}

.memo-vis {
	display: inline-flex;
	align-items: center;
	gap: 0.15rem;
}

/* 分类胶囊 */
.memo-cat {
	display: inline-flex;
	flex: none;
	align-items: center;
	gap: 0.2rem;
	padding: 0.18rem 0.5rem;
	border: 1px solid transparent;
	border-radius: 999px;
	background: var(--c-bg-2);
	font-size: 0.7rem;
	line-height: 1.4;
	white-space: nowrap;
	color: var(--c-text-3);
	transition: color 0.2s ease, background 0.2s ease, border-color 0.2s ease;
	cursor: pointer;

	&:hover,
	&.is-active {
		border-color: var(--c-primary-soft);
		background: var(--c-primary-soft);
		color: var(--c-primary);
	}
}

/* ── 正文 ── */
.memo-content {
	overflow-wrap: anywhere;
	font-size: 0.89rem;
	letter-spacing: 0.02em;
	line-height: 1.8;
	color: var(--c-text-1);

	:deep(p) {
		margin: 0 0 0.45rem;

		/* 不保留 pre-wrap：Memos 用 <br> 换行，pre-wrap 会把 <br> 后的换行再算一次，出现空行 */
		white-space: normal;
		color: inherit;
	}

	:deep(p:last-child) {
		margin-bottom: 0;
	}

	:deep(a) {
		text-decoration: none;
		color: var(--c-primary);

		&:hover {
			text-decoration: underline;
		}
	}

	:deep(img) {
		max-width: 100%;
		border-radius: 0.6rem;
	}

	:deep(pre) {
		overflow-x: auto;
		padding: 0.65rem 0.8rem;
		border-radius: 0.6rem;
		background: var(--c-bg-2);
		font-size: 0.8rem;
	}

	:deep(code) {
		font-size: 0.86em;
	}

	:deep(blockquote) {
		margin: 0.4rem 0;
		padding: 0.1rem 0 0.1rem 0.7rem;
		border-left: 3px solid var(--c-primary-soft);
		color: var(--c-text-2);
	}
}

/* ── 底部 ── */
.memo-foot {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 0.6rem;
	margin-top: 0.7rem;
	padding-top: 0.55rem;
	border-top: 1px dashed var(--c-border);
}

.memo-tags {
	display: flex;
	flex-wrap: wrap;
	gap: 0.3rem;
	min-width: 0;
}

.memo-tag {
	padding: 0.1rem 0.45rem;
	border: none;
	border-radius: 999px;
	background: transparent;
	font-size: 0.7rem;
	line-height: 1.5;
	color: var(--c-text-3);
	transition: color 0.2s ease, background 0.2s ease;
	cursor: pointer;

	&:hover,
	&.is-active {
		background: var(--c-primary-soft);
		color: var(--c-primary);
	}
}

.memo-more {
	display: inline-flex;
	flex: none;
	align-items: center;
	gap: 0.1rem;
	font-size: 0.72rem;
	text-decoration: none;
	color: var(--c-text-3);
	transition: color 0.2s ease, gap 0.2s ease;

	&:hover {
		gap: 0.25rem;
		color: var(--c-primary);
	}
}

/* ── 时间线卡片微调（配合 MemosTimeline 的日期分组） ── */
.memo-item {
	// 左侧留出竖条的空间
	padding: 0.95rem 1.1rem 0.8rem 1.25rem;
	border-radius: 1.05rem;
	background: linear-gradient(180deg, color-mix(in oklab, var(--c-bg-1) 96%, var(--c-primary) 4%) 0%, var(--c-bg-1) 42%);

	&:hover {
		box-shadow:
			0 18px 36px rgb(0 0 0 / 9%),
			0 2px 6px rgb(0 0 0 / 4%);
	}
}

.memo-avatar {
	box-shadow:
		0 0 0 2px var(--c-bg-1),
		0 0 0 3px var(--c-border);
	transition: box-shadow 0.24s ease;
}

.memo-item:hover .memo-avatar {
	box-shadow:
		0 0 0 2px var(--c-bg-1),
		0 0 0 3px var(--c-primary-soft);
}

.memo-name {
	font-size: 0.9rem;
	letter-spacing: 0.01em;
}

.memo-content {
	font-size: 0.92rem;
	letter-spacing: 0.01em;
	line-height: 1.85;

	/* 空段落（Memos 里的多余换行）不占位，避免卡片中间出现大片空白 */
	:deep(p:empty) {
		display: none;
	}

	:deep(br + br) {
		line-height: 0.6;
	}
}

.memo-cat {
	padding: 0.16rem 0.55rem;
	background: color-mix(in oklab, var(--c-primary) 8%, var(--c-bg-2));
	color: color-mix(in oklab, var(--c-primary) 65%, var(--c-text-3));
}

/* 底部操作区 */
.memo-foot {
	border-top-color: color-mix(in oklab, var(--c-border) 70%, transparent);
}

.memo-tag {
	border: 1px solid transparent;

	&:hover,
	&.is-active {
		border-color: color-mix(in oklab, var(--c-primary) 35%, transparent);
		background: var(--c-primary-soft);
		color: var(--c-primary);
	}
}

.memo-more {
	padding: 0.14rem 0.6rem;
	border: 1px solid var(--c-border);
	border-radius: 999px;
	background: var(--c-bg-2);
	font-weight: 600;

	&:hover {
		border-color: var(--c-primary-soft);
		background: var(--c-primary-soft);
		color: var(--c-primary);
	}
}

@media (max-width: 768px) {
	.memo-item {
		padding: 0.85rem 0.9rem 0.65rem 1rem;
		border-radius: 0.9rem;
	}

	.memo-content {
		font-size: 0.86rem;
		line-height: 1.72;
	}
}

/* ── 发布环境：IP 属地 + 设备 ── */
.memo-origin {
	display: inline-flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 0.3rem 0.75rem;
	margin-top: 0.1rem;
	font-size: 0.68rem;
	color: var(--c-text-3);
}

.memo-origin-item {
	display: inline-flex;
	align-items: center;
	gap: 0.2rem;
	white-space: nowrap;
}

/* ── 互动按钮 ── */
.memo-actions {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 0.25rem;
	margin-left: auto;
}

.memo-action {
	display: inline-flex;
	align-items: center;
	gap: 0.22rem;
	padding: 0.22rem 0.5rem;
	border: 1px solid transparent;
	border-radius: 999px;
	background: transparent;
	font-size: 0.72rem;
	line-height: 1.4;
	white-space: nowrap;
	color: var(--c-text-3);
	transition: color 0.2s ease, background 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
	cursor: pointer;

	em {
		opacity: 0.75;
		font-style: normal;
		font-variant-numeric: tabular-nums;
	}

	&:hover {
		border-color: var(--c-border);
		background: var(--c-bg-2);
		color: var(--c-primary);
	}

	&:active {
		transform: scale(0.94);
	}

	/* 喜欢：主色 */
	&.is-like.is-active {
		border-color: color-mix(in oklab, var(--c-primary) 35%, transparent);
		background: color-mix(in oklab, var(--c-primary) 12%, transparent);
		color: var(--c-primary);
	}

	/* 非喜欢：冷色 */
	&.is-dislike.is-active {
		border-color: color-mix(in oklab, #6B8EAE 45%, transparent);
		background: color-mix(in oklab, #6B8EAE 14%, transparent);
		color: #5C86AC;
	}

	/* 收藏：琥珀色 */
	&.is-star.is-active {
		border-color: color-mix(in oklab, #D9A85C 45%, transparent);
		background: color-mix(in oklab, #D9A85C 14%, transparent);
		color: #C08A3E;
	}

	/* 评论展开态 */
	&.is-active:not(.is-like, .is-dislike, .is-star) {
		border-color: var(--c-border);
		background: var(--c-bg-2);
		color: var(--c-primary);
	}
}

/* ── 评论区 ── */
.memo-comments {
	margin-top: 0.6rem;
	padding: 0.7rem 0.8rem 0.75rem;
	border: 1px solid var(--c-border);
	border-radius: 0.85rem;
	background: color-mix(in oklab, var(--c-bg-2) 60%, var(--c-bg-1));
}

.memo-comment-list {
	display: flex;
	flex-direction: column;
	gap: 0.55rem;
	margin: 0;
	padding: 0;
	list-style: none;

	.memo-comment {
		padding: 0.45rem 0.6rem;
		border-radius: 0.6rem;
		background: var(--c-bg-1);
	}

	p {
		overflow-wrap: anywhere;
		margin: 0.15rem 0 0;
		font-size: 0.82rem;
		line-height: 1.65;
		color: var(--c-text-1);
	}
}

.memo-comment-head {
	display: flex;
	align-items: center;
	gap: 0.45rem;

	b {
		font-size: 0.76rem;
		font-weight: 600;
		color: var(--c-text-2);
	}

	i {
		font-size: 0.66rem;
		font-style: normal;
		color: var(--c-text-3);
	}
}

.memo-comment-empty {
	margin: 0;
	padding: 0.5rem 0.1rem;
	font-size: 0.78rem;
	color: var(--c-text-3);
}

.memo-comment-editor {
	display: flex;
	align-items: flex-end;
	gap: 0.5rem;
	margin-top: 0.6rem;
}

.memo-comment-input {
	flex: 1;
	min-width: 0;
	padding: 0.45rem 0.6rem;
	border: 1px solid var(--c-border);
	border-radius: 0.6rem;
	background: var(--c-bg-1);
	font-family: inherit;
	font-size: 0.8rem;
	line-height: 1.55;
	color: var(--c-text-1);
	resize: vertical;

	&:focus {
		border-color: var(--c-primary-soft);
		outline: none;
	}
}

.memo-comment-send {
	flex: none;
	padding: 0.4rem 1rem;
	border: none;
	border-radius: 0.6rem;
	background: var(--c-primary);
	font-size: 0.78rem;
	color: #FFF;
	transition: opacity 0.2s ease, transform 0.2s ease;
	cursor: pointer;

	&:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	&:active:not(:disabled) {
		transform: scale(0.96);
	}
}

.memo-comment-tip {
	margin: 0.55rem 0 0;
	font-size: 0.72rem;
	color: var(--c-text-3);
}

.memo-action-error {
	margin: 0.5rem 0 0;
	font-size: 0.72rem;
	color: var(--c-error, #D55);
}

.memo-comment-enter-active,
.memo-comment-leave-active {
	transition: opacity 0.22s ease, transform 0.22s ease;
}

.memo-comment-enter-from,
.memo-comment-leave-to {
	opacity: 0;
	transform: translateY(-4px);
}

.memo-source-link {
	display: inline-flex;
	align-items: center;
	gap: 0.2rem;
	margin-top: 0.6rem;
	font-size: 0.7rem;
	text-decoration: none;
	color: var(--c-text-3);
	transition: color 0.2s ease;

	&:hover {
		color: var(--c-primary);
	}
}
</style>
