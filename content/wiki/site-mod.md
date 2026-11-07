---
title: 站点魔改速查
description: 导航、侧栏、页脚这些「一改就乱」的地方分别在哪里配置，以及改动后怎么自测。
date: 2026-10-31 09:40:00
updated: 2026-10-31 09:40:00
image: /wiki/cover-site-mod.svg
categories: [站点魔改]
tags: [Nuxt, 配置, 文档]
type: wiki
---

## 配置入口

| 想改什么 | 改哪里 |
| --- | --- |
| 站点标题 / 副标题 / 作者 | `blog.config.ts` 顶部的 `basicConfig` |
| 导航菜单、图标 | `app/app.config.ts` 的 `menu` |
| 文章分类图标与配色 | `blog.config.ts` 的 `article.categories` |
| 文章类型与版式 | `blog.config.ts` 的 `article.types` |
| 右侧小组件 | 页面里调用 `useLayoutStore().setAside([...])` |

## 新增一个页面

1. 在 `app/pages` 下新建 `.vue`（文件名即路由）
2. 需要出现在导航里，就往 `app/app.config.ts` 的 `menu` 里加一项：

```ts
{ icon: 'ph:books-bold', text: '文档', url: '/wiki' }
```

3. 需要静态生成，再加一条 route rule：

```ts
'/wiki': { prerender: true },
'/wiki/**': { prerender: true },
```

## 改动后怎么自测

- `pnpm dev` 下先看控制台有没有 hydration mismatch
- `npx nuxt generate` 跑一遍，检查 `.output/public/<路由>/index.html` 里是不是已有内容
- ESLint / Stylelint 过一遍，样式属性顺序问题会自动被 stylelint 修掉

::: warning
本项目使用原生 SCSS，不要引入 Tailwind；颜色一律走 `--c-*` 变量，否则暗色模式会失效。
:::
