# Swipe_2048 — 现行实现

日期：**2026-09-03**。默认值以 `src/game/feel.ts` 的 `FEEL_DEFAULT` / `FEEL2_DEFAULT` 为准。音效以 [AUDIO.md](./AUDIO.md) 为准。手感回路（结束层 / 斜滑 / 慢滑 / 打断）以 [FEEL-LOOP.md](./FEEL-LOOP.md) 为准。

| 规范 | 文件 |
|------|------|
| 手势判定 | [SWIPE-DESIGN.md](./SWIPE-DESIGN.md) |
| 方块怎么动 | [MOTION.md](./MOTION.md) |
| 默认值 / UI / 模式 | **本文** |
| 文档索引 | [README.md](./README.md) |

代码与文档冲突时改其中一侧，不要并列两套默认。本地存过手感时，面板点 **恢复默认** 才回到下表。

---

## 1. 产品

TypeScript + Three.js WebGPU + Vite + Capacitor iOS。设计空间 **390×844**。`appId` `com.wangzhixuan.swipe2048`。Dev `http://127.0.0.1:5204/`。

| 模式 | 规则 | 默认手感 |
|------|------|----------|
| **2048**（`merge`） | 4×4 合并；仅 `moved` 才出新块 | **手感2 甩动** |
| **涂色**（`solo`） | 7×9 涂色迷宫，滑到墙 | **手感1 距离** |

输入：手写 **Pan → 离散四向**。滑距 ≠ 停点。不用系统 UISwipe。

UI 对齐中文原版 2048（[UI-ORIGINAL.md](./UI-ORIGINAL.md)）。  
**黄块**切模式；**菜单**新局；**设置**开手感面板。

底座约定见根目录 `AGENTS.md`。

---

## 2. 操作（认方向 vs 出不出手）

两套手感 **认方向相同**，**出不出手不同**。

1. **死区 `slopPx`**：小于此值不当滑。  
2. **段位移认横竖**：主轴 ≥ 副轴 × `axisRatio` 才锁轴。太斜：等，不清段。  
3. **出手清段**：原点跳到当前点，按住可转向。  
4. 方向看 **整段位移**，不用轨迹 LERP、不用速度判向。  
5. **2048 斜滑分叉（感知不到的纠偏）**：仅 **未锁轴** 且偏角约 **40°–45°**（两轴都 ≥ `commit`，副/主 ≥ tan40°）。只读 `canMove`：两向里 **只有一向能走** 则走那向（手感2 还要该轴窗速度够）；两向都能走则不出手；两向都不能走则按较长轴 nudge。已锁轴（含日常拇指偏角）不改判。涂色盘、键盘不开。

| | 手感1 距离 | 手感2 甩动 |
|--|--|--|
| 默认模式 | 单块 | 2048 |
| 出手 | 沿锁轴 ≥ `commitPx` | 沿轴 ≥ `commitPx` **且** 轴上 80ms 窗速度 ≥ `speedPxS` |
| 慢但方向清楚 | 距离够就走 | **不走棋**。本按下一旦出现「距离已够、速度不够」即锁成慢滑，之后再加速或快抬手也不走。抬手揭指不写入速度窗，且忽略抬手前 32ms。 |
| 按住 | 可转向；`sameDirRepeat` 可连走 | **每次按下只一步** |

`pointercancel` 不断按住。全屏 window pointer。**走棋不等动画**：`busy` 不挡下一手；清段只在出手/抬手。画面打断时从当前 transform 接到新格。仅 `state.over` 挡 2048 输入。

底边系统手势：原生 `preferredScreenEdgesDeferringSystemGestures = .bottom`。底缘按下不走棋。本按下已走棋且未抬手、800ms 内进后台 → **撤回该步**。

测试：`npm test`（`swipeSegment` + `swipeVelocity` + `motion` + `hapticFeel` + `audioBatcher` + `amaze`）。

---

## 3. 文件

| 文件 | 职责 |
|------|------|
| `src/game/swipeSegment.ts` | 段判定纯函数 |
| `src/game/swipeVelocity.ts` | 80ms 速度窗 |
| `src/game/swipeInput.ts` | Pointer、后台撤回、底缘 |
| `src/game/feel.ts` | 旋钮与两套默认 |
| `src/game/feelPanel.ts` | 设置表 |
| `src/game/game2048.ts` | 模式、HUD、走棋 |
| `src/game/overlay.ts` | 结束层 DOM / show-hide |
| `src/game/board.ts` | 4×4 合并 |
| `src/game/amaze.ts` · `amazeView.ts` | 涂色盘逻辑与绘制 |
| `src/game/solo.ts` | 旧单块（现未作为默认 solo） |
| `src/game/motion.ts` | 滑移/合并/字号纯函数 |
| `src/game/tilePool.ts` | 棋盘 DOM 池 |
| `src/game/view.ts` | 画到池里 |
| `src/style.css` | 布局 + appear/pop/nudge |
| `src/audio/*` · `src/utils/gameSfx.ts` | 音效（见 [AUDIO.md](./AUDIO.md)） |
| `src/game/hapticFeel.ts` · `src/utils/gameHaptics.ts` | 玩法震动（见 [HAPTICS-GAME.md](./HAPTICS-GAME.md)） |

---

## 4. 手感默认（现行）

存储：`localStorage swipe2048.feel.byMode`（`merge` / `solo`）。旧键 `swipe2048.feel` 只作镜像；某模式首次进入用下表，不拿旧全局覆盖。

