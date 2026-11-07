/**
 * Memos API v1 客户端
 *
 * 仅支持 Memos v0.20+ 标准 API：{memos}/api/v1/memos
 * - 过滤方式：filter=CEL 表达式（creator == "users/xxx"） + 独立 state 参数
 * - 分页：pageToken
 *
 * 注：不同 v1 实例字段命名仍有差异（createTime vs displayTime、
 * tags vs property.tags），保留字段 fallback 以兼容各实例。
 */
import type { MemosAttachment, MemosComment, MemosCommentRaw, MemosDeviceInfo, MemosMemo, MemosMemoRaw, MemosReaction, MemosReactionType, MemosResource } from '~/types/memos'
import { normalizeIpLocation } from '~/utils/ipLocation'
import { parseUserAgent } from '~/utils/userAgent'

/** content 内联标签（#tag） */
const TAG_RE = /#([^\s#]+)/g
/** resourceName 前缀 */
const USER_PREFIX_RE = /^users\//
const MEMO_PREFIX_RE = /^memos\//
const ATTACHMENT_PREFIX_RE = /^attachments\//
/** 末尾斜杠 */
const TRAILING_SLASH_RE = /\/+$/

/** 规范化单条 memo → 内部 MemosMemo */
function normalize(m: MemosMemoRaw): MemosMemo {
	// 附件字段：v1 标准用 attachments，旧版/部分实例用 resources
	const rawResources: MemosResource[] = (m.attachments ?? m.resources ?? []).map((r) => {
		const rr = r as MemosResource
		const src
			= rr.externalLink
				|| rr.data?.url
				|| rr.externalUrl_
				|| rr.url
				|| rr.src
				|| ''
		return { ...rr, src }
	})

	// 创建时间（不同 v1 实例命名差异）
	let createdAt: Date
	if (m.createTime) {
		createdAt = new Date(m.createTime)
	}
	else if (m.displayTime) {
		createdAt = new Date(m.displayTime)
	}
	else {
		createdAt = new Date()
	}

	// 标签（v1: m.tags / m.property.tags，部分实例从 content 正则抽取）
	let tags: string[] = m.tags ?? []
	if (!tags.length && m.property?.tags)
		tags = m.property.tags
	if (!tags.length && m.content) {
		tags = Array.from(m.content.matchAll(TAG_RE), mm => mm[1])
	}

	// 创建者信息
	let creatorName = m.creatorName ?? ''
	let creatorAvatar = m.creatorAvatarUrl ?? ''
	if (!creatorName && typeof m.creator === 'string') {
		// v1 标准 creator 是 resourceName（"users/MineXine"），提取 username 作为显示名
		creatorName = m.creator.replace(USER_PREFIX_RE, '')
	}
	else if (m.creator && typeof m.creator === 'object') {
		creatorName = m.creator.name ?? ''
		creatorAvatar = m.creator.avatarUrl ?? creatorAvatar
	}

	// memo 唯一标识：v1 标准用 name（resourceName memos/{uid}），提取 UID；否则用 id
	const rawName = m.name ?? ''
	const uid = rawName.replace(MEMO_PREFIX_RE, '') || String(m.id ?? '')

	// IP 属地（发布时记录）
	const ipLocation = normalizeIpLocation(m.ipLocation)

	// 设备信息：优先用服务端结构化字段，没有则退回原始 UA 解析
	const device = normalizeDevice(m.device, m.userAgent)

	// 评论：不同实例用 relations / comments 两种字段
	const commentRaws = (m.comments ?? m.relations ?? []) as MemosCommentRaw[]
	const comments: MemosComment[] = commentRaws.map((c, i) => {
		const created = c.createTime ? new Date(c.createTime) : createdAt
		let name = c.creatorName ?? ''
		let avatar = c.creatorAvatarUrl ?? ''
		if (!name && typeof c.creator === 'string') {
			name = c.creator.replace(USER_PREFIX_RE, '')
		}
		else if (c.creator && typeof c.creator === 'object') {
			name = c.creator.name ?? ''
			avatar = c.creator.avatarUrl ?? avatar
		}
		return {
			id: String(c.id ?? c.name ?? `${uid}-c${i}`),
			content: c.content ?? '',
			createdAt: created,
			creatorName: name,
			creatorAvatar: avatar,
			ipLocation: c.ipLocation,
		}
	})

	// 反应：归一化类型并统计
	const reactions: MemosReaction[] = (m.reactions ?? []).map(r => ({
		...r,
		type: normalizeReactionType(r.reactionType),
		creatorName: r.creatorName,
	}))
	const counted = countReactions(reactions)

	const stats = {
		likeCount: m.stats?.likeCount ?? counted.LIKE,
		dislikeCount: m.stats?.dislikeCount ?? counted.DISLIKE,
		commentCount: m.stats?.commentCount ?? comments.length,
		favoriteCount: m.stats?.favoriteCount ?? counted.HEART,
	}

	return {
		id: uid,
		name: rawName,
		content: m.content ?? '',
		createdAt,
		creatorName,
		creatorAvatar,
		attachments: m.attachments ?? [],
		resources: rawResources,
		tags,
		visibility: m.visibility ?? 'PUBLIC',
		ipLocation: ipLocation.text ? ipLocation : undefined,
		device,
		comments,
		stats,
		favorited: Boolean(m.favorited),
		pinned: Boolean(m.pinned),
		location: m.location,
	}
}

