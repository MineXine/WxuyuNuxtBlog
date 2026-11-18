export interface item {
	name: string
	/** 品牌信息（卡片左下「设备品牌图片显示区域」） */
	brand?: {
		/** 品牌名 */
		name?: string
		/** 品牌 Logo 图片地址（优先于 iconfont 图标） */
		logo?: string
		/** 品牌 iconfont 类名，如 icon-ASUS */
		icon?: string
	}
	categroy: '硬件' | '外设'
	/** 分类配色（不填则按分类取默认值） */
	categroy_color?: string
	desc: string
	info?: Record<string, string>
	brand_hardware?: {
		CPU: 'INTEL' | 'AMD' | 'Apple'
		GPU: 'NVIDIA' | 'AMD' | 'Intel' | 'Apple'
	}
	/** 标签：数组或对象两种写法都支持 */
	tag?: string[] | Record<string, string>
	image?: string
	date?: string
	src?: string
	money?: number
}
