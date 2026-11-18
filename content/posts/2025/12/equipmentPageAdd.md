---
title: 添加装备页面
description: 该博客持续维护Nuxt框架博客系统，新增装备页面实现硬件/外设分类展示，支持动态过滤、标签筛选与规格参数渲染，通过TypeScript定义数据接口，结合Vue3响应式布局与SCSS响应式设计，完成设备卡片动态加载、悬停动效及跨端适配优化，集成评论跳转与购买信息展示功能。
date: 2025-12-03 10:05:09
updated: 2025-12-03 20:49:09
image: /image/PostCover/equipmentPage.avif
categories: [站点魔改]
tags: [Nuxt, 魔改, 美化]
recommend: 7
---

## 功能解析
- 通过`equipment.categroy`的指定内容进行计算，而后映射出颜色与图标，无需通过写死分类来进行切换
- 通过`equipment.info`中进行自定义芯片、内存、显卡等等字段进行显示
- 通过`equipment.tag`中的自定义标签进行显示出装备所属标签

## 目录结构
- `/app/pages/equipment.vue`：装备页面主界面，只负责分类切换、列表渲染与评论跳转
- `/app/components/equipment/EquipmentCard.vue`：**独立设备卡片组件**，卡片样式、品牌图标与响应式版式全部内置，可脱离页面单独调用
- `/app/components/content/EquipmentItem.vue`：卡片在文章 / 文档中的 MDC 调用入口（`::equipment-item`）
- `/app/equipment.ts`：追更页面全局数据类型，本身作为数据加载以及页面引用（模块来源于喵落阁）
- `/app/types/equipment.ts`：设备数据结构定义（含品牌与硬件标识）

## 核心代码

### 主界面渲染

页面只做「分类切换 + 列表渲染」，卡片本体交给独立组件：

``` vue [equipment.vue] lang="vue"
<script lang="ts" setup>
import { computed, ref } from 'vue'
import { equipment } from '~/equipment'
import { useLayoutStore } from '~/stores/layout'

/** 去除描述中的 HTML 标签（评论引用用） */
const HTML_TAG_RE = /<[^>]+>/g

const layoutStore = useLayoutStore()
layoutStore.setAside(['blog-stats', 'blog-tech', 'blog-site-info', 'blog-archive', 'blog-log'])

useSeoMeta({
  title: '我的装备',
})

// 新增状态管理
const activeCategory = ref('硬件')

// 计算属性过滤设备
const filteredEquipment = computed(() =>
	equipment.filter(item => item.categroy === activeCategory.value),
)

function handleTabClick(category: string) {
	activeCategory.value = category
}

function goComment(content: string) {
	const textarea = document.querySelector('.atk-textarea') as HTMLTextAreaElement
	if (textarea) {
		textarea.value = `> ${content.replace(HTML_TAG_RE, '')}\n\n`
		textarea.focus()
		textarea.scrollIntoView({ behavior: 'smooth', block: 'center' })
	}
}

const getCategoryCount = computed(() => (category: string) => {
	return equipment.filter(item => item.categroy === category).length
})
</script>

<template>
  <div id="icat-equipment">
    <div class="equipment-category">
      <!-- 顶部导航栏 -->
      <div class="categories-tabs">
        <div class="tabs-container">
          <div
            v-for="category in ['硬件','外设']"
            :key="category"
            class="category-tab"
            :class="{ active: activeCategory === category }"
            @click="handleTabClick(category)"
            :style="{'--tab-color': category === '硬件' ? '#3af' : category === '外设' ? '#3ba': '' }"
          >
            <icon :name="category === '硬件' ? 'ph-laptop-bold' : (category === '外设' ? 'ph-package-bold' : '')" ></icon>
            <span>{{ category }}</span>
            <span>{{ getCategoryCount(category) }}</span>
          </div>
        </div>
      </div>
      <!-- 设备展示区：卡片为独立组件 -->
      <div class="equipment-list">
        <EquipmentCard
          v-for="(item, index) in filteredEquipment"
          :key="item.name + index"
          :item="item"
          @comment="goComment"
        />
      </div>
    </div>
  </div>
  <PostComment key="/equipment" />
</template>
```