/** 归一化反应类型 */
function normalizeReactionType(raw?: string): MemosReactionType {
	const v = (raw ?? '').toUpperCase()
	if (v === 'DISLIKE' || v === 'UNLIKE' || v === 'DOWN')
		return 'DISLIKE'
	if (v === 'HEART' || v === 'STAR' || v === 'FAVORITE' || v === 'COLLECT')
		return 'HEART'
	return 'LIKE'
}

/** 统计各类型反应数量 */
function countReactions(reactions: MemosReaction[]) {
	const acc = { LIKE: 0, DISLIKE: 0, HEART: 0 }
	for (const r of reactions) {
		if (r.type && r.type in acc)
			acc[r.type] += 1
	}
	return acc
}

/** 设备信息归一化：结构化字段优先，其次解析原始 UA */
function normalizeDevice(raw: MemosMemoRaw['device'], ua?: string): MemosDeviceInfo | undefined {
	if (raw && typeof raw === 'object') {
		const browser = raw.browser || ''
		if (!browser && !raw.ua)
			return undefined
		const parsed = raw.ua ? parseUserAgent(raw.ua) : null
		return {
			browser: browser || parsed?.browser || '未知浏览器',
			version: raw.version || parsed?.version || '',
			os: raw.os || parsed?.os || '',
			device: (raw.device as MemosDeviceInfo['device']) || parsed?.device || 'unknown',
			ua: raw.ua || parsed?.ua,
		}
	}
	if (typeof raw === 'string' && raw.trim()) {
		// 服务端只存了 UA 字符串
		return parseUserAgent(raw)
	}
	if (ua)
		return parseUserAgent(ua)
	return undefined
}

/**
 * 由附件 resourceName + filename 推导可访问地址
 *
 * 优先级：externalLink > dataURL > 实例附件接口
 * 实例附件接口形如 `${baseUrl}/file/attachments/{id}/{filename}`（Memos v0.22+）
 */
function resolveAttachmentUrl(att: MemosAttachment, baseUrl: string): string {
	if (att.externalLink)
		return att.externalLink
	if (att.content?.startsWith('data:'))
		return att.content
	const id = (att.name ?? '').replace(ATTACHMENT_PREFIX_RE, '')
	if (!id)
		return ''
	const filename = att.filename ? `/${encodeURIComponent(att.filename)}` : ''
	return `${baseUrl}/file/attachments/${id}${filename}`
}

/** 写操作失败（无鉴权 / 接口不支持 / 网络错误） */
export class MemosWriteError extends Error {
	/** 是否因为缺少令牌 */
	readonly unauthorized: boolean
	constructor(message: string, unauthorized = false) {
		super(message)
		this.name = 'MemosWriteError'
		this.unauthorized = unauthorized
	}
}

/** Memos v1 API 客户端 */
export class MemosClient {
	constructor(
		private baseUrl: string,
		private username: string,
		/** 访问令牌（写操作需要；新说说系统签发） */
		private token: string = '',
	) {}

	/** 基础地址（去掉末尾斜杠） */
	private get base(): string {
		return this.baseUrl.replace(TRAILING_SLASH_RE, '')
	}

	/** 带令牌的请求头 */
	private get headers(): Record<string, string> {
		const h: Record<string, string> = { Accept: 'application/json' }
		if (this.token)
			h.Authorization = `Bearer ${this.token}`
		return h
	}

	/** 统一的写请求：把 401/403/404/405 翻译成可读错误 */
	private async request<T>(path: string, options: { method: string, body?: unknown }): Promise<T> {
		if (!this.token)
			throw new MemosWriteError('当前说说实例未配置访问令牌，无法提交互动', true)
		try {
			return await $fetch<T>(`${this.base}${path}`, {
				method: options.method,
				headers: this.headers,
				body: options.body as any,
			})
		}
		catch (err: any) {
			const status = err?.response?.status ?? err?.statusCode ?? 0
			if (status === 401 || status === 403)
				throw new MemosWriteError('访问令牌无效或已过期', true)
			if (status === 404 || status === 405)
				throw new MemosWriteError('当前说说实例不支持该操作')
			throw new MemosWriteError(err?.data?.message || err?.message || '操作失败')
		}
	}

	/** 拼接 API 路径 */
	private apiPath(): string {
		return `${this.baseUrl.replace(TRAILING_SLASH_RE, '')}/api/v1/memos`
	}

