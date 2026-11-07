---
title: Spine 模型接入指南
description: 把一份 .skel / .atlas / 贴图接进模型图鉴的完整流程，包含目录约定与 frontmatter 字段说明。
date: 2026-10-31 09:00:00
updated: 2026-10-31 09:00:00
image: /wiki/cover-spine-model.svg
categories: [模型图鉴]
tags: [Spine, 模型, 文档]
type: wiki
---

## 前置条件

模型图鉴读取的是 **文章类型为 `model`** 的内容，因此需要：

- 一份 Spine 3.5.x 导出的骨架（`.skel` 二进制或 `.json`）
- 对应的图集文件（`.atlas`）
- 图集引用的贴图（`.png` / `.jpg` / `.webp`）

三者缺一不可，缺任何一项卡片会显示为「未拥有」。

## 目录约定

静态资源统一放在 `public/models/<模型名>/` 下，构建时会随站点一起发布：

```text
public/models/9100140-a/
├── 9100140-a.skel      # 骨架
├── 9100140-a.atlas     # 图集
├── 9100140-a.webp      # 贴图（WebP，约 PNG 的 1/4）
└── portrait.jpg        # 卡面立绘（可选）
```

## frontmatter 字段

在 `content/spine/` 下新建 Markdown，写入以下字段：

```yaml
---
title: 9100140-a · 坐姿少女
description: 一句话介绍，会显示在卡牌与列表里
date: 2026-10-30 10:00:00
categories: [武将]
type: model
ModelName: 9100140-a
ModelQuality: 金
ModelPortrait: /models/9100140-a/portrait.jpg
ModelAssets:
  ModelSkel: /models/9100140-a/9100140-a.skel
  ModelImage: /models/9100140-a/9100140-a.webp
  ModelAtlas: /models/9100140-a/9100140-a.atlas
---
```

| 字段 | 作用 |
| --- | --- |
| `ModelName` | 模型名，显示在卡牌铭牌与预览页 |
| `ModelQuality` | 品质（金 / 橙金 / 紫 / 蓝 / 绿 / 粉 / 红），决定卡框配色与排序 |
| `ModelPortrait` | 卡面立绘；缺省时回落到 `image`，再回落到离屏渲染缩略图 |
| `ModelAssets` | 骨架 / 贴图 / 图集三个静态路径 |

## 品质与分类

- **品质**由高到低：金 → 橙金 → 紫 → 蓝 → 绿 → 粉 → 红，图鉴里的圆钮按这个顺序排列。
- **分类**取 `categories[0]`，对应图鉴右侧的「武将 / 神兵 / 神兽 / 红颜 / 军师 / 战法 / 合击 / 副将 / 坐骑」，也可以自定义。
- 分类与品质都会参与筛选，两者是「与」的关系。

## 常见问题

### 卡片显示「未拥有」

说明 `ModelAssets` 三项没有填全，或路径没对上 `public` 下的真实文件。

### 预览能打开但一片空白

优先检查贴图是不是真的 PNG：有些拆包资源的后缀是 `.png`，内容却是其他格式，浏览器会加载失败。

### 动作列表是空的

多半是二进制骨架的版本不在 3.5 分支，或者解析时字节序处理有误。
