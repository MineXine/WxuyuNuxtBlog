/**
 * Memos API v1 类型定义
 *
 * 只支持标准 Memos v0.20+ API：{memos}/api/v1/memos
 * 注：不同 v1 实例字段命名仍有差异（createTime/displayTime、
 * tags/property.tags 等），保留字段 fallback。
 */

/** 单条 memo 的原始响应结构（v1 字段并集） */
export interface MemosMemoRaw {
	/** v1 标准：resourceName 是 memo 唯一标识（memos/{id}），部分实例另有数字 id */
	name?: string
	id?: string | number
	content?: string
	creatorId?: string | number
	creatorName?: string
	creatorAvatarUrl?: string
	visibility?: 'PUBLIC' | 'PRIVATE' | 'PROTECTED'
	/** 创建时间（不同实例命名差异） */
	createTime?: string
	displayTime?: string
	/** 创建者（字符串 resourceName 或对象） */
	creator?: string | { id: string | number, name: string, avatarUrl?: string }
	/** 附件（v1 标准字段名） */
	attachments?: MemosAttachment[]
	/** 资源（部分实例 / 旧字段名） */
	resources?: MemosResource[]
	/** 标签（部分实例在 property.tags 里） */
	tags?: string[]
	reactions?: MemosReaction[]
	property?: {
		tags?: string[]
		[k: string]: unknown
	}
	/** 评论（不同实例命名差异：relations / comments） */
	relations?: MemosCommentRaw[]
	comments?: MemosCommentRaw[]
	/** 互动计数（新版实例提供） */
	stats?: Partial<{
		likeCount: number
		dislikeCount: number
		commentCount: number
		favoriteCount: number
	}>
	/** IP 属地（发布时记录） */
	ipLocation?: string | { country?: string, region?: string, city?: string, text?: string }
	/** 设备信息（发布时记录） */
	device?: string | { browser?: string, version?: string, os?: string, device?: string, ua?: string }
	/** 原始 UA */
	userAgent?: string
	/** 是否被当前用户收藏 */
	favorited?: boolean
	/** 置顶 */
	pinned?: boolean
	/** 发布位置 */
	location?: { placeholder?: string, latitude?: number, longitude?: number }
}

/** 评论原始结构 */
export interface MemosCommentRaw {
	id?: string | number
	name?: string
	content?: string
	createTime?: string
	creator?: string | { id?: string | number, name?: string, avatarUrl?: string }
	creatorName?: string
	creatorAvatarUrl?: string
	ipLocation?: string
}

/** Memos 附件（v1 标准字段：attachments 数组元素） */
export interface MemosAttachment {
	/** resourceName（attachments/{id}） */
	name?: string
	createTime?: string
	filename?: string
	/** base64 内容（内联附件） */
	content?: string
	/** 外部链接（外链附件，直接可用） */
	externalLink?: string
	type?: string
	size?: string | number
	memo?: string
	/** 由客户端推导出的可访问地址（externalLink > dataURL > 实例附件接口） */
	src?: string
}

/** Memos 资源（旧版 / 部分实例的字段名） */
export interface MemosResource {
	id?: string | number
	name?: string
	type?: string
	filename?: string
	filename_?: string
	data?: { url?: string, size?: string }
	externalLink?: string
	externalUrl_?: string
	url?: string
	src?: string
	mimeType?: string
}

/** Memos v1 反应项 */
export interface MemosReaction {
	id?: string | number
	creatorId?: string | number
	reactionType?: string
	contentId?: string
	/** 归一化后的类型：LIKE（喜欢）/ DISLIKE（非喜欢）/ HEART（收藏） */
	type?: MemosReactionType
	creatorName?: string
	createTime?: string
}

/** 互动类型：喜欢 / 非喜欢 / 收藏 */
export type MemosReactionType = 'LIKE' | 'DISLIKE' | 'HEART'

/** 设备信息（发布时记录；网页端 = 浏览器 + 版本号） */
export interface MemosDeviceInfo {
	/** 浏览器名，如 Chrome / Edge / Safari / 微信 */
	browser: string
	/** 浏览器版本号 */
	version: string
	/** 操作系统，如 Windows 11 / macOS / iOS */
	os?: string
	/** 设备形态 */
	device?: 'desktop' | 'mobile' | 'tablet' | 'bot' | 'unknown'
	/** 原始 UA */
	ua?: string
}

/** IP 属地（发布时记录） */
export interface MemosIpLocation {
	/** 展示文案，如「广东 深圳」 */
	text: string
	country?: string
	region?: string
	city?: string
}

/** 评论 */
export interface MemosComment {
	id: string
	content: string
	createdAt: Date
	creatorName: string
	creatorAvatar?: string
	/** 评论者的 IP 属地 */
	ipLocation?: string
}

/** 互动计数 */
export interface MemosMemoStats {
	likeCount: number
	dislikeCount: number
	commentCount: number
	favoriteCount: number
}

/** 分页响应 */
export interface MemosListResponse {
	memos?: MemosMemoRaw[]
	data?: MemosMemoRaw[]
	nextPageToken?: string
}

/** 规范化为内部统一形态 */
export interface MemosMemo {
	id: string
	/** v1 resourceName（memos/{uid}） */
	name: string
	content: string
	createdAt: Date
	creatorName: string
	creatorAvatar: string
	/** 原始附件（v1 标准 attachments），含 filename/externalLink/type 等 */
	attachments: MemosAttachment[]
	/** 仅图片类附件的统一 src 列表（外部链接或 base64） */
	resources: MemosResource[]
	tags: string[]
	visibility: 'PUBLIC' | 'PRIVATE' | 'PROTECTED'
	/** IP 属地（发布时记录） */
	ipLocation?: MemosIpLocation
	/** 设备信息（发布时记录） */
	device?: MemosDeviceInfo
	/** 评论列表 */
	comments: MemosComment[]
	/** 互动计数 */
	stats: MemosMemoStats
	/** 当前用户是否已收藏 */
	favorited: boolean
	/** 是否置顶 */
	pinned: boolean
	/** 发布位置 */
	location?: { placeholder?: string, latitude?: number, longitude?: number }
}

/** 组件 props */
export interface MemosTimelineProps {
	/** Memos 实例地址（含协议，无末尾斜杠） */
	memos?: string
	/** Memos 用户名（用于 CEL filter: creator == "users/{username}"） */
	username?: string
	/** 初始每页条数 */
	limit?: number
	/** 标签过滤（点击标签后只显示该标签） */
	tagFilter?: string
	/** 布局模式：'list' 单列 | 'masonry' 瀑布流 */
	layout?: 'list' | 'masonry'
	/** 访问令牌（写操作需要：评论 / 喜欢 / 非喜欢 / 收藏） */
	token?: string
}
