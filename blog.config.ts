import type { FeedEntry } from './app/types/feed'

const basicConfig = {
	title: '闻絮语',
  subtitle: '凡尘修行悟道，叩问仙缘之境',
	// 长 description 利好于 SEO
	description: '闻絮语的博客网站，分享技术和魔改。网站界面简洁美观，涵盖了魔改、教程等多个领域，为读者提供了卓越的阅读体验。',
	author: {
		name: '絮语',
    avatar: '/image/SiteCover/avatar.avif',
    email: '3227988255@qq.com',
    homepage: 'https://www.wxuyu.top',
	},
	copyright: {
		abbr: 'CC BY-NC-SA 4.0',
		name: '署名-非商业性使用-相同方式共享 4.0 国际',
		url: 'https://creativecommons.org/licenses/by-nc-sa/4.0/deed.zh-hans',
	},
	favicon: '/image/SiteCover/avatar.avif',
	language: 'zh-CN',
	timeEstablished: '2020-07-19',
	timeStart: '2020',
  timeZone: 'Asia/Shanghai',
  url: 'https://www.wxuyu.top',
	defaultCategory: '未分类',
  tip: {
    PowerByTip: '前往我的主页'
  }
}

// 存储 nuxt.config 和 app.config 共用的配置
// 此处为启动时需要的配置，启动后可变配置位于 app/app.config.ts
// @keep-sorted
const blogConfig = {
	...basicConfig,

	article: {
		categories: {
			[basicConfig.defaultCategory]: { icon: 'ph:folder-dotted-bold' },
			站点魔改: { icon: 'ph:wrench-bold', color: '#77f' },
			日志记录: { icon: 'ph:notebook-bold', color: '#7af' },
			技术探索: { icon: 'ph:cpu-bold', color: '#fa3' },
			日常随笔: { icon: 'ph:pen-bold', color: '#af7' },
			自设记录: { icon: 'ph:book-open-text-bold', color:'#a78'},
			// 文档 wiki 分类
			模型图鉴: { icon: 'ph:cube-bold', color: '#E9C584' },
			文档规范: { icon: 'ph:notebook-bold', color: '#79AEE8' },
			// 模型图鉴分类（对应《少年三国志2》图鉴可选项）
			武将: { icon: 'ph:user-bold', color: '#E9C584' },
			神兵: { icon: 'ph:sword-bold', color: '#C79A57' },
			神兽: { icon: 'ph:paw-print-bold', color: '#8FBF6A' },
			红颜: { icon: 'ph:heart-straight-bold', color: '#E39BC0' },
			军师: { icon: 'ph:chess-knight-bold', color: '#79AEE8' },
			战法: { icon: 'ph:scroll-bold', color: '#B48BE0' },
			合击: { icon: 'ph:lightning-bold', color: '#E0A05A' },
			副将: { icon: 'ph:shield-bold', color: '#9BB2C4' },
			坐骑: { icon: 'ph:horse-bold', color: '#DE7C6E' },
		},
		defaultCategoryIcon: 'ph:folder-bold',
		/** 文章版式，首个为默认版式 */
		types: {
			tech: { label: '技术' },
			story: { label: '故事' },
			/** 模型：正文用于展示 Spine 骨架模型（配合 ModelName / ModelAssets 字段） */
			model: { label: '模型' },
			/** 文档：wiki 界面里的条目（/wiki） */
			wiki: { label: '文档' },
		},
		/** 分类排序方式，键为排序字段，值为显示名称 */
		order: {
			date: '创建日期',
			updated: '更新日期',
			// title: '标题',
		},
		/** 使用 pnpm new 新建文章时自动生成自定义链接（permalink/abbrlink） */
		useRandomPremalink: false,
		/** 隐藏基于文件路由（不是自定义链接）的 URL /post 路径前缀 */
		hidePostPrefix: true,
		/** 禁止搜索引擎收录的路径 */
		robotsNotIndex: ['/preview', '/previews/*'],
	},

	excerpt: {
		label: '智能摘要',
		badge: 'Kimi·K2.5',
	},

	/** 博客 Atom 订阅源 */
	feed: {
		/** 订阅源最大文章数量 */
		limit: 50,
		/** 订阅源是否启用XSLT样式 */
		enableStyle: true,
	},

	/** 在线状态组件数据源 */
	presence: {
		/** Process Reporter latest 读取接口 */
		latestEndpoint: '',
	},

	/** 向 <head> 中添加脚本 */
	scripts: [
		// Twikoo 评论系统
		{ src: 'https://s4.zstatic.net/npm/twikoo@1.7.7/dist/twikoo.min.js', defer: true, crossorigin: 'anonymous' },
	] satisfies Array<{
		src: string
		defer?: boolean
		crossorigin?: '' | 'anonymous' | 'use-credentials'
		[key: `data-${string}`]: string | undefined
	}>,

	/** 自己部署的 Twikoo 服务 */
	twikoo: {
		envId: 'https://twikoo.comment.wxuyu.top/',
		preload: 'https://twikoo.comment.wxuyu.top/',
	},

  Steam: {
    status: 'https://steam.status.api.wxuyu.top/api'
  },
}

/** 用于生成 OPML 和友链页面配置 */
export const myFeed: FeedEntry = {
	author: blogConfig.author.name,
	sitenick: '闻絮语',
	title: blogConfig.title,
	desc: blogConfig.subtitle || blogConfig.description,
	link: blogConfig.url,
	feed: new URL('/atom.xml', blogConfig.url).toString(),
	icon: blogConfig.favicon,
	avatar: blogConfig.author.avatar,
	archs: ['Nuxt', 'Vercel'],
	date: blogConfig.timeEstablished,
	comment: '这是我自己',
}

export default blogConfig