	/**
	 * 拉取单页 memos
	 *
	 * 请求模板：
	 * {baseUrl}/api/v1/memos?filter=creator=="users/{username}"&state=NORMAL&pageSize=10&pageToken=xxx
	 *
	 * @param pageToken 分页 token（下一页时传上一次返回的 nextPageToken）
	 * @param tag 可选标签过滤（追加 CEL filter）
	 * @param state 状态过滤（NORMAL / ARCHIVED），默认 NORMAL
	 */
	async list(params: { pageToken?: string, pageSize: number, tag?: string, state?: string }) {
		const { pageToken, pageSize, tag, state = 'NORMAL' } = params
		const query: Record<string, string | number> = {
			pageSize,
		}

		// CEL filter：creator resourceName 必传，tag 可选叠加
		const filters: string[] = [`creator == "users/${this.username}"`]
		if (tag)
			filters.push(`tag == "${tag}"`)
		query.filter = filters.join(' && ')
		query.state = state

		if (pageToken)
			query.pageToken = pageToken

		const url = `${this.apiPath()}?${new URLSearchParams(query as Record<string, string>).toString()}`
		const res = await $fetch<{
			memos?: MemosMemoRaw[]
			data?: MemosMemoRaw[]
			nextPageToken?: string
		}>(url)

		const rawList = res.memos ?? res.data ?? []
		const memos = rawList.map(normalize)
		// 补全附件可访问地址（不同类型实例返回 externalLink / content / 仅 name 三种形态）
		const base = this.baseUrl.replace(TRAILING_SLASH_RE, '')
		for (const memo of memos) {
			memo.attachments = memo.attachments.map(att => ({ ...att, src: resolveAttachmentUrl(att, base) }))
		}
		return {
			memos,
			nextPageToken: res.nextPageToken,
			hasMore: Boolean(res.nextPageToken),
		}
	}

	/* ==================== 互动（需要令牌） ==================== */

	/** memo 资源名：优先用 v1 name，兼容只有 id 的实例 */
	private memoName(memo: Pick<MemosMemo, 'name' | 'id'>): string {
		return memo.name && memo.name.includes('/') ? memo.name : `memos/${memo.id}`
	}

	/** 点赞 / 非喜欢 / 收藏（HEART） */
	async addReaction(memo: Pick<MemosMemo, 'name' | 'id'>, type: MemosReactionType) {
		await this.request(`/api/v1/memos/${this.memoName(memo)}/reactions`, {
			method: 'POST',
			body: { reactionType: type },
		})
	}

	/** 取消互动 */
	async removeReaction(memo: Pick<MemosMemo, 'name' | 'id'>, type: MemosReactionType) {
		await this.request(`/api/v1/memos/${this.memoName(memo)}/reactions/${type}`, {
			method: 'DELETE',
		})
	}

	/** 收藏 / 取消收藏（独立于反应） */
	async setFavorite(memo: Pick<MemosMemo, 'name' | 'id'>, favorite: boolean) {
		await this.request(`/api/v1/memos/${this.memoName(memo)}/favorite`, {
			method: favorite ? 'POST' : 'DELETE',
		})
	}

	/** 发表评论 */
	async createComment(memo: Pick<MemosMemo, 'name' | 'id'>, content: string) {
		return await this.request<MemosComment>(`/api/v1/memos/${this.memoName(memo)}/relations`, {
			method: 'POST',
			body: { content, type: 'COMMENT' },
		})
	}

	/** 拉取评论列表 */
	async listComments(memo: Pick<MemosMemo, 'name' | 'id'>): Promise<MemosComment[]> {
		const res = await this.request<MemosCommentRaw[] | { relations?: MemosCommentRaw[] }>(
			`/api/v1/memos/${this.memoName(memo)}/relations`,
			{ method: 'GET' },
		)
		const list = Array.isArray(res) ? res : (res?.relations ?? [])
		return list.map((c, i) => ({
			id: String(c.id ?? c.name ?? `c${i}`),
			content: c.content ?? '',
			createdAt: c.createTime ? new Date(c.createTime) : new Date(),
			creatorName: c.creatorName ?? (typeof c.creator === 'string' ? c.creator.replace(USER_PREFIX_RE, '') : ''),
			creatorAvatar: c.creatorAvatarUrl ?? '',
			ipLocation: c.ipLocation,
		}))
	}

	/** 拉取所有公开 memos（标签过滤），自动分页直到全部 */
	async* iterateAll(tag?: string, pageSize = 10) {
		let pageToken: string | undefined

		while (true) {
			const page = await this.list({ pageToken, pageSize, tag, state: 'NORMAL' })
			yield page.memos
			if (!page.hasMore)
				break
			pageToken = page.nextPageToken
			if (!pageToken)
				break
		}
	}
}
