/**
 * Spine 模型资源加载工具（列表缩略图与详情预览共用）
 *
 * 约定 ModelAssets：ModelSkel（骨架 .skel/.json）、ModelAtlas（图集）、ModelImage（贴图），
 * 均为 public 下的静态路径，构建后可随 SSG 产物一起分发。
 *
 * 缓存策略（两级）：
 *   1. 内存缓存：同一个模型第二次加载直接返回已解析的 JSON 与已解码贴图（同会话秒开）
 *   2. Cache Storage：骨架 / 图集 / 贴图的响应持久化，刷新页面或换路由后不再走网络
 */

import { loadSpine35Runtime } from '~/composables/useSpineViewer'

export interface SpineModelAssets {
	ModelSkel?: string
	ModelImage?: string
	ModelAtlas?: string
}

export interface SpineModelData {
	json: any
	atlasText: string
	textures: Map<string, HTMLImageElement>
	/** 命中缓存（内存或 Cache Storage） */
	fromCache: boolean
	/** 资源来源：内存缓存 / 磁盘缓存 / 网络 */
	source: SpineCacheSource
	/** 首次加载耗时（毫秒），缓存命中为 0 */
	loadMs: number
}

/** 模型资源来源 */
export type SpineCacheSource = 'memory' | 'cache' | 'mixed' | 'network'

const ATLAS_NEWLINE_RE = /\r?\n/
const ATLAS_PAGE_RE = /^size\s*:/
/** 图集里带冒号的是属性行（xy: / size:），贴图页名不带冒号 */
const ATLAS_ATTR_RE = /:/
const JSON_SKEL_RE = /\.json(?:$|\?)/i
/** ModelImage 允许多张贴图（多页图集），用逗号或竖线分隔 */
const IMAGE_LIST_SPLIT_RE = /\s*[,|;]\s*/

const CACHE_NAME = 'spine-models-v1'
/** 二进制骨架转出的 3.5 JSON 单独持久化：刷新页面后无需再次下载/转换 */
const JSON_CACHE_NAME = 'spine-json-v1'
/** 内存里最多保留几个模型（贴图已解码，占显存/内存，做个 LRU 上限） */
const MAX_MEMORY_MODELS = 8

/** 已完成的模型数据：第二次进页面直接拿到解码好的贴图与 JSON */
const dataCache = new Map<string, SpineModelData>()
/** 正在加载中的模型：并发调用共享同一个 Promise，避免重复下载 */
const inflight = new Map<string, Promise<SpineModelData>>()
/** 骨架 JSON 内存缓存（按 skel URL）：连 Cache Storage 的读盘都省掉 */
const jsonMemory = new Map<string, any>()

/** LRU：命中后挪到队尾，超出上限时丢最早的 */
function touchCache(key: string, data: SpineModelData) {
	dataCache.delete(key)
	dataCache.set(key, data)
	while (dataCache.size > MAX_MEMORY_MODELS) {
		const oldest = dataCache.keys().next().value
		if (oldest === undefined)
			break
		dataCache.delete(oldest)
	}
}

/** 该模型是否已在内存缓存中（可用于决定是否显示「秒开」提示） */
export function isSpineModelCached(assets?: SpineModelAssets) {
	if (!assets?.ModelSkel)
		return false
	return dataCache.has(assetKey(assets))
}

/** 缓存概况（调试面板 / 控制台） */
export function getSpineCacheStats() {
	return {
		models: [...dataCache.keys()],
		count: dataCache.size,
		limit: MAX_MEMORY_MODELS,
		jsonCount: jsonMemory.size,
		inflight: inflight.size,
	}
}

/** 图集贴图页名：区块起始（前一行空行）+ 下一行是 size: + 本行不含冒号 */
export function parseAtlasPages(atlasText: string): string[] {
	const lines = atlasText.split(ATLAS_NEWLINE_RE)
	const pages: string[] = []
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim()
		if (!line || ATLAS_ATTR_RE.test(line))
			continue
		const prevBlank = i === 0 || !lines[i - 1].trim()
		const nextIsSize = ATLAS_PAGE_RE.test((lines[i + 1] ?? '').trim())
		if (prevBlank && nextIsSize)
			pages.push(line)
	}
	return pages
}

/** 按 URL 解码图片（同源静态资源） */
export function loadImageUrl(url: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const img = new Image()
		img.onload = () => {
			// decode() 提前完成解码，模型首帧不必等主线程解码
			if (typeof img.decode === 'function')
				img.decode().then(() => resolve(img)).catch(() => resolve(img))
			else
				resolve(img)
		}
		img.onerror = () => reject(new Error(`贴图加载失败：${url}`))
		img.src = url
	})
}

function assetKey(assets: SpineModelAssets) {
	return `${assets.ModelSkel ?? ''}|${assets.ModelAtlas ?? ''}|${assets.ModelImage ?? ''}`
}

