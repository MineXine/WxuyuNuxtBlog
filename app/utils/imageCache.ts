/**
 * imageCache.ts — 图片本地缓存（Cache Storage + 内存 Blob URL 复用）
 *
 * 说说里的图经常是 1~2MB 的大图，同一张图被多次访问（列表缩略、灯箱、再次回访）
 * 会反复走网络。这里做两层缓存：
 *
 *   1. 内存层：src → Blob URL 的 LRU，避免同一张图反复创建 objectURL
 *   2. 磁盘层：Cache Storage 持久化，刷新页面 / 断网后依然能秒开
 *
 * 约束：
 * - data: URL 不进缓存（本身就在内存里）
 * - 跨域图片若服务端没给 CORS 头，fetch 会失败 → 上层自动回退到直连 <img>
 * - 缓存条目有上限与体积上限，超出按插入顺序淘汰最旧的
 */

/** 缓存名（带版本号，结构变化时自然失效） */
const CACHE_NAME = 'memos-images-v1'

/** 内存层最多保留多少个 Blob URL */
const MAX_MEMORY_URLS = 24

/** 磁盘层最多保留多少张图 */
const MAX_CACHE_ENTRIES = 120

/** 磁盘层总体积上限（字节），约 120MB */
const MAX_CACHE_BYTES = 120 * 1024 * 1024

/** src → Blob URL（内存 LRU） */
const memoryUrls = new Map<string, string>()

/** src → 正在进行的下载（同 URL 并发只下一次） */
const inflight = new Map<string, Promise<string | null>>()

/** 是否支持 Cache Storage */
function hasCacheStorage(): boolean {
	return typeof caches !== 'undefined' && typeof caches.open === 'function'
}

/** data: / blob: 链接无需缓存 */
function isLocalBlob(src: string): boolean {
	return src.startsWith('data:') || src.startsWith('blob:')
}

/**
 * 取缓存中的图片并转成可直接用于 <img src> 的地址
 *
 * @returns 命中的 Blob URL；未命中返回 null
 */
export async function getCachedImage(src: string): Promise<string | null> {
	if (!src || isLocalBlob(src))
		return null

	// 内存命中
	const cached = memoryUrls.get(src)
	if (cached) {
		// LRU：命中后挪到队尾
		memoryUrls.delete(src)
		memoryUrls.set(src, cached)
		return cached
	}

	if (!hasCacheStorage())
		return null

	try {
		const cache = await caches.open(CACHE_NAME)
		const response = await cache.match(src)
		if (!response)
			return null
		const blob = await response.blob()
		if (!blob.size)
			return null
		const url = URL.createObjectURL(blob)
		setMemory(src, url)
		return url
	}
	catch {
		return null
	}
}

/** 写入内存 LRU */
function setMemory(src: string, url: string) {
	memoryUrls.set(src, url)
	while (memoryUrls.size > MAX_MEMORY_URLS) {
		const oldest = memoryUrls.keys().next().value
		if (oldest === undefined)
			break
		const old = memoryUrls.get(oldest)
		memoryUrls.delete(oldest)
		if (old)
			URL.revokeObjectURL(old)
	}
}

/**
 * 下载并缓存图片，返回可直接用于 <img src> 的地址
 *
 * 失败时返回 null（调用方回退到原始地址）
 */
export async function cacheImage(src: string): Promise<string | null> {
	if (!src || isLocalBlob(src))
		return null

	const hit = await getCachedImage(src)
	if (hit)
		return hit

	const pending = inflight.get(src)
	if (pending)
		return pending

	const task = (async () => {
		try {
			const response = await fetch(src, { mode: 'cors', credentials: 'omit' })
			if (!response.ok)
				return null
			const blob = await response.blob()
			if (!blob.size)
				return null

			if (hasCacheStorage()) {
				const cache = await caches.open(CACHE_NAME)
				await cache.put(src, response.clone()).catch(() => {})
				void trimCache()
			}

			const url = URL.createObjectURL(blob)
			setMemory(src, url)
			return url
		}
		catch {
			return null
		}
		finally {
			inflight.delete(src)
		}
	})()

	inflight.set(src, task)
	return task
}

/**
 * 解析图片地址：优先命中本地缓存，没有则下载并缓存
 *
 * @param src 原始图片地址
 * @returns 可直接使用的地址与是否命中缓存
 */
export async function resolveImage(src: string): Promise<{ url: string, cached: boolean }> {
	if (!src)
		return { url: '', cached: false }
	if (isLocalBlob(src))
		return { url: src, cached: true }

	const hit = await getCachedImage(src)
	if (hit)
		return { url: hit, cached: true }

	const downloaded = await cacheImage(src)
	if (downloaded)
		return { url: downloaded, cached: true }

	// 缓存不可用（隐私模式 / CORS 失败）→ 用原地址直连
	return { url: src, cached: false }
}

/** 缓存概况（调试面板 / 控制台） */
export async function getImageCacheStats() {
	const stats = { entries: 0, bytes: 0, memory: memoryUrls.size, inflight: inflight.size }
	if (!hasCacheStorage())
		return stats
	try {
		const cache = await caches.open(CACHE_NAME)
		const keys = await cache.keys()
		stats.entries = keys.length
		for (const request of keys) {
			const response = await cache.match(request)
			const size = Number(response?.headers.get('content-length') ?? 0)
			stats.bytes += size
		}
	}
	catch { /* 忽略 */ }
	return stats
}

/** 清空缓存（调试 / 用户手动清理） */
export async function clearImageCache() {
	for (const url of memoryUrls.values())
		URL.revokeObjectURL(url)
	memoryUrls.clear()
	inflight.clear()
	if (!hasCacheStorage())
		return
	try {
		await caches.delete(CACHE_NAME)
	}
	catch { /* 忽略 */ }
}

/**
 * 淘汰超出上限的缓存条目（按插入顺序，先入先出）
 */
async function trimCache() {
	if (!hasCacheStorage())
		return
	try {
		const cache = await caches.open(CACHE_NAME)
		const keys = await cache.keys()
		if (keys.length <= MAX_CACHE_ENTRIES)
			return

		// 先按数量淘汰到上限的 85%
		const target = Math.floor(MAX_CACHE_ENTRIES * 0.85)
		let removed = 0
		for (const request of keys) {
			if (keys.length - removed <= target)
				break
			await cache.delete(request)
			removed += 1
		}

		// 再按体积淘汰：超过上限时继续删最旧的，直到落回上限以内
		let total = 0
		const remaining = await cache.keys()
		for (const request of remaining) {
			const response = await cache.match(request)
			total += Number(response?.headers.get('content-length') ?? 0)
		}
		if (total <= MAX_CACHE_BYTES)
			return
		const sizeTarget = Math.floor(MAX_CACHE_BYTES * 0.8)
		for (const request of remaining) {
			if (total <= sizeTarget)
				break
			const response = await cache.match(request)
			total -= Number(response?.headers.get('content-length') ?? 0)
			await cache.delete(request)
		}
	}
	catch { /* 忽略 */ }
}

/**
 * 预热图片（进入视口时调用，提前把图拉进缓存）
 */
export function preloadImage(src: string) {
	if (!src || isLocalBlob(src))
		return
	void cacheImage(src).catch(() => {})
}
