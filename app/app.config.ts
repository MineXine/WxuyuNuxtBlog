import type { Nav, NavItem } from '~/types/nav'
import { Temporal } from 'temporal-polyfill'
import blogConfig from '~~/blog.config'
import { version } from '~~/package.json'

// 图标查询：https://yesicon.app/ph?s=bold
// 图标插件：https://marketplace.visualstudio.com/items?itemName=antfu.iconify
// @keep-sorted
export default defineAppConfig({
	// 将 blog.config 中的配置项复制到 appConfig，方便调用
	...blogConfig,

	component: {
		alert: {
			/** 默认使用卡片风格还是扁平风格 */
			defaultStyle: 'card' as 'card' | 'flat',
		},

		codeblock: {
			/** 代码块触发折叠的行数 */
			triggerRows: 32,
			/** 代码块折叠后的行数 */
			collapsedRows: 16,
			/** 启用代码块缩进导航会关闭空格渲染 */
			enableIndentGuide: true,
			/** 代码块缩进导航(Indent Guige)竖线匹配空格数 */
			indent: 4,
			/** tab渲染宽度 */
			tabSize: 3,
		},

		/** 文章开头摘要 */
		excerpt: {
			animation: true,
			caret: '_',
			label: blogConfig.excerpt?.label ?? '智能摘要',
			badge: blogConfig.excerpt?.badge ?? 'Kimi·K2-Turbo',
		},

		presence: {
			/** 右侧在线状态组件轮询间隔（毫秒） */
			refreshInterval: 15000,
		},

		/** 精选文章 Slide */
		slide: {
			/** 适合封面图无字时启用 */
			showTitle: true,
		},

		stats: {
			/** 归档页面每年标题对应的年龄 */
			birthYear: 2006,
			/** blog-stats widget 的预置文本 */
			wordCount: '约10万',
		},

      sidebar: {
         show: 'left' as 'top' | 'left',
      }
	},

	// @keep-sorted
	footer: {
		/** 页脚版权信息，支持 <br> 换行等 HTML 标签 */
		copyright: `© ${Temporal.Now.plainDateISO().year.toString()} ${blogConfig.author.name}`,
		/** 侧边栏底部装饰图片配置 */
		// decorativeImage: {
		//	url: 'https://blog-files.101045700.xyz/MaitetsuVideoFix/Home.webp', // 装饰图 URL，为空则不显示
		//	opacity: 0.6, // 透明度（0~1），越小越淡
		//	height: '12rem', // 装饰层高度
		//	backgroundSize: 'cover', // 背景拉伸方式
		//	backgroundPosition: 'center', // 背景定位
		//	backgroundRepeat: 'no-repeat', // 背景是否重复
		// },
		/** 侧边栏底部图标导航 */
		iconNav: [
			{ icon: 'ph:house-bold', text: '个人主页', url: blogConfig.author.homepage },
			// { icon: 'ri:qq-line', text: '交流群: 169994096', url: 'https://jq.qq.com/?_wv=1027&k=lQfNSeEd' },
			// { icon: 'ph:github-logo-bold', text: 'GitHub: L33Z22L11', url: 'https://github.com/L33Z22L11' },
			{ icon: 'ph:rss-simple-bold', text: 'Atom订阅', url: '/atom.xml' },
			{ icon: 'ph:subway-bold', text: '开往', url: 'https://www.travellings.cn/' },
		] satisfies NavItem[],
		/** 页脚版权信息底部的其他信息 */
		message: '',
		/** 页脚站点地图 */
		nav: [
			{
				title: '探索',
				items: [
					{ icon: 'ph:rss-simple-bold', text: 'Atom订阅', url: '/atom.xml' },
					{ icon: 'ph:subway-bold', text: '开往', url: 'https://www.travellings.cn/' },
				],
			},
			{
				title: '社交',
				items: [
					{ icon: 'ph:github-logo-bold', text: 'wxuyu', url: 'https://github.com/wxuyu' },
					// { icon: 'ri:qq-line', text: '群: 169994096', url: 'https://jq.qq.com/?_wv=1027&k=lQfNSeEd' },
					{ icon: 'ph:envelope-simple-bold', text: blogConfig.author.email, url: `mailto:${blogConfig.author.email}` },
				],
			},
			{
				title: '信息',
				items: [
					// { icon: 'simple-icons:nuxtdotjs', text: `主题: Clarity ${version}`, url: 'https://github.com/L33Z22L11/blog-v3' },
					// { icon: 'ph:swatches-bold', text: '主题和组件文档', url: '/theme' },
					{ icon: 'ph:certificate-bold', text: '萌备20251949号', url: 'https://icp.gov.moe/?keyword=20251949' },
				]
			},
		] satisfies Nav,
	},

	/** 左侧栏顶部 Logo */
	header: {
		logo: '/image/SiteCover/avatar.avif',
		/** 展示标题文本，否则展示纯 Logo */
		showTitle: true,
		subtitle: blogConfig.subtitle,
	},

	/** 友链页面 */
	link: {
		/** 无订阅源展示静音图标 */
		remindNoFeed: true,
		/** 友链分组内随机排序 */
		randomInGroup: true,
      /** 友链朋友圈API */
      CircleApi: 'https://circle.wxuyu.top',
      CircleEndTotal: 20,
	},

  essay: {
    API: {
      ISPEAK: 'https://ispeak.api.wxuyu.top/',
      MEMOS: '',
    },
    CONFIG: {
      ISPEAK_CONFIG: {
        author: '69d21e1f84a9d355ffe37d55',
        error_image: 'https://lib.bsgun.cn/Hexo-static/img/avatar.256.avif'
      },
      LOCAL_ESSAY: {
        page_size: 10
      },
    },
    TYPE: 'local',
  },

  hotGetConfig: {
    Api: 'https://hot-api.liiiu.cn',
    /** 卡片布局：'grid' 竖向卡片 / 'row' 横向单列 */
    layout: 'row' as 'grid' | 'row',
    /**
     * 「首条单栏大卡 + 其余两栏卡片」布局总开关
     *
     * - true 时忽略上面的 layout，强制使用 featured 布局
     * - 组件 props.featured 传布尔值可单独覆盖此全局开关
     * - 页面级设置（pages/hot.vue 的 pageFeaturedLayout）优先于此处
     */
    featuredLayout: true,
    timeout: 200,
    RefreshInterval: 5 * 60 * 1000,
  },

	/** 左侧栏导航 */
	nav: [
		{
			title: '',
			items: [
				{ icon: 'ph:files-bold', text: '丹青妙笔', url: '/'},
        {
          icon: 'ph:feather-bold',
          text: '笔墨之连',
          url: '#',
          children: [
            { icon: 'ph:archive-bold', text: '经卷藏珍', url: '/archive'},
            { icon: 'ph:signature', text: '云篆星徽', url: '/tags' },
					],
        },
        {
          icon: 'ph:link-bold',
          text: '好友之结',
          url: '#',
          children: [
            { icon: 'ph:link-bold', text: '竹林旧友', url: '/link'},
            { icon: 'ph:fish-bold', text: '塘文集锦', url: '/circle' },
					],
        },
        {
          icon: 'ph:function-bold',
          text: '功能集合',
          url: '#',
          children: [
            { icon: 'i-mingcute:bilibili-line', text: '追更历史', url: '/banguim' },
            { icon: 'ph:star-of-david-bold', text:'优良精装', url:'/equipment'},
            { icon: 'ph:steam-logo-bold', text: '游戏时刻', url: '/steam'},
            { icon: 'ph:lightning-bold', text:'闲言碎语', url:'/memos' },
            { icon: 'bxs:hot', text:'热搜', url:'/hot'},
            // { icon: 'ph:cube-bold', text:'模型预览', url:'/spine'},
            // { icon: 'ph:books-bold', text:'文档', url:'/wiki'}
					],
        },
        // { icon: 'ph:chats-bold', text:'​纸笺寄语', url:'/comments' },
				// { icon: 'ph:aperture-bold', text:'探索发现', url:'/discovery'},
				{ icon: 'ph:apple-podcasts-logo-bold', text:'关于自己', url:'/about' },
			],
		},
	] satisfies Nav,

	pagination: {
		perPage: 10,
		/** 默认排序方式，需要是 this.article.order 中的键名 */
		sortOrder: 'date' as keyof typeof blogConfig.article.order,
		/** 允许（普通/预览/归档）文章列表正序，开启后排序方式左侧图标可切换顺序 */
		allowAscending: false,
	},

	themes: {
		light: {
			icon: 'ph:sun-bold',
			tip: '浅色模式',
		},
		system: {
			icon: 'ph:monitor-bold',
			tip: '跟随系统',
		},
		dark: {
			icon: 'ph:moon-bold',
			tip: '深色模式',
		},
	},

	/**
	 * Memos 碎碎念组件默认配置
	 *
	 * 优先级：组件 props > 此处 appConfig.memos > 组件内置默认值
	 *
	 * @see app/components/memos/MemosTimeline.vue
	 */
	memos: {
		/**
		 * Memos 实例地址（不含末尾斜杠）
		 * 留空则使用 runtimeConfig（环境变量 MEMOS_URL），再默认回退到公共实例
		 */
		memos: '',
		/** Memos 用户名（走 CEL filter: creator == "users/{username}"） */
		username: '',
		/** 每页条数 */
		limit: 10,
		/** 布局模式：'list' 单列 | 'masonry' 瀑布流 */
		layout: 'list' as 'list' | 'masonry',
		/**
		 * 访问令牌（评论 / 喜欢 / 非喜欢 / 收藏需要）
		 * 留空则使用 runtimeConfig（环境变量 MEMOS_TOKEN）；两者都为空时前台只读
		 */
		token: '',
		/** 页面横幅封面图 */
		cover: '/image/PageCover/moment.avif',
		/** 列表头像（留空则用站点作者头像；建议填 48px 小图，避免加载原图） */
		avatar: '/image/SiteCover/avatar_48.avif',
		/** 横幅主标题，留空则取站点作者名 */
		heroTitle: '',
		/** 横幅副标题，留空则取站点签名 */
		heroDesc: '',
	},
})
