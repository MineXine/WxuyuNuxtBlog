import type { ArticleOrderType, ArticleProps } from '~/types/article'
import { orderBy } from 'es-toolkit/array'

/**
 * 生成文章查询参数，完全包装 useAsyncData 会使 SSR 行为异常，缓存 key 需要暴露
 * @see https://nuxt.com/docs/4.x/api/composables/use-async-data#usage
 * @see https://github.com/nuxt/nuxt/issues/14736
 * @todo 支持分页/分类筛选
 */
export function useArticleIndexOptions(path = 'posts/%') {
	return queryCollection('content')
		.where('stem', 'LIKE', path)
		.select('categories', 'date', 'description', 'image', 'path', 'readingTime', 'recommend', 'tags', 'title', 'type', 'updated')
		.all()
}

/**
 * 模型文章（type: model）列表查询
 *
 * 数据在构建期由 queryCollection 取好并随页面一起静态化（SSG），
 * 因此模型浏览页无需在客户端再发请求。
 */
export function useModelIndexOptions() {
	return queryCollection('content')
		.where('type', '=', 'model')
		.select('categories', 'date', 'description', 'image', 'path', 'tags', 'title', 'type', 'updated', 'ModelName', 'ModelQuality', 'ModelPortrait', 'ModelAssets')
		.all()
}

/** 文档（wiki）列表查询，构建期取数后随页面静态化 */
export function useWikiIndexOptions() {
	return queryCollection('content')
		.where('type', '=', 'wiki')
		.select('categories', 'date', 'description', 'image', 'path', 'tags', 'title', 'type', 'updated')
		.all()
}

interface UseCategoryOptions {
	bindQuery?: string
}

export function useCategory(list: MaybeRefOrGetter<ArticleProps[]>, options?: UseCategoryOptions) {
	const { bindQuery } = options || {}

	const category = bindQuery
		? useRouteQuery(bindQuery, undefined)
		: ref<string | undefined>()

	const categories = computed(() => [...new Set(toValue(list).map(item => item.categories?.[0]))])

	const listCategorized = computed(
		() => toValue(list).filter(
			item => !category.value || item.categories?.[0] === category.value,
		),
	)

	return {
		category,
		categories,
		listCategorized,
	}
}

interface UseArticleSortOptions {
	bindDirectionQuery?: string
	bindOrderQuery?: string
	initialAscend?: boolean
	initialOrder?: ArticleOrderType
}

export function useArticleSort(list: MaybeRefOrGetter<ArticleProps[]>, options?: UseArticleSortOptions) {
	const appConfig = useAppConfig()
	const {
		bindDirectionQuery,
		bindOrderQuery,
		initialAscend = false,
		initialOrder = appConfig.pagination.sortOrder || 'date',
	} = options || {}

	const sortOrder = bindOrderQuery
		? useRouteQuery(bindOrderQuery, initialOrder)
		: ref<ArticleOrderType>(initialOrder)

	const booleanQueryTransformer = {
		get: (val: string) => val === 'true',
		set: (val: boolean) => val.toString(),
	}

	const isAscending = bindDirectionQuery
		? useRouteQuery(bindDirectionQuery, initialAscend.toString(), { transform: booleanQueryTransformer })
		: ref<boolean>(initialAscend)

	const listSorted = computed(() => orderBy(
		toValue(list),
		[sortOrder.value, 'date'],
		[isAscending.value ? 'asc' : 'desc'],
	))

	return {
		sortOrder,
		isAscending,
		listSorted,
	}
}

export function getCategoryIcon(category?: string) {
	const appConfig = useAppConfig()
	return appConfig.article.categories[category!]?.icon ?? 'ph:folder-bold'
}

interface GetPostTypeClassNameOptions {
	prefix?: string
}

export function getPostTypeClassName(type = 'tech', options?: GetPostTypeClassNameOptions) {
	const { prefix = 'text' } = options || {}
	return `${prefix}-${type}`
}

/** 文章类型显示名（blog.config 中 types 的 label，缺省回落到 key） */
const ARTICLE_TYPE_LABELS: Record<string, string> = {
	tech: '技术',
	story: '故事',
	model: '模型',
}

export function getArticleTypeLabel(type?: string) {
	if (!type)
		return ''
	const configured = (useAppConfig().article.types as Record<string, { label?: string }>)?.[type]?.label
	return configured || ARTICLE_TYPE_LABELS[type] || type
}