/**
 * 优先从 Cache Storage 取；未命中时请求并写入缓存。
 * 返回 `hit` 便于区分「秒开」与「首次加载」。
 */
const fetchInflight = new Map<string, Promise<{ response: Response, hit: boolean }>>()

async function cachedFetch(url: string): Promise<{ response: Response, hit: boolean }> {
	// 同一个 URL 并发命中（预热 + 组件挂载）时共享一次请求
	const pending = fetchInflight.get(url)
	if (pending)
		return pending
	const task = cachedFetchOnce(url)
	fetchInflight.set(url, task)
	try {
		return await task
	}
	finally {
		fetchInflight.delete(url)
	}
}

async function cachedFetchOnce(url: string): Promise<{ response: Response, hit: boolean }> {
	if (typeof caches === 'undefined') {
		const response = await fetch(url)
		if (!response.ok)
			throw new Error(`资源加载失败：${url}（${response.status}）`)
		return { response, hit: false }
	}
	try {
		const cache = await caches.open(CACHE_NAME)
		const cached = await cache.match(url)
		if (cached)
			return { response: cached, hit: true }
		const response = await fetch(url)
		if (response.ok)
			void cache.put(url, response.clone()).catch(() => {})
		else
			throw new Error(`资源加载失败：${url}（${response.status}）`)
		return { response, hit: false }
	}
	catch (err) {
		// Cache Storage 不可用（隐私模式 / 非安全上下文）时退回原生请求
		if (err instanceof Error && err.message.startsWith('资源加载失败'))
			throw err
		const response = await fetch(url)
		if (!response.ok)
			throw new Error(`资源加载失败：${url}（${response.status}）`)
		return { response, hit: false }
	}
}

/** 贴图走 Cache Storage → Blob URL 解码，避免二次访问重复下载 */
async function cachedImage(url: string): Promise<{ image: HTMLImageElement, hit: boolean }> {
	try {
		const { response, hit } = await cachedFetch(url)
		const blob = await response.blob()
		const objectUrl = URL.createObjectURL(blob)
		try {
			const image = await loadImageUrl(objectUrl)
			return { image, hit }
		}
		finally {
			URL.revokeObjectURL(objectUrl)
		}
	}
	catch (err) {
		if (err instanceof Error && err.message.startsWith('贴图加载失败'))
			throw err
		return { image: await loadImageUrl(url), hit: false }
	}
}

/** 读取已转换的骨架 JSON（Cache Storage） */
async function readJsonCache(url: string): Promise<any | null> {
	if (typeof caches === 'undefined')
		return null
	try {
		const cache = await caches.open(JSON_CACHE_NAME)
		const cached = await cache.match(url)
		return cached ? await cached.json() : null
	}
	catch {
		return null
	}
}

/** 写入转换后的骨架 JSON，下次刷新直接命中 */
async function writeJsonCache(url: string, json: any) {
	if (typeof caches === 'undefined')
		return
	try {
		const cache = await caches.open(JSON_CACHE_NAME)
		await cache.put(url, new Response(JSON.stringify(json), {
			headers: { 'content-type': 'application/json' },
		}))
	}
	catch { /* 配额或隐私模式，忽略 */ }
}

export type SpineLoadProgress = (ratio: number) => void

/**
 * 下载并解析一个模型的三件套，返回可直接交给 viewer.load 的参数。
 * 同一模型的并发调用会复用同一个 Promise。
 */
export function fetchSpineModel(assets: SpineModelAssets, onProgress?: SpineLoadProgress): Promise<SpineModelData> {
	const key = assetKey(assets)

	// 1. 内存命中：贴图已解码、JSON 已解析，直接复用（同会话第二次打开 ≈ 0ms）
	const cached = dataCache.get(key)
	if (cached) {
		touchCache(key, cached)
		onProgress?.(1)
		return Promise.resolve({ ...cached, fromCache: true, source: 'memory', loadMs: 0 })
	}

	// 2. 加载中：并发调用复用同一份（预取 + 组件挂载算同一次加载，保留真实耗时）
	const pending = inflight.get(key)
	if (pending) {
		onProgress?.(1)
		return pending
	}

	// 3. 首次加载：完成后写入内存缓存
	const started = typeof performance !== 'undefined' ? performance.now() : Date.now()
	const task = loadModelData(assets, onProgress)
		.then((data) => {
			const done = {
				...data,
				loadMs: Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - started),
			}
			touchCache(key, done)
			return done
		})
		.catch((err) => {
			dataCache.delete(key)
			throw err
		})
		.finally(() => inflight.delete(key))

	inflight.set(key, task)
	return task
}

/** 空闲时预热缓存（例如进入详情页时提前拉取，等滚动到预览器时已经就绪） */
export function preloadSpineModel(assets?: SpineModelAssets) {
	if (!assets?.ModelSkel || !assets.ModelAtlas || !assets.ModelImage)
		return
	if (isSpineModelCached(assets))
		return
	void fetchSpineModel(assets).catch(() => {})
}

