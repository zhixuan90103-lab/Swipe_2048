# Swipe_2048 — 现行实现

日期：2026-09-01（设置入口、原版顶栏对齐、`boardY` 20 后修订）。

手势状态机细节：`docs/SWIPE-DESIGN.md`。检索结论：`docs/SWIPE-RESEARCH-2026-09.md`。来源分级：`docs/SWIPE-SOURCES.md`。

---

## 1. 产品

TypeScript + Three.js WebGPU + Vite + Capacitor iOS。设计空间 **390×844**。Bundle ID `com.wangzhixuan.swipe2048`。Dev `http://127.0.0.1:5204/`。

| 模式 | 规则 | 默认手感 |
|------|------|----------|
| **2048**（`merge`） | 标准 4×4 合并；仅 `moved` 才出新块 | **手感2 甩动** |
| **单块**（`solo`） | 同一 4×4，一颗块滑到墙；动画恒速 | **手感1 距离** |

输入：手写 **Pan → 离散四向**。滑距 ≠ 停点。不用系统 UISwipe。

UI 对齐中文原版 2048 画面（`docs/UI-ORIGINAL.md`）。  
**黄块**切 2048/单块；**菜单**新局；**设置**打开手感面板。无底部「手感」按钮。

底座硬约定见 `AGENTS.md`（`base: './'`、Safe Area 只走 CSS、UI 只挂 `#ui-root`、无 WebGPU 失败）。

---

## 2. 操作原理（两层）

**认方向**（两套相同）→ **出不出手**（两套不同）。

1. **死区 `slopPx`**：防按下抖动。小于此值不当滑。  
2. **段位移认横竖**：从本段原点到当前点。主轴 ≥ 副轴 × `axisRatio` 才锁轴。太斜：**等，不清段**。出手前副轴明显更强可 relock。  
3. **出手清段**（`setTranslation(0)`）：原点跳到当前点。按住可转向。斜尾不带进下一手。  
4. 方向看 **整段位移**，不用轨迹 LERP、不用瞬时速度、不用 coalesced。

| | 手感1 距离 | 手感2 甩动 |
|--|--|--|
| 用户 | 慢划、想清楚 | 不要慢划误触 |
| 出手 | 沿已锁轴 ≥ `commitPx` | 沿轴 ≥ `commitPx` **且** 轴上 80ms 窗速度 ≥ `speedPxS` |
| 速度 | 不参与 | 窗净位移/时间，只看锁轴 |
| 慢但方向清楚 | 距离够就走 | **不走棋**（方向仍可已锁） |
| 按住 | 可转向；`sameDirRepeat` 可连走 | **每次按下只一步** |

`pointercancel` 不断按住。busy 时不判定。全屏 window pointer。

测试：`npm test`（`swipeSegment` + `swipeVelocity`）。

---

## 3. 文件

| 文件 | 职责 |
|------|------|
| `src/game/swipeSegment.ts` | `evaluateSegment` / `dirFromDelta` / 抬手 invalid 谓词 |
| `src/game/swipeVelocity.ts` | 80ms 速度窗 |
| `src/game/swipeInput.ts` | Pointer、capture、cancel、缩放、`applyDecision` |
| `src/game/feel.ts` | 旋钮、两套默认、按模式存储 |
| `src/game/feelPanel.ts` | `#feel-panel` |
| `src/game/game2048.ts` | 模式、HUD、busy、手感绑定 |
| `src/game/board.ts` | `SIZE=4` 合并 |
| `src/game/solo.ts` | 单块 |
| `src/game/view.ts` | 棋盘绘制（随 `boardScale`） |
| `src/style.css` | 原版风布局 |

---

## 4. 手感存储与默认

- 按模式：`localStorage swipe2048.feel.byMode`（`merge` / `solo`）。  
- 旧键 `swipe2048.feel` 仍写一份镜像，**首次进模式**若 byMode 无记录则用下表，不拿旧全局覆盖。

**手感1**（单块默认）`FEEL_DEFAULT`：

