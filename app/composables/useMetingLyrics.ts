/**
 * useMetingLyrics — Meting 播放器歌词解析
 *
 * 移植自 Next 博客的 `MusicPlayer.tsx`（逐词 YRC + 普通 LRC 双通道）：
 *
 * 1. 优先用网易云逐词歌词（YRC）：`[行起始毫秒,行总毫秒](字起始,字时长,?)文字`
 *    能做到「逐字高亮」。
 * 2. 没有 YRC 时退回普通 LRC（`[mm:ss.xx]歌词`）。
 * 3. 逐词歌词通常带一份翻译（`tlyric` / `ytlrc`），按时间就近匹配挂在主行上。
 *
 * 纯函数实现，不依赖 DOM / 网络。
 */

/** 逐词片段（YRC 里的一个字或一个词） */
export interface LrcSeg {
	/** 该片段时长（秒） */
	duration: number
	/** 该片段起始（秒，绝对时间） */
	start: number
	/** 该片段结束（秒，绝对时间） */
	end: number
	/** 片段文字 */
	text: string
}

/** 一行歌词 */
export interface LrcLine {
	/** 行起始时间（秒） */
	time: number
	/** 主行文字 */
	text: string
	/** 逐词片段（有 YRC 时才有） */
	etext?: LrcSeg[]
	/** 翻译行（中日文对照时才有） */
	pairlyric?: string
}

/** 网易云歌词接口返回的原始结构 */
export interface NeteaseLyric {
	yrc?: { lyric?: string }
	lrc?: { lyric?: string }
	tlyric?: { lyric?: string }
	ytlrc?: { lyric?: string }
}

/** 时间标签：`[mm:ss]` / `[mm:ss.xx]` / `[mm:ss.xxx]` */
const TIME_TAG_RE = /\[(\d+):(\d+)(?:[.:](\d+))?\](.*)/
/** 逐词行标签：`[起始毫秒,总毫秒]` */
const WORD_TAG_RE = /\[(\d+),(\d+)?\](.*)/
/** 逐词片段：`(起始毫秒,时长毫秒,0)文字` */
const SEG_RE = /\((\d+),(\d+),\d+\)(.*?)(?=\(\d+,\d+,\d+\)|$)/g
/** 假名（用来判断括号里是原文还是翻译） */
const KANA_RE = /[\u3040-\u30FF]/
/** 中文 */
const CJK_RE = /[\u4E00-\u9FFF]/
/** 数字串（从 url 里抠歌曲 ID） */
const DIGITS_RE = /\d+/g
/** 括号内容（拆翻译用） */
const PAREN_RE = /[（(]([^（）()]*)[）)]/g
/** 连续空白 */
const SPACE_RE = /\s+/g
/** 普通 LRC 行标签 */
const LRC_LINE_RE = /\[(\d+):(\d+(?:\.\d+)?)\](.*)/
/** YRC 逐词片段（清理用） */
const WORD_CLEAN_RE = /\(\d+,\d+,\d+\)/g
/** BOM */
const BOM_RE = /^\uFEFF/
/** 逐字切分 token：假名 / 汉字各自成段，拉丁词整体，空白单独（i 标志已覆盖大写） */
const TOKEN_RE = /[\u3040-\u30FF\u4E00-\u9FFF]|[a-z0-9]+['’-]?[a-z0-9]*|\s+|\S/gi
/** 空白 token 判定 */
const BLANK_RE = /\s/

/**
 * 从歌曲里取网易云 ID
 *
 * meting 返回的 url 里带歌曲 ID，取最后一个数字串最稳。
 *
 * @param song 歌曲对象
 * @param song.id 网易云歌曲 ID
 * @param song.url 音频地址（从中抠 ID）
 * @returns 歌曲 ID，取不到返回 null
 */
export function extractSongId(song: { id?: string, url?: string }): string | null {
	if (song.id)
		return String(song.id)
	if (song.url) {
		const matched = String(song.url).match(DIGITS_RE)
		return matched ? matched.at(-1) : null
	}
	return null
}

/**
 * 拆出括号里的中文翻译
 *
 * 兜底普通 LRC 常把中文翻译写在括号里（网易云「（中文）」），
 * 这里把它拆出来当注释层：主行只留原文，括号里没有假名的中文才算翻译，
 * 免得把「(feat. 初音ミク)」这类原文信息也当翻译摘掉。
 *
 * @param raw 原始歌词行
 * @returns 主行文字与翻译行
 */
export function splitTranslation(raw: string): { text: string, sub?: string } {
	const subs: string[] = []
	const main = raw
		.replace(PAREN_RE, (whole, inner: string) => {
			if (CJK_RE.test(inner) && !KANA_RE.test(inner)) {
				const text = inner.trim()
				if (text)
					subs.push(text)
				return ''
			}
			return whole
		})
		.replace(SPACE_RE, ' ')
		.trim()
	return { text: main || raw.trim(), sub: subs.join(' ') || undefined }
}

/**
 * 把一行文字切成若干片段（中日文按字，拉丁文按词）
 *
 * 用于没有官方逐词数据时，按行时长给每个字分配时间片，
 * 让全站所有歌都能「逐字点亮」，而不是只有部分歌有效果。
 *
 * @param text 行文字
 * @param start 行起始（秒）
 * @param end 行结束（秒，通常是下一行的起始）
 * @returns 片段数组
 */
function synthesizeSegs(text: string, start: number, end: number): LrcSeg[] {
	// 假名 / 汉字各自成段，拉丁字母与数字连成一个词，空白单独一段
	const tokens = text.match(TOKEN_RE)
	if (!tokens?.length)
		return []
	// 空白轻一点，长单词重一点，读起来才不自然后半句突然变快
	const weights = tokens.map(token => (BLANK_RE.test(token) ? 0.3 : Math.max(1, Math.min(token.length, 6) * 0.7)))
	const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)
	// 行间隔很长（间奏）时不把字拖慢，最多按 6 秒铺
	const span = Math.max(0.4, Math.min(6, end - start))
	let cursor = start
	const segs: LrcSeg[] = []
	tokens.forEach((token, index) => {
		const duration = (weights[index] / totalWeight) * span
		segs.push({ duration, start: cursor, end: cursor + duration, text: token })
		cursor += duration
	})
	return segs
}

