# 棋盘运动设计

日期：2026-09-01。  
本页是 **方块怎么动** 的规范。手势判定仍以 [SWIPE-DESIGN.md](./SWIPE-DESIGN.md) 为准；出手默认值、设置项以 [IMPLEMENTATION.md](./IMPLEMENTATION.md) 为准。

对照来源：中文原版 2048 录屏与截图（非 Cirulli 网页的「全员同时长 + 源块淡出」）。

---

## 关键决策

1. **统一速度 + 整段一条曲线**  
   时长 = 格数 × 每格毫秒。每一块从起点一次 tween 到终点，ease 作用在整段上，不是一格一段。走 3 格的比走 2 格的晚到。

2. **合并：新数字跟着滑**  
   不画两块旧数字、不淡出。合成值从 **走得更远的那块** 的起点滑到会合格。

3. **合并弹不低于 1**  
   `1 → 1.1 → 1`。峰值对准 **该块自己路程的约 60%**，不等最远块走完。

4. **新块等最远块到位**  
   `0.4 → 1`，无过冲。delay = 本步最长滑移。

5. **字号按位数**  
   1 位与 2 位同样大；3 位、4 位再缩小（原版截图字高）。

6. **热路径对象池**  
   棋盘块与分数 `+N` 复用 DOM，不每步 create/destroy。

7. **时长可调，模型不可调**  
   设置只拧毫秒和曲线档；不要改回「整盘同一时长」。

---

## 滑移模型

```
duration(tile) = max(1, |Δx| + |Δy|) × msPerCell
transform: start → end，一次 CSS transition
```

| 模式 | msPerCell | 曲线 |
|------|-----------|------|
| 2048 | `feel.slideMs`（默认 **75**） | `feel.slideEase`：更柔 / 先快后慢 / 匀速 |
| 单块 | `feel.tileMoveMs`（默认 60） | **linear** |

更柔 CSS：`cubic-bezier(0.39, 0.575, 0.565, 1)`（正弦 ease-out）。

输入锁等到 **本步最长** `duration` + `inputLockMs`。新块 appear 的 delay 也用这个最长值。

---

## 合并

对 `mergedFrom`：

- 取 `previous` 到目标格距离最大的源块为起点。  
- 只生成 **一个** 合成块（新数字、新颜色）。  
- 若路程 > 0，按上表滑移。  
- `mergePopMs === 0`：不弹。  
- 否则 delay = `max(0, round(ownMs × 0.6) − round(mergePopMs × 0.28))`，keyframes 在 28% 到 1.1。

---

## 出现

无 `previous` 且本步 `animate`：class `g-tile-new`。  
`scale 0.4 → 1` + opacity，时长 `appearMs`（2048 默认 **250**），`ease`，delay = 最长滑移。

---

## 字号（格 72px，再 × `boardScale`）

| 位数 | 值 | font-size |
|------|----|-----------|
| 1–2 | 2–64 | **37** |
| 3 | 128–512 | **30** |
| 4+ | 1024+ | **24** |

---

## DOM 池

`.g-tiles` 首次预创建 16 个 `.g-tile > .g-tile-inner`。  
每步：busy 标记、改样式、闲置 `visibility:hidden`。复用时去掉 class 再 `offsetWidth` 再挂上，以便 CSS animation 重播。  
分数 `+N` 同样小池。

---

## 设置里对应的项（2048）

| 面板 | 键 |
|------|----|
| 每格滑移 | `slideMs` |
| 滑移曲线 | `slideEase` |
| 出现时长 | `appearMs` |
| 合并弹时长 | `mergePopMs` |

单块只显示「每格用时」`tileMoveMs`，以及共用的出现时长。

---

## 刻意不做

- 整盘固定时长（远的块会变快、同时到边）  
- 合并源块淡出 / 从 scale 0 弹  
- 合并 scale < 1  
- 出现过冲 > 1  
- 用速度/轨迹 LERP 判方向（仍归手势层）
