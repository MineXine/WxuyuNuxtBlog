import type { WidgetName } from './useWidgets'

/**
 * useAsideWithMusic — 给指定 widget 列表追加音乐 widget
 *
 * 播放器已经挪到站点头部（blog-text 旁边的胶囊），不再往侧边栏里塞
 * music-player widget，这里保留函数只为兼容既有调用方。
 *
 * 用法：
 *   layoutStore.setAside(useAsideWithMusic(['blog-stats', 'blog-tech']))
 */
export function useAsideWithMusic(widgets: WidgetName[]): WidgetName[] {
	return widgets
}
