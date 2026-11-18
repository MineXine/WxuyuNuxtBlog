import type { LrcLine, NeteaseLyric } from '~/composables/useMetingLyrics'
import type { MetingConfig, MetingPlayMode, MetingSong } from '~/meting.config'
import { extractSongId, findLyricIndex, parseLRC, parseNeteaseLyric } from '~/composables/useMetingLyrics'
/**
 * useMetingPlayer — Meting 音乐播放器核心逻辑
 *
 * 移植自 Next 博客的 `MusicPlayer.tsx`（同源歌单：网易云 7761179667），
 * 换成 Vue 3 的写法，并保留原版的性能约定：
 *
 * 1. 每帧都在变的进度 / 逐词高亮不进响应式状态，组件里用 rAF 直接改 DOM。
 * 2. 歌单落 localStorage 缓存 30 分钟，避免每次进站都打接口。
 * 3. 进度持久化是「节流」不是「防抖」：timeupdate 约 4 次/秒，
 *    防抖计时器会被不断重置，永远不触发，刷新后进度永远是 0。
 * 4. 装载歌曲时不写 localStorage，否则会把上次保存的进度覆盖成 0。
 *
 * 音频实例在客户端创建，SSR 阶段不会碰 DOM。
 */
import { METING_MODE_ICON, METING_MODE_LABEL, metingConfig, metingLyricApi, metingPlaylistApi, metingSongUrl, useMetingRuntimeConfig } from '~/meting.config'

/** 站内本地音源用的 key 前缀，避免和 meting 这套互相覆盖 */
const STORAGE_PREFIX = 'meting-player'
/** 歌单缓存 key */
const CACHE_KEY = `${STORAGE_PREFIX}-playlist`
/** 逐词歌词连续失败多少次后不再重试（避免每首都在失败接口上耗时间） */
const YRC_MAX_FAILURES = 2
/** 纯占位行（「------」这类） */
const PLACEHOLDER_LINE_RE = /^[-—–·.]+$/

/** 播放器对外暴露的状态 */
export interface MetingPlayerState {
	/** 歌单 */
	playlist: MetingSong[]
	/** 当前歌曲下标 */
	currentIndex: number
	/** 当前歌曲 */
	currentSong: MetingSong | undefined
	/** 是否正在播放 */
	isPlaying: boolean
	/** 播放模式 */
	mode: MetingPlayMode
	/** 音量（0 ~ 1） */
	volume: number
	/** 当前歌曲时长（秒） */
	duration: number
	/** 解析出的歌词 */
	lyrics: LrcLine[]
	/** 当前歌词行下标 */
	lyricIndex: number
	/** 歌单是否已加载 */
	ready: boolean
	/** 加载 / 播放错误信息 */
	error: string
}