### 独立调用组件

卡片已抽离为独立组件 `EquipmentCard`，样式、图标与响应式版式全部内置，页面样式里不再重复一份。

**方式一：在页面 / 组件中直接使用**

``` vue
<EquipmentCard
  :item="device"
  :show-category="true"
  :show-brand="true"
  :show-actions="true"
  :show-comment="true"
  @comment="desc => writeToCommentBox(desc)"
/>
```

| 属性 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `item` | `item` | 必填 | 设备数据 |
| `showCategory` | `boolean` | `true` | 是否显示分类徽标 |
| `showBrand` | `boolean` | `true` | 是否显示品牌区（Logo / 图标 / 首字） |
| `showActions` | `boolean` | `true` | 是否显示底部操作区（详情 / 评论） |
| `showComment` | `boolean` | `true` | 是否显示快速评论按钮 |
| `categoryColor` | `string` | 按分类取色 | 分类徽标颜色覆盖 |
| `fallbackText` | `string` | 设备名 | 图片缺失时的占位文字 |

事件：`@comment` —— 点击评论按钮时抛出设备描述，由外部决定写入评论框或做别的处理。

**方式二：在文章 / 文档里用 MDC 调用**

配合 `app/components/content/EquipmentItem.vue`，正文里直接写即可：

``` md
::equipment-item{name="天选4"}
::

::equipment-item{name="iPhone XR" category="外设" show-comment="false"}
::
```

- `name`：设备名（对应 `app/equipment.ts` 中的 `name`）
- `category`：设备名重名时用于消歧（如 硬件 / 外设）
- `show-comment` / `show-category` / `show-brand` / `show-actions`：显隐开关
- 找不到设备时渲染为虚线占位提示，不会报错

> MDC 传入的属性都是字符串，因此组件内部会把 `"false"` 这类字符串统一转成真正的布尔值。

### 全局数据类型及数据存储库
``` ts lang="ts" [equipment.ts]
export interface item {
  name: string
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
export type manufacturers = {
  cpu_info: 'AMD' | 'INTEL'
  memory_info: 'LPDDR5' | 'LPDDR4' | 'LPDDR3'
  graphics_card_info: 'AMD' | 'NVIDA'
  ssd_info: 'SSD' | 'NVME SSD'
}
export const equipment: item[] = [
  {
    name: "天选4",
    image: "/assets/img/equipment/tianxuan.svg",
    src: "https://www.myxz.top",
    categroy: '硬件',
    desc: "测试测试",
    info: {
      芯片: "AMD Ryzen™ 5 7640HS",
      内存: "16G LPDDR5 4800MHz",
      显卡: "NVIDIA® GeForce RTX™ 4050",
      存储: "512G PCIE4 SSD",
      机器版本: "锐龙版",
      机器颜色: "Mecha"
    },
    tag: ['轻薄本', 'AMD'],
    date: "2023-09-01",
    money: 2344,
  }, {
    name: "iPhone XR",
    image: "https://s11.ax1x.com/2023/06/07/pCiB3vD.jpg",
    src: "https://www.myxz.top",
    categroy: '外设',
    desc: "测试测试",
    info: {
      芯片: "Ryzen™ 5 7640HS",
      内存: "Ryzen™ 5 7640HS",
      显卡: "Ryzen™ 5 7640HS",
      存储: "Ryzen™ 5 7640HS",
    },
    tag: ['轻薄本', 'AMD'],
    date: "2023-09-01",
    money: 2344,
  }, {
    name: "iPhone XR",
    image: "https://s11.ax1x.com/2023/06/07/pCiB3vD.jpg",
    src: "https://www.myxz.top",
    categroy: '硬件',
    desc: "测试测试",
    info: {
      芯片: "Ryzen™ 5 7640HS",
      内存: "Ryzen™ 5 7640HS",
      显卡: "Ryzen™ 5 7640HS",
      存储: "Ryzen™ 5 7640HS",
    },
    tag: ['轻薄本', 'AMD'],
    date: "2023-09-01",
    money: 2344,
  }
]
```