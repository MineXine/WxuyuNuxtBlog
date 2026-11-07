---
title: 3.5 二进制骨架格式速查
description: 解析 .skel 时最容易踩的坑：字节序、文件头字段顺序、动画时间轴与蒙皮变形。
date: 2026-10-31 09:20:00
updated: 2026-10-31 09:20:00
image: /wiki/cover-spine-binary.svg
categories: [模型图鉴]
tags: [Spine, 二进制, 文档]
type: wiki
---

## 字节序

Spine 3.5 的二进制由 libgdx 的 `DataOutput` 写出，因此 **float / int / short 全部是大端**，只有长度和索引是 varint（7 位一组、低位优先）。

::: tip
按小端读会出现「骨骼数量正常、但坐标变成 1e25」的现象——数组长度是对的，浮点数全错。
:::

## 文件头

```text
hash:          string（长度前缀 + UTF-8）
version:       string（如 3.5.51）
width, height: float32 × 2
nonessential:  bool
  └ fps:       float32
  └ images:    string
```

紧随其后依次是：`bones → slots → ik → transform → path → defaultSkin → 额外皮肤 → events → animations`。

## 骨骼

每条骨骼读取：`name, parentIndex(可无), rotation, x, y, scaleX, scaleY, shearX, shearY, length, transform(可无)`。

注意 `parentIndex` 只有根骨骼没有，读取时必须先判断是否还有字节。

## 动画时间轴

一个动画内按顺序包含：`slots → bones → ik → transform → path → deform → drawOrder → events`。

- **rotate / translate**：`帧数 + [时间, 角度/坐标...]`
- **scale**：`帧数 + [时间, x, y]`
- **deform**：`帧数 + [时间, 顶点数, 顶点...]`，其中「顶点数」为 0 表示该帧没有关键帧，读取端应回落到原值

## 排错清单

1. **坐标为天文数字** → 字节序反了
2. **动作列表数量对、播放异常** → 时间轴某个循环提前结束
3. **网格撕开** → deform 的帧结构读错，通常是漏了「无关键帧」分支
4. **贴图错位** → 图集页名匹配失败，检查 `.atlas` 首页名与实际文件名是否一致