切模式加载该模式上次手感。「恢复默认」只恢复 **当前 scheme**。切 scheme 时保留死区、轴比、动画锁、棋盘位置与大小。

`slopPx ≥ commitPx`：锁轴帧可能立刻 fire。面板不自动纠正。

### 手感1（单块默认）`FEEL_DEFAULT`

| 键 | 默认 | 作用 |
|----|------|------|
| scheme | 1 | 距离出手 |
| slopPx | 10 | 点按死区 |
| commitPx | 16 | 沿锁轴出手 |
| speedPxS | 400 | 本套不用 |
| axisRatio | 1.55 | 主轴/副轴 |
| tileMoveMs | 60 | 单块每格 ms |
| slideMs | **70** | 2048 每格滑移 |
| slideEase | **soft** | 更柔 / 先快后慢 / 匀速 |
| appearMs | 200 | 新块出现 |
| mergePopMs | 120 | 合并弹 |
| inputLockMs | 10 | 动画后再锁 |
| rearmMs | 10 | 锁开后再等 |
| nudgePx / nudgeMs | **5 / 350** | 沿滑动方向回弹 |
| sameDirRepeat | false | 同向连走 |
| boardY | **0** | 棋盘上下（正下负上） |
| boardScale | **1.1** | 棋盘缩放（1 = 328px 宽） |

### 手感2（2048 默认）`FEEL2_DEFAULT`

在手感1 上只改这些：

| 键 | 值 |
|----|----|
| scheme | 2 |
| commitPx | 30 |
| speedPxS | 200 |
| tileMoveMs | 70 |
| slideMs | **65** |
| appearMs | **250** |
| mergePopMs | **200** |
| inputLockMs | **0** |
| rearmMs | 0 |

`slideEase` 仍为 **soft**。

---

## 5. UI

- 顶栏：[UI-ORIGINAL.md](./UI-ORIGINAL.md) — 标题 **104²**，分数 **93×92**，按钮 **93×28** `#ed995b` 与分数盒左右对齐。  
- **点黄块** ↔ 2048 / 单块。滑动忽略 `#g-title`。  
- **菜单** = 新局。**设置** = 手感表。  
- 棋盘格 72、缝 8 × `boardScale`（**1.1**）；`boardY` **0**。  
- 结束遮罩：800ms fade，delay 1200ms。

设置项：2048 显示每格滑移、曲线、出现、合并弹；单块显示每格用时。模型见 [MOTION.md](./MOTION.md)。

---

## 6. 方块运动（摘要）

全文：[MOTION.md](./MOTION.md)。

- 时长 = 格数 × 每格毫秒；整段一条曲线。2048 默认 **65ms/格、更柔**。  
- 合并：新数字从较远源块滑来，弹 `1 → 1.1 → 1`。  
- 新块等最远块到位再 appear（2048 默认 250ms）。  
- 无效：整盘 **沿该次滑动方向** 回弹（5px / 350ms，幅度先大后小）。  
- DOM 池：16 块 + 分数 `+N`。

---

## 7. 音效（摘要）

全文：[AUDIO.md](./AUDIO.md)。设置切 **音效1 短tick** / **音效2 长按**（默认 2）。合优先于滑；多组合并只播最高档；出手即播。合 4→档0 … 2048→档9。

---

## 8. 近期改动（相对最初底座 demo）

按主题，不是按 commit。

| 主题 | 现在 |
|------|------|
| 玩法 | 2048 + 单块；黄块切换 |
| 手势 | 段锁轴 + 两套出手（距离 / 甩动） |
| 每格滑移 | **65ms**（曾 80 → 75 → 70 → 65） |
| 滑移曲线 | `slideEase`：soft / out / linear |
| 出现 / 合并弹 | 手感2：250ms / 200ms |
| 棋盘 | `boardScale` **1.1**，`boardY` **0**（曾 1.09 / 20） |
| 无效反馈 | 沿滑动轴回弹，不是左右抖 |
| 运动代码 | `motion.ts` + `tilePool.ts` |
| HUD | 对齐原版截图；原「排行榜」= 设置 |
| 系统手势 | 推迟底边；后台中断撤回未抬手的一步 |
| 图标 | `public/favicon.png` 等 |
| 音效 | 两套（v2 tick / v3 长按咔）；合优先于滑；出手即播 |

---

## 9. 踩过的坑

| 现象 | 处理 |
|------|------|
| 点了没反应 | 设计 px × (stage宽/390)；全屏 pointer |
| 斜下当左 / 横判竖 | 段内锁轴；commit 只看 along |
| 长按斜向反轴 | **出手时** consume，不要等 settle |
| cancel 后失灵 | holding 保持；新 pointer 再 grab |
| 按住动画飞 | settle consume + reflow |
| 滑去后台也走了棋 | defer 底边 + 底缘不走棋 + 800ms 内进后台撤回 |
| 改了默认仍是旧值 | localStorage 手感；点「恢复默认」 |
| 玩家口述当规范 | 口述是现象；像素只引 A/B |

---

## 10. 刻意不做

- Android；WebGL 回退；系统 UISwipe  
- 用速度/轨迹 LERP **判方向**  
- 手感2 做成「必须松手才认」  
- 整盘固定滑移时长  
- 热路径 `new Audio()`（音效走 catalog + batcher）

```
npm run dev     # 127.0.0.1:5204
npm run test
npm run ios
```