export function useMetingPlayer() {
	const config = metingConfig
	const runtime = useMetingRuntimeConfig()

	/** 歌单 */
	const playlist = shallowRef<MetingSong[]>([])
	/** 当前歌曲下标 */
	const currentIndex = ref(0)
	/** 是否正在播放 */
	const isPlaying = ref(false)
	/** 播放模式 */
	const mode = ref<MetingPlayMode>(runtime.mode.value)
	/** 音量 */
	const volume = ref(runtime.volume.value)
	/** 时长（秒） */
	const duration = ref(0)
	/** 歌词 */
	const lyrics = shallowRef<LrcLine[]>([])
	/** 当前歌词行 */
	const lyricIndex = ref(-1)
	/** 是否已就绪 */
	const ready = ref(false)
	/** 错误提示 */
	const error = ref('')

	/** 音频实例（仅客户端） */
	let audio: HTMLAudioElement | null = null
	/** 音频实例引用（组件侧用来读进度，不进响应式深度代理） */
	const audioRef = shallowRef<HTMLAudioElement | null>(null)
	/** 上次落盘时间 */
	let lastPersist = 0
	/** 是否已恢复上次状态（恢复前不写盘，避免把进度覆盖成 0） */
	let restored = false
	/** 逐词歌词失败次数 */
	let yrcFailures = 0
	/** 同一首歌的官方外链兜底只试一次 */
	let fallbackTriedFor: string | null = null
	/** 元数据回来前记下的待跳转进度 */
	let pendingSeek: number | null = null
	/** 当前歌曲 id 的时长缓存已写入 */
	let cachedDurationId: string | null = null

	const currentSong = computed(() => playlist.value[currentIndex.value])

	/* ------------------------------------------------------------------ */
	/* 持久化                                                             */
	/* ------------------------------------------------------------------ */

	/** 读取上次的状态 */
	function readSaved(): {
		index: number
		hasIndex: boolean
		progress: number
		volume: number
		wantPlaying: boolean
		mode: MetingPlayMode
	} {
		const fallback = { index: 0, hasIndex: false, progress: 0, volume: config.volume, wantPlaying: false, mode: config.defaultMode }
		try {
			const rawIndex = localStorage.getItem(`${STORAGE_PREFIX}-songIndex`)
			const index = Number.parseInt(rawIndex ?? '', 10)
			const progress = Number(localStorage.getItem(`${STORAGE_PREFIX}-progress`) || 0)
			const savedVolume = Number(localStorage.getItem(`${STORAGE_PREFIX}-volume`) ?? Number.NaN)
			const savedMode = localStorage.getItem(`${STORAGE_PREFIX}-playMode`)
			return {
				index: Number.isFinite(index) ? index : 0,
				hasIndex: rawIndex !== null && Number.isFinite(index),
				progress: Number.isFinite(progress) ? progress : 0,
				volume: Number.isFinite(savedVolume) && savedVolume >= 0 && savedVolume <= 1 ? savedVolume : fallback.volume,
				wantPlaying: localStorage.getItem(`${STORAGE_PREFIX}-isPlaying`) === 'true',
				mode: savedMode === 'list' || savedMode === 'single' || savedMode === 'random' ? savedMode : config.defaultMode,
			}
		}
		catch {
			return fallback
		}
	}

	/**
	 * 节流写盘
	 *
	 * @param force 忽略节流强制写入
	 */
	function persist(force = false): void {
		if (!restored)
			return
		const now = Date.now()
		if (!force && now - lastPersist < config.persistGap)
			return
		lastPersist = now
		try {
			localStorage.setItem(`${STORAGE_PREFIX}-songIndex`, String(currentIndex.value))
			localStorage.setItem(`${STORAGE_PREFIX}-progress`, String(audio?.currentTime ?? 0))
			localStorage.setItem(`${STORAGE_PREFIX}-volume`, String(audio?.volume ?? volume.value))
			localStorage.setItem(`${STORAGE_PREFIX}-playMode`, mode.value)
			localStorage.setItem(`${STORAGE_PREFIX}-isPlaying`, String(audio ? !audio.paused : false))
		}
		catch {
			// 隐私模式写不进 localStorage，不影响播歌
		}
	}

	/* ------------------------------------------------------------------ */
	/* 歌词                                                               */
	/* ------------------------------------------------------------------ */

	/**
	 * 过滤掉「------」这类占位行
	 *
	 * @param lines 原始歌词行
	 * @returns 可用歌词行
	 */
	function usableLines(lines: LrcLine[]): LrcLine[] {
		return lines.filter((line) => {
			const text = (line.text ?? '').trim()
			// 负时间行是「作词 / 作曲」这类元信息，不进正片歌词
			if (line.time < 0)
				return false
			return text !== '' && !PLACEHOLDER_LINE_RE.test(text)
		})
	}

	/**
	 * 设置歌词
	 *
	 * @param lines 歌词行
	 */
	function setLyrics(lines: LrcLine[]): void {
		lyrics.value = usableLines(lines)
		lyricIndex.value = 0
	}

	/**
	 * 给当前歌曲加载歌词：逐词优先，退回普通 LRC
	 *
	 * @param song 歌曲
	 */
	async function loadLyricsForSong(song: MetingSong): Promise<void> {
		const id = song.id || extractSongId(song)
		if (!id) {
			setLyrics([])
			return
		}
		if (yrcFailures < YRC_MAX_FAILURES) {
			try {
				const res = await fetch(metingLyricApi(id, config))
				if (!res.ok)
					throw new Error(String(res.status))
				const lines = parseNeteaseLyric(await res.json() as NeteaseLyric)
				if (lines.length) {
					setLyrics(lines)
					return
				}
			}
			catch {
				// 逐词歌词拿不到就退到普通 lrc
				yrcFailures += 1
			}
		}
		if (song.lrc) {
			try {
				setLyrics(parseLRC(await (await fetch(song.lrc)).text()))
			}
			catch {
				setLyrics([])
			}
		}
		else {
			setLyrics([])
		}
	}

	/* ------------------------------------------------------------------ */
	/* 播放                                                               */
	/* ------------------------------------------------------------------ */

	/**
	 * 尝试播放（浏览器自动播放策略会拦截，失败就保持暂停）
	 */
	async function tryPlay(): Promise<void> {
		if (!audio)
			return
		try {
			await audio.play()
		}
		catch {
			isPlaying.value = false
		}
	}

	/**
	 * 装载一首曲目
	 *
	 * autoplay 由调用方显式决定，不猜；这里不写 localStorage。
	 *
	 * @param list 歌单
	 * @param index 下标
	 */
	async function loadTrack(list: MetingSong[], index: number): Promise<void> {
		if (!list.length || !audio)
			return
		const safeIndex = index < 0 || index >= list.length ? 0 : index
		const song = list[safeIndex]
		if (!song.url) {
			const id = song.id || extractSongId(song)
			if (id)
				song.url = metingSongUrl(id, config)
		}
		if (!song.url)
			return
		fallbackTriedFor = null
		if (audio.src !== song.url)
			audio.src = song.url
		if (song.id) {
			try {
				const cached = Number.parseFloat(localStorage.getItem(`${STORAGE_PREFIX}-dur-${song.id}`) || '')
				if (cached > 0 && Number.isFinite(cached))
					duration.value = cached
			}
			catch {
				// 读不到缓存就等 loadedmetadata
			}
		}
		if ('mediaSession' in navigator) {
			try {
				navigator.mediaSession.metadata = new MediaMetadata({
					title: song.name,
					artist: song.artist,
					artwork: song.pic ? [{ src: song.pic, sizes: '512x512', type: 'image/png' }] : [],
				})
			}
			catch {
				// 老浏览器不支持就跳过
			}
		}
		void loadLyricsForSong(song)
	}

	/**
	 * 跳到指定曲目
	 *
	 * @param index 下标
	 * @param autoplay 是否播放
	 */
	async function goToTrack(index: number, autoplay = true): Promise<void> {
		const list = playlist.value
		if (!list.length)
			return
		const safe = (index + list.length) % list.length
		currentIndex.value = safe
		pendingSeek = null
		await loadTrack(list, safe)
		if (autoplay) {
			await tryPlay()
		}
		else {
			audio?.pause()
			isPlaying.value = false
		}
		persist(true)
	}

	/**
	 * 随机挑一个不同于当前的曲目
	 *
	 * @param current 当前下标
	 * @param length 歌单长度
	 * @returns 新下标
	 */
	function pickRandomIndex(current: number, length: number): number {
		if (length <= 1)
			return 0
		let next = current
		while (next === current)
			next = Math.floor(Math.random() * length)
		return next
	}

	/**
	 * 下一曲
	 *
	 * @param manual 是否手动触发（手动触发时单曲循环也会跳下一首）
	 */
	function nextTrack(manual = true): void {
		const list = playlist.value
		if (!list.length)
			return
		if (!manual && mode.value === 'single') {
			void goToTrack(currentIndex.value, true)
			return
		}
		const next = mode.value === 'random'
			? pickRandomIndex(currentIndex.value, list.length)
			: (currentIndex.value + 1) % list.length
		void goToTrack(next, true)
	}

	/** 上一曲 */
	function prevTrack(): void {
		const list = playlist.value
		if (!list.length)
			return
		void goToTrack((currentIndex.value - 1 + list.length) % list.length, true)
	}

	/** 播放 / 暂停 */
	async function togglePlay(): Promise<void> {
		if (!audio)
			return
		if (audio.paused) {
			await tryPlay()
		}
		else {
			audio.pause()
			isPlaying.value = false
		}
	}

	/**
	 * 跳转进度
	 *
	 * @param time 秒
	 */
	function seek(time: number): void {
		if (!audio)
			return
		audio.currentTime = time
	}

	/**
	 * 设置音量
	 *
	 * @param value 0 ~ 1
	 */
	function setVolume(value: number): void {
		const clamped = Math.min(1, Math.max(0, value))
		volume.value = clamped
		runtime.setVolume(clamped)
		if (audio)
			audio.volume = clamped
		persist(true)
	}

	/** 切换播放模式 */
	function toggleMode(): void {
		mode.value = mode.value === 'list' ? 'single' : mode.value === 'single' ? 'random' : 'list'
		runtime.setMode(mode.value)
		persist(true)
	}

	/* ------------------------------------------------------------------ */
	/* 初始化                                                             */
	/* ------------------------------------------------------------------ */

	/**
	 * 拉歌单（带 localStorage 缓存）
	 */
	async function loadPlaylist(): Promise<MetingSong[]> {
		try {
			const cached = localStorage.getItem(CACHE_KEY)
			if (cached) {
				const data = JSON.parse(cached) as { timestamp: number, songs?: MetingSong[] }
				if (Date.now() - data.timestamp < config.cacheTTL && data.songs?.length)
					return data.songs.map(song => ({ ...song }))
			}
		}
		catch {
			// 缓存坏了就重新拉
		}
		try {
			const raw = await (await fetch(metingPlaylistApi(config))).json()
			const songs = (Array.isArray(raw) ? raw : []).map((song: Record<string, unknown>) => ({
				...song,
				id: (song.id as string) ?? extractSongId(song as { url?: string }),
			})) as MetingSong[]
			try {
				localStorage.setItem(CACHE_KEY, JSON.stringify({
					timestamp: Date.now(),
					songs: songs.map(song => ({
						id: song.id,
						name: song.name,
						artist: song.artist,
						pic: song.pic,
						lrc: song.lrc,
					})),
				}))
			}
			catch {
				// 存不进就不存
			}
			return songs
		}
		catch {
			error.value = '歌单加载失败，检查网络或 meting 接口'
			return []
		}
	}

	/**
	 * 初始化播放器（客户端）
	 */
	async function init(): Promise<void> {
		if (!import.meta.client)
			return
		const songs = await loadPlaylist()
		if (!songs.length)
			return
		playlist.value = songs

		const saved = readSaved()
		// 第一次来随机挑一首；老访客接着上次那首
		const index = saved.hasIndex && saved.index >= 0 && saved.index < songs.length
			? saved.index
			: Math.floor(Math.random() * songs.length)
		mode.value = saved.mode
		volume.value = saved.volume
		currentIndex.value = index

		if (!audio) {
			audio = new Audio()
			audioRef.value = audio
			audio.preload = 'none'
			audio.volume = saved.volume
			audio.addEventListener('play', () => {
				isPlaying.value = true
			})
			audio.addEventListener('pause', () => {
				isPlaying.value = false
			})
			audio.addEventListener('ended', () => nextTrack(false))
			audio.addEventListener('timeupdate', () => persist())
			audio.addEventListener('loadedmetadata', () => {
				const d = audio?.duration ?? 0
				if (d && Number.isFinite(d)) {
					duration.value = d
					const songId = playlist.value[currentIndex.value]?.id
					if (songId && cachedDurationId !== songId) {
						cachedDurationId = songId
						try {
							localStorage.setItem(`${STORAGE_PREFIX}-dur-${songId}`, String(d))
						}
						catch {
							// 存不进就算了
						}
					}
				}
				// 元数据回来之前 currentTime 写不进去，这里补跳
				if (pendingSeek !== null && audio) {
					audio.currentTime = pendingSeek
					pendingSeek = null
				}
			})
			audio.addEventListener('error', () => {
				const song = playlist.value[currentIndex.value]
				const id = song?.id || extractSongId(song ?? {})
				// 同一首歌只试一次官方外链，避免死循环
				if (!id || fallbackTriedFor === id)
					return
				fallbackTriedFor = id
				if (audio)
					audio.src = `${config.neteaseUrlBase}${id}`
			})
		}

		await loadTrack(songs, index)
		ready.value = true
		// 随机初始曲时不能沿用上次的进度，否则会跳到曲子中间
		if (saved.hasIndex && saved.progress > 0 && Number.isFinite(saved.progress))
			pendingSeek = saved.progress
		restored = true
		if (saved.wantPlaying)
			await tryPlay()
	}

	/**
	 * 同步歌词行下标（每帧调用，只在换行时写状态）
	 *
	 * @param time 当前时间（秒）
	 */
	function syncLyricIndex(time: number): void {
		if (!lyrics.value.length)
			return
		const index = findLyricIndex(lyrics.value, time)
		if (index !== -1 && index !== lyricIndex.value)
			lyricIndex.value = index
	}

	/**
	 * 释放资源
	 */
	function dispose(): void {
		persist(true)
		if (audio) {
			audio.pause()
			audio.src = ''
		}
	}

	return {
		// 音频实例（组件侧每帧读进度用）
		audioRef,
		// 状态
		playlist,
		currentIndex,
		currentSong,
		isPlaying,
		mode,
		volume,
		duration,
		lyrics,
		lyricIndex,
		ready,
		error,
		// 方法
		init,
		dispose,
		togglePlay,
		nextTrack,
		prevTrack,
		goToTrack,
		seek,
		setVolume,
		toggleMode,
		syncLyricIndex,
		persist,
		// 配置
		modeLabel: computed(() => METING_MODE_LABEL[mode.value]),
		modeIcon: computed(() => METING_MODE_ICON[mode.value]),
	}
}

export type { MetingConfig }
