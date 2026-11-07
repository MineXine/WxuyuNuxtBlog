/**
 * userAgent.ts — User-Agent 解析（浏览器 + 版本 + 操作系统 + 设备形态）
 *
 * 说说内容在发布时记录「设备信息」：网页端即浏览器 + 版本号，
 * 手机端则识别为移动浏览器（微信 / QQ 内置浏览器等一并识别）。
 *
 * 纯函数、无副作用，客户端（展示）与服务端（发布时记录）共用同一套实现，
 * 保证两边解析结果一致。
 */

/** 设备形态 */
export type MemosDeviceType = 'desktop' | 'mobile' | 'tablet' | 'bot' | 'unknown'

/** 解析结果 */
export interface ParsedUserAgent {
	/** 浏览器名，如 Chrome / Edge / Safari / 微信 */
	browser: string
	/** 浏览器版本号，如 131.0.6778.86 */
	version: string
	/** 操作系统，如 Windows 11 / macOS / iOS / Android */
	os: string
	/** 设备形态 */
	device: MemosDeviceType
	/** 原始 UA（保留，便于后台排查） */
	ua: string
}

/** 浏览器特征表：按优先级从高到低匹配 */
const BROWSER_RULES: { name: string, re: RegExp, version: RegExp }[] = [
	// 微信内置浏览器
	{ name: '微信', re: /MicroMessenger/i, version: /MicroMessenger\/[\d.]+/i },
	// QQ / TIM 内置浏览器
	{ name: 'QQ 浏览器', re: /(?:MQQBrowser|QQBrowser)/i, version: /(?:MQQBrowser|QQBrowser)\/[\d.]+/i },
	// 支付宝内置浏览器
	{ name: '支付宝', re: /AlipayClient/i, version: /AlipayClient\/[\d.]+/i },
	// 夸克 / UC
	{ name: '夸克浏览器', re: /Quark/i, version: /Quark\/[\d.]+/i },
	{ name: 'UC 浏览器', re: /UCBrowser/i, version: /UCBrowser\/[\d.]+/i },
	// 百度
	{ name: '百度浏览器', re: /baidubrowser|BaiduApp/i, version: /(?:baidubrowser|BaiduApp)\/[\d.]+/i },
	// Edge（新版 Chromium 与旧版 Edge）
	{ name: 'Edge', re: /Edg(?:A|iOS)?\//i, version: /Edg(?:A|iOS)?\/[\d.]+/i },
	{ name: 'Edge', re: /Edge\//i, version: /Edge\/[\d.]+/i },
	// Opera
	{ name: 'Opera', re: /OPR\//i, version: /OPR\/[\d.]+/i },
	{ name: 'Opera', re: /Opera[ /]/i, version: /Opera[ /][\d.]+/i },
	// Vivaldi / Brave / Yandex
	{ name: 'Vivaldi', re: /Vivaldi\//i, version: /Vivaldi\/[\d.]+/i },
	{ name: 'Brave', re: /Brave\//i, version: /Brave\/[\d.]+/i },
	{ name: 'Yandex', re: /YaBrowser\//i, version: /YaBrowser\/[\d.]+/i },
	// Firefox（含 FxiOS）
	{ name: 'Firefox', re: /(?:Firefox|FxiOS)\//i, version: /(?:Firefox|FxiOS)\/[\d.]+/i },
	// Chrome / Chromium（注意要在 Edge/Opera 之后匹配）
	{ name: 'Chrome', re: /(?:Chrome|CriOS)\//i, version: /(?:Chrome|CriOS)\/[\d.]+/i },
	// Safari（其余浏览器均已排除，这里只需确认带 Safari 标记）
	{ name: 'Safari', re: /Safari\//i, version: /Version\/[\d.]+/i },
]

/** 爬虫 / 机器人 */
const BOT_RE = /bot\b|spider|crawler|slurp|bingpreview|headlesschrome|facebookexternalhit|semrush|ahrefs|baiduspider|googlebot/i

/** 操作系统特征（模块级常量，避免每次调用重新编译） */
const OS_RULES = [
	{ os: 'Windows 10/11', re: /Windows NT 10\.0/i },
	{ os: 'Windows 8.1', re: /Windows NT 6\.3/i },
	{ os: 'Windows 7', re: /Windows NT 6\.1/i },
	{ os: 'Windows', re: /Windows/i },
] as const

const IPHONE_OS_RE = /iPhone OS [\d_]+/i
const IPAD_RE = /iPad/i
const ANDROID_RE = /Android[ /]?[\d.]+/i
const MACOS_RE = /Mac OS X [_\d.]+/i
const CHROMEOS_RE = /CrOS/i
const LINUX_RE = /Linux/i
const TABLET_RE = /iPad|Tablet|PlayBook|Silk/i
const MOBILE_RE = /Mobi|iPhone|Android.*Mobile|Windows Phone/i
const MOBILE_GENERIC_RE = /Mobile/i
const DESKTOP_RE = /Windows|Macintosh|X11|Linux/i
/** 下划线版本号转点号 */
const UNDERSCORE_RE = /_/g
/** 版本号片段 */
const VERSION_TOKEN_RE = /[\d.]+/

/** 操作系统识别 */
function parseOs(ua: string): string {
	for (const rule of OS_RULES) {
		if (rule.re.test(ua))
			return rule.os
	}
	if (IPHONE_OS_RE.test(ua)) {
		const v = ua.match(IPHONE_OS_RE)?.[0].match(VERSION_TOKEN_RE)?.[0]?.replace(UNDERSCORE_RE, '.')
		return `iOS ${v ?? ''}`.trim()
	}
	if (IPAD_RE.test(ua))
		return 'iPadOS'
	if (ANDROID_RE.test(ua)) {
		const v = ua.match(ANDROID_RE)?.[0].match(VERSION_TOKEN_RE)?.[0]
		return `Android ${v ?? ''}`.trim()
	}
	if (MACOS_RE.test(ua)) {
		const v = ua.match(MACOS_RE)?.[0].match(VERSION_TOKEN_RE)?.[0]?.replace(UNDERSCORE_RE, '.')
		return `macOS ${v ?? ''}`.trim()
	}
	if (CHROMEOS_RE.test(ua))
		return 'ChromeOS'
	if (LINUX_RE.test(ua))
		return 'Linux'
	return '未知系统'
}

/** 设备形态 */
function parseDevice(ua: string): MemosDeviceType {
	if (BOT_RE.test(ua))
		return 'bot'
	if (TABLET_RE.test(ua))
		return 'tablet'
	if (MOBILE_RE.test(ua))
		return 'mobile'
	if (MOBILE_GENERIC_RE.test(ua))
		return 'mobile'
	if (DESKTOP_RE.test(ua))
		return 'desktop'
	return 'unknown'
}

/**
 * 解析 User-Agent
 *
 * @param ua 原始 UA 串
 * @returns 浏览器 / 版本 / 系统 / 设备形态
 */
export function parseUserAgent(ua?: string | null): ParsedUserAgent {
	const raw = (ua ?? '').trim()
	if (!raw)
		return { browser: '未知浏览器', version: '', os: '未知系统', device: 'unknown', ua: '' }

	for (const rule of BROWSER_RULES) {
		if (!rule.re.test(raw))
			continue
		const matched = raw.match(rule.version)?.[0] ?? ''
		const version = matched.match(VERSION_TOKEN_RE)?.[0] ?? ''
		return {
			browser: rule.name,
			version,
			os: parseOs(raw),
			device: parseDevice(raw),
			ua: raw,
		}
	}

	return {
		browser: '未知浏览器',
		version: '',
		os: parseOs(raw),
		device: parseDevice(raw),
		ua: raw,
	}
}

/**
 * 生成「浏览器 + 版本」的展示文案
 *
 * @example formatDeviceLabel({ browser: 'Chrome', version: '131.0.6778.86' }) → "Chrome 131.0"
 */
export function formatDeviceLabel(info?: { browser?: string, version?: string } | null): string {
	if (!info?.browser)
		return ''
	const version = info.version ? ` ${info.version.split('.').slice(0, 2).join('.')}` : ''
	return `${info.browser}${version}`
}

/** 设备形态 → 图标名（Phosphor Icons） */
export function deviceIcon(info?: { device?: string } | null): string {
	switch (info?.device) {
		case 'mobile':
			return 'ph:device-mobile-bold'
		case 'tablet':
			return 'ph:device-tablet-bold'
		case 'bot':
			return 'ph:robot-bold'
		case 'desktop':
			return 'ph:desktop-tower-bold'
		default:
			return 'ph:browser-bold'
	}
}
