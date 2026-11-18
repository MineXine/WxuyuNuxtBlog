import { useState } from '#imports'

/**
 * meting.config.ts —— Meting 音乐源播放器配置
 *
 * 音源走 Meting（网易云歌单），歌词走逐词（YRC）代理，
 * 胶囊入口挂在站点头部 `blog-text` 旁边。
 *
 * 旧的那套本地音源（useMusicPlayer / useMusicSource / FloatingPlayer）
 * 已经整套移除，这里是站内唯一的音乐播放器实现。
 *
 * 换歌单只改 `playlistId` 一处即可。
 */

export type MetingPlayMode = 'list' | 'single' | 'random'

export interface MetingSong {
	/** 歌曲 ID（网易云） */
	id?: string
	/** 歌名 */
	name: string
	/** 歌手 */
	artist: string
	/** 封面 */
	pic?: string
	/** 音频地址 */
	url?: string
	/** 普通 LRC 歌词地址 */
	lrc?: string
}

export interface MetingConfig {
	/** 总开关：关掉后组件不渲染、不拉歌单 */
	enabled: boolean
	/** 网易云歌单 ID */
	playlistId: string
	/** 歌单类型：playlist / album / artist / search */
	playlistType: 'playlist' | 'album' | 'artist' | 'search'
	/** Meting API 基础地址 */
	apiBase: string
	/** 逐词歌词接口（`{id}` 会替换成歌曲 ID），走站内代理 */
	lyricApi: string
	/** 网易云官方外链兜底（meting 解析失败时用） */
	neteaseUrlBase: string
	/** 歌单缓存时长（毫秒） */
	cacheTTL: number
	/** 播放进度落盘的最小间隔（毫秒） */
	persistGap: number
	/** 初始音量（0 ~ 1） */
	volume: number
	/** 默认播放模式 */
	defaultMode: MetingPlayMode
	/** 胶囊是否在移动端显示（默认不显示） */
	showOnMobile: boolean
	/** 面板里是否默认展开歌词卡 */
	defaultLyricsOpen: boolean
}

export const metingConfig: MetingConfig = {
	enabled: true,
	playlistId: '7761179667',
	playlistType: 'playlist',
	apiBase: 'https://api.qijieya.cn/meting/',
	lyricApi: '/api/lyric?id={id}',
	neteaseUrlBase: 'https://music.163.com/song/media/outer/url?id=',
	cacheTTL: 30 * 60 * 1000,
	persistGap: 900,
	volume: 0.5,
	defaultMode: 'list',
	showOnMobile: false,
	defaultLyricsOpen: false,
}

/** 歌单接口地址 */
export function metingPlaylistApi(config: MetingConfig = metingConfig): string {
	return `${config.apiBase}?type=${config.playlistType}&id=${config.playlistId}`
}

/** 单曲音频地址（meting 会 302 到真实 mp3） */
export function metingSongUrl(id: string, config: MetingConfig = metingConfig): string {
	return `${config.apiBase}?server=netease&type=url&id=${id}`
}

/** 逐词歌词接口地址 */
export function metingLyricApi(id: string, config: MetingConfig = metingConfig): string {
	return config.lyricApi.replace('{id}', id)
}

/** 播放模式中文名 */
export const METING_MODE_LABEL: Record<MetingPlayMode, string> = {
	list: '列表循环',
	single: '单曲循环',
	random: '随机播放',
}

/** 播放模式图标（Iconify 名称） */
export const METING_MODE_ICON: Record<MetingPlayMode, string> = {
	list: 'material-symbols:repeat-rounded',
	single: 'material-symbols:repeat-one-rounded',
	random: 'material-symbols:shuffle-rounded',
}

/**
 * useMetingRuntimeConfig — 运行时可改的播放器配置
 *
 * 静态配置写在上面的 `metingConfig` 里（换歌单改那一处即可），
 * 这里暴露的是「页面上能临时改」的几项：总开关、音量、播放模式。
 * 用 useState 存，刷新后仍在。
 */
export function useMetingRuntimeConfig() {
	const enabled = useState<boolean>('meting-enabled', () => metingConfig.enabled)
	const volume = useState<number>('meting-volume', () => metingConfig.volume)
	const mode = useState<MetingPlayMode>('meting-mode', () => metingConfig.defaultMode)

	/** 设置总开关 */
	function setEnabled(value: boolean): void {
		enabled.value = value
	}
	/** 设置音量（0 ~ 1） */
	function setVolume(value: number): void {
		volume.value = Math.min(1, Math.max(0, value))
	}
	/** 设置播放模式 */
	function setMode(value: MetingPlayMode): void {
		mode.value = value
	}

	return { enabled, volume, mode, setEnabled, setVolume, setMode }
}