/**
 * 给缺逐词数据的行补上合成片段
 *
 * 官方 YRC 只覆盖一部分歌；这里让普通 LRC 也有逐字效果。
 *
 * @param lines 歌词行
 * @returns 补齐后的歌词行
 */
function fillSyntheticSegs(lines: LrcLine[]): LrcLine[] {
	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index]
		if (line.etext?.length)
			continue
		const next = lines[index + 1]
		const end = next ? next.time : line.time + 4
		line.etext = synthesizeSegs(line.text, line.time, end)
	}
	return lines
}

/**
 * 解析普通 LRC
 *
 * @param lrc LRC 原文
 * @returns 歌词行数组
 */
export function parseLRC(lrc: string): LrcLine[] {
	const lines = lrc
		.split('\n')
		.map((line): LrcLine | null => {
			const matched = line.match(LRC_LINE_RE)
			if (!matched)
				return null
			const time = Number.parseInt(matched[1]) * 60 + Number.parseFloat(matched[2])
			const raw = matched[3].trim()
			if (!raw)
				return null
			const { text, sub } = splitTranslation(raw)
			return { time, text, pairlyric: sub }
		})
		.filter((line): line is LrcLine => !!line)
	// 普通 LRC 没有逐词信息，按行时长合成，保证也能逐字点亮
	return fillSyntheticSegs(lines)
}

/**
 * 给毫秒小数位换算成秒
 *
 * `[mm:ss.2]` 与 `[mm:ss.23]` 的小数位含义不同（前者是 0.2 秒，后者是 0.23 秒）。
 *
 * @param decimal 小数位字符串
 * @returns 秒
 */
function decimalToSeconds(decimal: string | undefined): number {
	if (!decimal)
		return 0
	return decimal.length === 2
		? Number.parseInt(decimal) / 100
		: Number.parseInt(decimal) / 1000
}

/**
 * 找与主行时间最接近的翻译
 *
 * @param lyric 网易云歌词原始结构
 * @param timesec 主行时间（秒）
 * @returns 翻译文字
 */
function pickTranslation(lyric: NeteaseLyric, timesec: number): string {
	const source = lyric.ytlrc?.lyric || lyric.tlyric?.lyric
	if (!source)
		return ''
	let pairtext = ''
	let minGap = 1
	for (const item of source.split('\n')) {
		const matched = item.match(TIME_TAG_RE)
		if (!matched)
			continue
		const seconds = Number.parseInt(matched[1]) * 60 + Number.parseInt(matched[2]) + decimalToSeconds(matched[3])
		const gap = Math.abs(timesec - seconds)
		if (minGap > gap) {
			minGap = gap
			pairtext = matched[4].replace('//', '')
		}
	}
	return pairtext
}

/**
 * 解析网易云歌词（逐词优先，退回普通）
 *
 * @param raw 网易云歌词接口的返回体
 * @returns 歌词行数组
 */
