---
title: MDC 预览测试 - 36 个组件全演示
date: 2026-07-25
tags: [test, preview, mdc]
---

# MDC 预览测试

打开本文即在 Obsidian 实时渲染所有 MDC 组件，无须启动 Nuxt dev server。

## ::alert 五种类型

::alert{type=tip}
这是 tip 提醒类型。
::

::alert{type=info}
info 信息类型
::

::alert{type=question}
question 问题类型
::

::alert{type=warning}
warning 警告类型
::

::alert{type=error}
error 错误类型
::

::alert{type=tip card}
带 card 样式的提醒
::

## ::tab 交互式

::tab{:tabs='["源代码", "预览效果", "配置项"]'}
#tab1

```ts
const x = 1
```

#tab2

渲染后的样子。

#tab3

```yaml
mode: preview
```

::

::tab{:tabs='["设计稿", "实现"]' combobox=true}
#tab1

**第一步** — 草图

#tab2

**第二步** — 写代码

::

## ::pic 图片

::pic{src="https://picsum.photos/600/300" alt="测试图" caption="这是 caption"}
::

## ::link-card 链接卡片

::link-card{link="https://nuxt.com" title="Nuxt 官方" description="Vue 全栈框架"}
::

::link-card{link="https://obsidian.md" title="Obsidian" description="知识库工具" icon="https://obsidian.md/favicon.ico"}
::

## ::link-banner 链接横幅

::link-banner{banner="https://picsum.photos/800/200" title="横幅标题" description="横幅描述文字" link="https://example.com"}
::

## ::badge 徽章

使用 :badge[Vue 3]{text="Vue 3" round=true} 配合 :badge[TypeScript]{text="TypeScript"} 干活

## ::blur 模糊（鼠标悬停取消）

::blur{text="这段文字默认模糊显示，鼠标移上去会清晰"}
::

## ::tip 提示

::tip{text="悬停查看" tip="这是提示内容"}
::

## ::key 键盘快捷键

按 :key{text=Ctrl} + :key{text=S} 保存，按 :key{text=Cmd} + :key{text=Shift} + :key{text=P} 预览

## ::copy 代码块带复制按钮

::copy{lang=typescript code="export const hello = (name: string) => `Hello ${name}`"}
::

## ::folding 折叠

::folding{title="点击展开更多"}
里面是被折叠的内容。

可写 **markdown**。
::

## ::video-embed 嵌入

::video-embed{type="youtube" id="dQw4w9WgXcQ" ratio="16/9"}
::

## ::timeline 时间线

::timeline
- 2025/01/01: 新年第一天
- 2025/06/15: 项目上线
- 2025/12/31: 年度总结
::

## ::emoji-clock 表情时钟

::emoji-clock
::

## ::music 音乐播放器

::music{url="https://example.com/song.mp3" name="示例歌曲" artist="示例艺术家"}
::
## 1
## ::music-score 乐谱

::music-score{abc="X:1\nT:Twinkle\nM:4/4\nK:C\nC C G G | A A G2 |"}
::

## ::poetry 诗词

::poetry{title="静夜思" author="李白"}
床前明月光，
疑是地上霜。
举头望明月，
低头思故乡。
::

## ::quote 引用

::quote{icon=true}
生活不止眼前的苟且，还有诗和远方。
::

## ::hero 系列（占位）

::hero
::

::hero-special
::

::hero-story
::

::hero-reson-mecha
::

## ::feed 系列

::feed-card
::

::feed-group
这里是 feed group 内容
::

## ::card-list

::card-list
::

## ::project-group

::project-group
::

## ::series-group

::series-group
::

## ::info-card

::info-card
这是一张信息卡片
::

## ::chat 对话

::chat
::Alice 早上好！
::Bob 早上好，今天去哪儿？
::Alice 公园怎么样？
::

## ::prose 系列（已并入 Obsidian 内置）

::prose-a{href="https://nuxt.com"}
Nuxt 官方链接
::

---

✅ **全部 36 个组件渲染完毕**
---

## ::equipment-item 装备卡片（独立组件）

::equipment-item{name="天选4"}
::

::equipment-item{name="iPhone XR" category="外设" show-comment="false"}
::

::equipment-item{name="不存在的设备"}
::