| 键 | 默认 | 作用 |
|----|------|------|
| scheme | 1 | 距离出手 |
| slopPx | 10 | 点按死区 / 开始锁轴 |
| commitPx | 16 | 沿锁轴出手 |
| speedPxS | 400 | 手感1 不用 |
| axisRatio | 1.55 | 主轴/副轴 |
| tileMoveMs | 60 | 每格 ms（仅单块） |
| slideMs | **75** ms/格 | 2048 按格计时，远的晚到 |
| appearMs | 200（手感2 **230**） | 新块出现 |
| mergePopMs | 120（手感2 **180**） | 合并到位轻弹 |
| inputLockMs | 10 | 动画后再锁输入 |
| rearmMs | 10 | 锁开后再等（可 0） |
| nudgePx / nudgeMs | 1 / 50 | 无效抖 |
| sameDirRepeat | false | 同向连走 |
| boardY | 20 | 棋盘上下（正下负上） |
| boardScale | 1.09 | 棋盘整体缩放（1=328px，1.09≈358 宽） |

**手感2**（2048 默认）在手感1 上改为：`scheme 2`，`commitPx 30`，`speedPxS 200`，`tileMoveMs 70`，`slideMs 75`，`appearMs 250`，`mergePopMs 200`，`inputLockMs 50`，`rearmMs 0`。

切 2048 / 单块会加载该模式上次手感。面板「恢复默认」只恢复 **当前 scheme** 的默认。切 scheme 时保留动画锁、死区、轴比、棋盘位置与大小。

`slopPx ≥ commitPx`：锁轴帧可能立刻 fire。面板不自动纠正。

---

## 5. UI

- 布局按 `docs/UI-ORIGINAL.md`：标题 **104²**，分数 **93×92**，按钮 **93×28** `#ed995b` 与分数盒左右对齐。  
- **点黄块** ↔ 2048 / 单块（字变为「2048」或「单块」）。滑动手势忽略 `#g-title`。  
- **菜单** = 新局。  
- **设置** = 打开/关闭设置表：出手手感、棋盘位置/大小；2048 **不出现**「每格用时」（滑移已写死 100ms）。  
- 说明：合并这些数字以得到2048方块！  
- 棋盘格 72、缝 8 × `boardScale`（默认 1.09）；再加 `boardY`（默认 20 往下）。  
- 结束遮罩盖在棋盘上；出现时 **800ms fade、delay 1200ms**（等滑移+pop 演完）。

## 5.2 方块动画（对齐 Cirulli）

| | 2048 | 单块 |
|--|--|--|
| 滑移 | **格数 × `slideMs`（默认 75ms/格）**，更柔 ease-out；远的晚到 | 格数 × `tileMoveMs`，**linear** |
| 新块 | 滑完立刻，`0.4 → 1`，时长 **`appearMs`（2048 默认 230）** | 同左 |
| 合并 | 新数字跟着滑；`1 → 1.1 → 1`，**`mergePopMs`（2048 默认 180）**，峰值对准滑移约 60% | — |
| 分数 | `+N` 上飘 600ms ease-in | 无 |

`tileMoveMs` 只在单块设置里出现。

## 5.1 近期相对上次规范的改动

| 项 | 现在 |
|----|------|
| 模式切换 | 只走左上黄块 |
| 手感入口 | 右上「设置」；无独立手感按钮 |
| 顶栏尺寸 | 对齐原版实测（104 / 93×92 / 93×28） |
| 按钮色 | `#ed995b` |
| `boardY` | 默认 **20** |
| `boardScale` | 默认 **1.09** |

---

## 6. 踩过的坑

| 现象 | 处理 |
|------|------|
| 点了没反应 | 设计 px × (stage宽/390)；全屏 pointer |
| 斜下当左 / 横判竖 | 段内锁轴；commit 只看 along |
| 长按斜向反轴 | **出手时** consume，不要等 settle |
| cancel 后失灵 | holding 保持；新 pointer 再 grab |
| 按住动画飞 | settle consume + reflow |
| 玩家口述当规范 | 口述是现象；像素只引 A/B |

---

## 7. 刻意不做

- Android；WebGL 回退；系统 UISwipe  
- 用速度/轨迹 LERP **判方向**  
- 手感2 做成 Hammer「必须松手才认」  
- 热路径 `new Audio()`（见 `AUDIO.md`）

```
npm run dev     # 127.0.0.1:5204
npm run test
npm run ios     # build + cap sync + 开 Xcode
```
