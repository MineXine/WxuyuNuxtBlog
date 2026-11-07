/**
 * ipLocation.ts — IP 属地解析与格式化
 *
 * 说说的「IP 属地」由发布端（说说系统服务端）根据请求来源 IP 判定，
 * 这里只负责：
 *   1. 从请求头里提取真实客户端 IP（兼容反向代理）
 *   2. 把服务端返回的结构化属地 / 字符串属地统一成展示文案
 *
 * 服务端内置的属地库能力见说说系统项目（server/utils/ipLocation.ts），
 * 两边共用同一套字段命名：{ country, region, city, text }。
 */

/** 结构化属地 */
export interface IpLocation {
	/** 国家 / 地区 */
	country?: string
	/** 省 / 州 */
	region?: string
	/** 城市 */
	city?: string
	/** 完整展示文案，如「广东 深圳」 */
	text: string
}

/** 提取客户端 IP 的请求头（按优先级） */
const IP_HEADERS = [
	'cf-connecting-ip',
	'x-real-ip',
	'x-forwarded-for',
	'x-client-ip',
	'true-client-ip',
] as const

/**
 * 从请求头中提取客户端 IP
 *
 * @param headers 请求头对象（可读 get() 的形式，如 H3Event.headers / Headers）
 * @returns IP 字符串；取不到时返回空串
 */
export function getClientIp(headers: { get?: (name: string) => string | null | undefined } | Record<string, unknown> | null | undefined): string {
	if (!headers)
		return ''

	const read = (name: string): string => {
		if (typeof (headers as any).get === 'function')
			return String((headers as any).get(name) ?? '')
		const raw = (headers as Record<string, unknown>)[name] ?? (headers as Record<string, unknown>)[name.toLowerCase()]
		return raw == null ? '' : String(raw)
	}

	for (const name of IP_HEADERS) {
		const value = read(name)
		if (!value)
			continue
		// x-forwarded-for 可能是 "client, proxy1, proxy2"，取第一个
		const ip = value.split(',')[0]?.trim() ?? ''
		if (ip && ip !== 'unknown')
			return ip
	}
	return ''
}

/** 172.16 - 172.31 私有段 */
const PRIVATE_172_RE = /^172\.(\d{1,3})\./
/** IPv6 唯一本地地址前缀 */
const PRIVATE_IPV6_PREFIXES = ['fc', 'fd', 'fe80']

/**
 * 私有 / 本地地址判断（内网用户不显示属地）
 *
 * @param ip IP 地址
 * @returns 是否属于私有网段
 */
export function isPrivateIp(ip: string): boolean {
	if (!ip)
		return true
	const v = ip.toLowerCase()
	if (v === '::1' || v === '0.0.0.0' || v.startsWith('127.') || v.startsWith('10.')
		|| v.startsWith('192.168.') || v.startsWith('169.254.')) {
		return true
	}
	// 172.16 - 172.31
	const m172 = v.match(PRIVATE_172_RE)
	if (m172 && Number(m172[1]) >= 16 && Number(m172[1]) <= 31)
		return true
	// fc00::/7 唯一本地地址
	if (PRIVATE_IPV6_PREFIXES.some(prefix => v.startsWith(prefix)))
		return true
	return false
}

/**
 * 把服务端返回的属地字段（字符串或对象）统一成展示文案
 *
 * @param raw 可能是 "广东 深圳" / { country, region, city } / undefined
 * @returns 展示文案（无数据时返回空串）
 */
export function normalizeIpLocation(raw: unknown): IpLocation {
	if (!raw)
		return { text: '' }

	if (typeof raw === 'string') {
		const text = raw.trim()
		if (!text || text === '未知' || text === 'unknown')
			return { text: '' }
		// "中国 广东 深圳" → 去掉国家前缀，只留省市
		return { text }
	}

	if (typeof raw === 'object') {
		const obj = raw as Record<string, unknown>
		const country = str(obj.country)
		const region = str(obj.region) || str(obj.province) || str(obj.state)
		const city = str(obj.city) || str(obj.district)
		const text = str(obj.text) || str(obj.location) || [region, city].filter(Boolean).join(' ') || country
		return { country, region, city, text: text.trim() }
	}

	return { text: '' }
}

function str(v: unknown): string {
	return typeof v === 'string' ? v.trim() : v == null ? '' : String(v)
}