export function parseNeteaseLyric(raw: NeteaseLyric): LrcLine[] {
	const result: LrcLine[] = []
	if (!raw.yrc?.lyric && !raw.lrc?.lyric)
		return result

	if (raw.yrc?.lyric) {
		const lyrics = raw.yrc.lyric.replace(BOM_RE, '').split('\n')
		for (const lyric of lyrics) {
			const line = lyric.trim()
			if (!line)
				continue
			// 网易云的 yrc.lyric 是混合格式：
			// 元信息行（作词 / 作曲）是 JSON，正文行是 YRC 文本，两种都要认
			const parsed = line.startsWith('{')
				? parseYrcJsonLine(line)
				: parseYrcTextLine(line)
			if (parsed) {
				result.push({ ...parsed, pairlyric: pickTranslation(raw, parsed.time) || undefined })
			}
		}
		return result
	}

	for (const lyric of raw.lrc!.lyric!.split('\n')) {
		const matched = lyric.match(TIME_TAG_RE)
		if (!matched)
			continue
		const timesec = Number.parseInt(matched[1]) * 60 + Number.parseInt(matched[2]) + decimalToSeconds(matched[3])
		result.push({
			time: timesec,
			text: matched[4].trim(),
			pairlyric: pickTranslation(raw, timesec) || undefined,
		})
	}
	// 没有逐词数据时同样合成，全部歌曲都能逐字点亮
	return fillSyntheticSegs(result)
}

/**
 * 解析一行 YRC 文本歌词
 *
 * 形如：`[0,26620](0,2420,0)编(2420,2420,0)曲 `
 * 行头是「起始毫秒,总毫秒」，后面每个 `(起始毫秒,时长毫秒,0)` 是一个词。
 *
 * @param line 一行歌词
 * @returns 歌词行，格式不对返回 null
 */
function parseYrcTextLine(line: string): LrcLine | null {
	const matched = line.match(WORD_TAG_RE)
	if (!matched)
		return null
	const timesec = Number(matched[1]) / 1000
	const etext: LrcSeg[] = []
	if (line.includes('(') && line.includes(')')) {
		SEG_RE.lastIndex = 0
		let seg = SEG_RE.exec(line)
		while (seg !== null) {
			const duration = Number.parseInt(seg[2]) / 1000
			const start = Number.parseInt(seg[1]) / 1000
			const end = (Number.parseInt(seg[1]) + Number.parseInt(seg[2])) / 1000
			etext.push({ duration, start, end, text: seg[3] })
			seg = SEG_RE.exec(line)
		}
		if (etext.length && etext.at(-1).text === '&nbsp;')
			etext.pop()
	}
	const text = matched[3].replace(WORD_CLEAN_RE, '').trim()
	if (!text)
		return null
	return { time: timesec, text, etext }
}

/**
 * 解析一行 JSON 逐词歌词
 *
 * 形如：`{"t":6800,"c":[{"tx":"出","t":0},{"tx":"品","t":480}]}`
 * `t` 是行起始毫秒，`c[].tx` 是文字，`c[].t` 是该词相对行首的毫秒偏移。
 *
 * @param line 一行歌词
 * @returns 歌词行，格式不对返回 null
 */
function parseYrcJsonLine(line: string): LrcLine | null {
	let payload: { t?: number, c?: { tx?: string, t?: number }[] }
	try {
		payload = JSON.parse(line)
	}
	catch {
		return null
	}
	if (typeof payload.t !== 'number' || !Array.isArray(payload.c))
		return null

	const words = payload.c.filter(word => typeof word?.tx === 'string' && word.tx !== '')
	if (!words.length)
		return null

	const etext: LrcSeg[] = []
	words.forEach((word, index) => {
		const offset = typeof word.t === 'number' ? word.t : null
		const startMs = offset !== null
			? payload.t! + offset
			: payload.t! + Math.round((index / words.length) * 1000)
		const nextOffset = typeof payload.c![index + 1]?.t === 'number' ? payload.c![index + 1].t : null
		const endMs = nextOffset !== null ? payload.t! + nextOffset : startMs + 300
		etext.push({
			duration: Math.max(0.01, (endMs - startMs) / 1000),
			start: startMs / 1000,
			end: endMs / 1000,
			text: word.tx!,
		})
	})

	const text = words.map(word => word.tx).join('').trim()
	if (!text)
		return null
	return { time: payload.t / 1000, text, etext }
}

/**
 * 找出当前播放位置对应的歌词行
 *
 * @param lines 歌词行
 * @param time 当前时间（秒）
 * @returns 行下标，-1 表示还没到第一句
 */
export function findLyricIndex(lines: LrcLine[], time: number): number {
	if (!lines.length)
		return -1
	let low = 0
	let high = lines.length - 1
	let result = -1
	while (low <= high) {
		const mid = (low + high) >> 1
		if (lines[mid].time <= time) {
			result = mid
			low = mid + 1
		}
		else {
			high = mid - 1
		}
	}
	return result
}
