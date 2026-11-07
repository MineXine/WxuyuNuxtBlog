import type { ReadTimeResults } from 'reading-time'
import { defineCollection } from '@nuxt/content'
import { asSitemapCollection } from '@nuxtjs/sitemap/content'
import { z } from 'zod'
import blogConfig from './blog.config'

type ArticleType = keyof typeof blogConfig.article.types
// 文章类型已在 blog.config 中定义，此处使用 any 类型绕过 zod 类型验证
const articleTypes = Object.keys(blogConfig.article.types) as any

export interface ModelAssetsSchema {
	/** 骨架文件（.skel 二进制 / .json） */
	ModelSkel?: string
	/** 贴图（图集引用的 png/jpg/webp） */
	ModelImage?: string
	/** 图集文件（.atlas） */
	ModelAtlas?: string
}

export interface ArticleSchema {
	title?: string
	subtitle?: string
	description?: string
	date?: string
	updated?: string
	published?: string
	categories?: string[]
	tags?: string[]
	type?: ArticleType

	image?: string
	recommend?: number
	references?: { title?: string, link?: string }[]
	/** TODO */
	draft?: boolean
	permalink?: string

	/** 模型名称（type: model 时用于展示与检索） */
	ModelName?: string
	/** 模型品质（图鉴排序用，如 金 / 橙金 / 紫 / 蓝 / 绿 / 粉 / 红） */
	ModelQuality?: string
	/** 模型立绘（图鉴卡片封面，建议 3:4 透明底） */
	ModelPortrait?: string
	/** 模型资源路径（统一放 public 下，SSG 时随站点一起发布） */
	ModelAssets?: ModelAssetsSchema

	readingTime?: ReadTimeResults
}

const articleSchema = z.object({
	title: z.string().optional(),
	description: z.string().optional(),
	date: z.string().optional(),
	updated: z.string().optional(),
	published: z.string().optional(),
	categories: z.array(z.string()).default([blogConfig.defaultCategory]),
	tags: z.array(z.string()).default([]),
	type: z.enum(articleTypes).optional().default(articleTypes[0]),

	image: z.string().optional(),
	subtitle: z.string().optional(),
	recommend: z.number().optional(),
	references: z.array(z.object({
		title: z.string().optional(),
		link: z.string().optional(),
	})).optional(),
	draft: z.boolean().default(false),
	permalink: z.string().optional(),

	ModelName: z.string().optional(),
	ModelQuality: z.string().optional(),
	ModelPortrait: z.string().optional(),
	ModelAssets: z.object({
		ModelSkel: z.string().optional(),
		ModelImage: z.string().optional(),
		ModelAtlas: z.string().optional(),
	}).optional(),

	readingTime: z.object({
		text: z.string(),
		minutes: z.number(),
		time: z.number(),
		words: z.number(),
	}),
}) satisfies z.ZodType<ArticleSchema>

export const collections = {
	content: defineCollection(asSitemapCollection({
		source: '**',
		type: 'page',
		schema: articleSchema,
	})),
}
