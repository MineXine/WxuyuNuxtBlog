/**
 * /api/lyric — 网易云歌词代理
 *
 * 浏览器直连 music.163.com 会被 CORS 拦掉，所以走站内代理转发一次。
 *
 * 两级取词：
 * 1. v1 接口（`/api/song/lyric/v1`）—— 能拿到逐词 YRC 与逐词翻译 ytlrc，
 *    是「逐字高亮」的数据来源。
 * 2. 旧接口（`/api/song/lyric`）—— 兜底补普通 LRC（v1 偶尔不返回 lrc）。
 *
 * 代理不可用时前端会退回 meting 返回的普通 LRC，不影响播放。
 */

/** 逐词歌词接口（v1） */
const NETEASE_LYRIC_V1 = 'https://music.163.com/api/song/lyric/v1'
/** 普通歌词接口（兜底） */
const NETEASE_LYRIC_API = 'https://music.163.com/api/song/lyric'

/** 单次请求超时（毫秒） */
const TIMEOUT = 8000

/** 内存缓存：歌曲 ID → { 歌词体, 时间戳 } */
const cache = new Map<string, { payload: unknown, timestamp: number }>()

/** 缓存时长（毫秒） */
const CACHE_TTL = 10 * 60 * 1000

/** 缓存上限，超了先丢最旧的 */
const CACHE_MAX = 200
/** 歌曲 ID（纯数字） */
const DIGITS_ONLY_RE = /^\d+$/

/** 请求头：网易云对没有 UA 的请求不友好 */
const HEADERS = {
	'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
	'Referer': 'https://music.163.com/',
	'Accept': 'application/json, text/plain, */*',
}

/**
 * 带超时的 JSON 请求
 *
 * @param url 完整地址
 * @returns 解析后的 JSON，失败返回 null
 */
async function fetchJson(url: string): Promise<Record<string, unknown> | null> {
	const controller = new AbortController()
	const timer = setTimeout(() => controller.abort(), TIMEOUT)
	try {
		const response = await fetch(url, { signal: controller.signal, headers: HEADERS })
		if (!response.ok)
			return null
		return await response.json() as Record<string, unknown>
	}
	catch {
		return null
	}
	finally {
		clearTimeout(timer)
	}
}

export default defineEventHandler(async (event) => {
	const query = getQuery(event)
	const id = String(query.id ?? '').trim()

	if (!DIGITS_ONLY_RE.test(id)) {
		throw createError({ statusCode: 400, statusMessage: '缺少合法的歌曲 ID' })
	}

	// 命中缓存直接返回
	const cached = cache.get(id)
	if (cached && Date.now() - cached.timestamp < CACHE_TTL)
		return cached.payload

	// 1. 逐词歌词（v1）
	const v1 = await fetchJson(`${NETEASE_LYRIC_V1}?id=${id}&cp=false&tv=0&lv=0&rv=0&kv=1&yv=1&ytv=0&lr=0`)

	// 2. v1 没给普通歌词时，用旧接口补一份
	let legacy: Record<string, unknown> | null = null
	if (v1 && !v1.lrc) {
		legacy = await fetchJson(`${NETEASE_LYRIC_API}?id=${id}&lv=1&kv=1&tv=-1`)
	}

	// 保持网易云的原始结构（{ lyric: '...' }），前端解析器直接吃这个格式
	const payload = {
		yrc: { lyric: (v1?.yrc as { lyric?: string } | undefined)?.lyric ?? '' },
		ytlrc: { lyric: (v1?.ytlrc as { lyric?: string } | undefined)?.lyric ?? '' },
		tlyric: { lyric: (v1?.tlyric as { lyric?: string } | undefined)?.lyric ?? (legacy?.tlyric as { lyric?: string } | undefined)?.lyric ?? '' },
		lrc: { lyric: (v1?.lrc as { lyric?: string } | undefined)?.lyric ?? (legacy?.lrc as { lyric?: string } | undefined)?.lyric ?? '' },
	}

	// 一个歌词都没拿到 → 视为代理失败，让前端走 meting 的普通 LRC 兜底
	if (!payload.yrc.lyric && !payload.lrc.lyric) {
		return {
			lrc: { lyric: '' },
			yrc: { lyric: '' },
			tlyric: { lyric: '' },
			ytlrc: { lyric: '' },
		}
	}

	if (cache.size >= CACHE_MAX) {
		const oldest = cache.keys().next()
		if (!oldest.done)
			cache.delete(oldest.value)
	}
	cache.set(id, { payload, timestamp: Date.now() })

	return payload
})