/** 批量预热（列表 hover / 空闲时预取若干模型） */
export function preloadSpineModels(list?: SpineModelAssets[]) {
	if (!list?.length)
		return
	for (const assets of list)
		preloadSpineModel(assets)
}

/** 手动清理（调试用） */
export async function clearSpineCache() {
	dataCache.clear()
	inflight.clear()
	jsonMemory.clear()
	if (typeof caches !== 'undefined') {
		try {
			await caches.delete(CACHE_NAME)
			await caches.delete(JSON_CACHE_NAME)
		}
		catch { /* 忽略 */ }
	}
}

async function loadModelData(assets: SpineModelAssets, onProgress?: SpineLoadProgress): Promise<SpineModelData> {
	const skelUrl = assets.ModelSkel
	const atlasUrl = assets.ModelAtlas
	const imageUrl = assets.ModelImage
	if (!skelUrl || !atlasUrl || !imageUrl)
		throw new Error('模型资源不完整（需要 ModelSkel / ModelAtlas / ModelImage）')

	onProgress?.(0.08)
	const isJsonSkel = JSON_SKEL_RE.test(skelUrl)
	/** 逐项命中情况，最后汇总成来源标记 */
	const hits: boolean[] = []

	// 二进制骨架：命中「已转换 JSON」缓存时，连 .skel 都不用下载
	let json: any = isJsonSkel ? jsonMemory.get(skelUrl) ?? null : (jsonMemory.get(skelUrl) ?? await readJsonCache(skelUrl))
	let fromCache = Boolean(json)

	// 图集与骨架请求并行发出
	const atlasPromise = cachedFetch(atlasUrl)
	const skelPromise = json ? null : cachedFetch(skelUrl)
	const atlasRes = await atlasPromise
	const skelRes = skelPromise ? await skelPromise : null
	fromCache = fromCache || Boolean(skelRes?.hit)
	fromCache = fromCache && atlasRes.hit
	hits.push(Boolean(skelRes?.hit), atlasRes.hit)
	onProgress?.(0.42)

	const atlasText = await atlasRes.response.text()
	const pages = parseAtlasPages(atlasText)
	if (!pages.length)
		throw new Error('未能从 .atlas 中解析出贴图页')

	/** 多页图集：ModelImage 里按顺序用逗号分隔多张贴图 */
	const imageUrls = [...new Set(imageUrl.split(IMAGE_LIST_SPLIT_RE).filter(Boolean))]
	if (imageUrls.length < pages.length && imageUrls.length !== 1)
		throw new Error(`图集共 ${pages.length} 页贴图，但只提供了 ${imageUrls.length} 张`)

	onProgress?.(0.55)
	const imageResults = await Promise.all(imageUrls.map(url => cachedImage(url)))
	fromCache = fromCache && imageResults.every(item => item.hit)
	hits.push(...imageResults.map(item => item.hit))
	onProgress?.(0.82)

	// 二进制骨架需要 3.5 解析器；首次转换后写回 Cache Storage，之后直接复用
	if (!json) {
		if (!skelRes)
			throw new Error('骨架资源缺失')
		if (isJsonSkel) {
			json = JSON.parse(await skelRes.response.text())
		}
		else {
			const buffer = await skelRes.response.arrayBuffer()
			if (!(window as any).Spine35Binary)
				await loadSpine35Runtime()
			json = (window as any).Spine35Binary?.toJson(buffer)
			if (!json)
				throw new Error('3.5 二进制解析器未加载')
			// 不阻塞主流程，后台落盘
			void writeJsonCache(skelUrl, json)
		}
	}

	// 解析结果留在内存，下一次进同一模型不必再读 Cache Storage
	if (json)
		jsonMemory.set(skelUrl, json)

	const images = imageResults.map(item => item.image)
	const textures = new Map<string, HTMLImageElement>()
	if (pages.length === 1 || images.length === 1) {
		// 单页图集，或只给了一张图（多页共用）
		for (const page of pages)
			textures.set(page, images[0])
	}
	else {
		// 按文件名匹配，匹配不到时按顺序对应
		const byName = new Map<string, HTMLImageElement>()
		imageUrls.forEach((url, index) => {
			const file = url.split('?')[0].split('/').pop()?.toLowerCase()
			if (file)
				byName.set(file, images[index])
		})
		pages.forEach((page, index) => {
			const file = page.toLowerCase()
			textures.set(page, byName.get(file) ?? images[index] ?? images[0])
		})
	}

	onProgress?.(1)
	const hitCount = hits.filter(Boolean).length
	const source: SpineCacheSource = hitCount === hits.length && hits.length > 0
		? 'cache'
		: hitCount > 0
			? 'mixed'
			: 'network'
	return { json, atlasText, textures, fromCache, source, loadMs: 0 }
}
