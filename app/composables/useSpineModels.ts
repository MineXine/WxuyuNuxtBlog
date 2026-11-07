/**
 * useSpineModels.ts — 模型资源索引
 *
 * 说说内容里可以用 MDC 组件嵌入模型预览：
 *
 * ```md
 * ::spine-model{name="9100140-a"}
 * ```
 *
 * 组件只拿到模型名，真实的骨架 / 图集 / 贴图路径需要从「模型文章」的 frontmatter 里查，
 * 这里把 content 集合里所有 type=model 的文章收敛成 name → 资源的索引。
 */

import type { SpineModelAssets } from '~/utils/spineAssets'

/** 索引条目 */
export interface SpineModelEntry {
	/** 模型名（ModelName，缺省用文章标题） */
	name: string
	/** 文章标题 */
	title: string
	/** 三件套资源 */
	assets: SpineModelAssets
	/** 头像 / 封面图 */
	portrait?: string
}

/**
 * 模型索引（Map：模型名 → 条目）
 *
 * 同一份数据用固定的 key，所有 MDC 组件实例共享一次请求。
 */
export function useSpineModelIndex() {
	const { data } = useAsyncData<SpineModelEntry[]>('spine-model-index', async () => {
		const models = await queryCollection('content').where('type', '=', 'model').all()
		return models.map((model: any) => ({
			name: String(model.ModelName || model.title || ''),
			title: String(model.title || model.ModelName || ''),
			assets: (model.ModelAssets ?? {}) as SpineModelAssets,
			portrait: model.ModelPortrait,
		})).filter(item => item.name)
	})

	const index = computed(() => {
		const map = new Map<string, SpineModelEntry>()
		for (const item of data.value ?? [])
			map.set(item.name, item)
		return map
	})

	return { index, models: data }
}
