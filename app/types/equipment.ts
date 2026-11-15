export interface item {
  name: string
  /** 品牌信息（卡片左下「设备品牌图片显示区域」） */
  brand?: {
    /** 品牌名 */
    name?: string
    /** 品牌 Logo 图片地址 */
    logo?: string
  }
  categroy: '硬件' | '外设'
  categroy_color?: '#3af;' | '#3ba;'
  desc: string
  info?: Record<string, string>
  厂商?: Record<string, string>
  tag?: string[]
  image?: string
  date?: string
  src?: string
  money?: number
}