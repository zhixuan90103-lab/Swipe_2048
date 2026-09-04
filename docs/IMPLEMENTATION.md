# Swipe_2048 — 现行实现

日期：**2026-09-03**。默认值以 `src/game/feel.ts` 的 `FEEL1_DEFAULT` / `FEEL2_DEFAULT` 为准（两套独立类型与旋钮，互不 keep）。音效以 [AUDIO.md](./AUDIO.md) 为准。手感回路（结束层 / 斜滑 / 慢滑 / 打断）以 [FEEL-LOOP.md](./FEEL-LOOP.md) 为准。

| 规范 | 文件 |
|------|------|
| 手势判定 | [SWIPE-DESIGN.md](./SWIPE-DESIGN.md) |
| 手感回路 | [FEEL-LOOP.md](./FEEL-LOOP.md) |
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
| **涂色**（`solo`） | 7×9 滑到墙涂满；已涂可再走；步数 vs 参考步施压 | **手感1 距离** |

输入：手写 **Pan → 离散四向**。滑距 ≠ 停点。不用系统 UISwipe。

UI 对齐中文原版 2048（[UI-ORIGINAL.md](./UI-ORIGINAL.md)）。  
**点左上角标题**切 2048 / 涂色；**菜单**新局；**设置**开当前模式的手感旋钮（两套独立）。

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
| 默认模式 | 涂色 | 2048 |
| 出手 | 沿锁轴 ≥ `commitPx` | 沿轴 ≥ `commitPx` **且** 轴上 80ms 窗速度 ≥ `speedPxS` |
| 慢但方向清楚 | 距离够就走 | **不走棋**。本按下一旦出现「距离已够、速度不够」即锁成慢滑，之后再加速或快抬手也不走。抬手揭指不写入速度窗，且忽略抬手前 32ms。 |
| 按住 | 可转向；`sameDirRepeat` 可连走 | **每次按下只一步** |

`pointercancel` 不断按住；**每次 `pointerdown` 开新段**。全屏 window pointer。**2048 走棋不等动画**。**涂色滑移中可 90° 转弯**（先到当前轴下一格再直角改向；同向/反向忽略）。清段只在出手/抬手。仅 `state.over` 挡 2048 输入。

**系统手势与走棋互斥**（详见 [FEEL-LOOP.md](./FEEL-LOOP.md)）：按下点在顶/底安全区则本段不走棋。回桌面一次上滑（不 defer 底边）。便捷访问无公开关闭口；原生最底约 10–14pt 向下第一次吞掉、5s 内第二次给系统。本按下已走棋且 800ms 内进后台 → 撤回该步。

测试：`npm test`（`swipeSegment` + `swipeVelocity` + `motion` + `hapticFeel` + `audioBatcher` + `amaze`）。

---

## 3. 文件

| 文件 | 职责 |
|------|------|
| `src/game/swipeFeel1.ts` | 手感1 距离判定 |
| `src/game/swipeFeel2.ts` | 手感2 甩动判定 |
| `src/game/swipeAxis.ts` | 锁轴 / 抬手 invalid 共用 |
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

点左上角标题切 2048 / 涂色，并加载该模式自己的手感存盘。设置面板 **不再** 切手感套；涂色只调手感1 旋钮，2048 只调手感2。两套默认与存盘互不覆盖。「恢复默认」只恢复当前模式。

`slopPx ≥ commitPx`：锁轴帧可能立刻 fire。面板不自动纠正。

### 手感1（涂色）`FEEL1_DEFAULT`

| 键 | 默认 | 作用 |
|----|------|------|
| slopPx | 10 | 点按死区 |
| commitPx | 16 | 沿锁轴出手 |
| axisRatio | 1.55 | 主轴/副轴 |
| tileMoveMs | 60 | 涂色每格 ms |
| appearMs | 200 | 新块出现 |
| inputLockMs | 10 | 动画后再锁 |
| rearmMs | 10 | 锁开后再等 |
| nudgePx / nudgeMs | **5 / 350** | 沿滑动方向回弹 |
| sameDirRepeat | false | 同向连走 |
| boardY | **0** | 棋盘上下 |
| boardScale | **1.1** | 棋盘缩放 |

### 手感2（2048）`FEEL2_DEFAULT`

独立一份，不是手感1 的覆盖。

| 键 | 默认 | 作用 |
|----|------|------|
| slopPx | 10 | 点按死区 |
| commitPx | 30 | 沿轴出手（还要够快） |
| speedPxS | 200 | 80ms 窗速度门槛 |
| axisRatio | 1.55 | 主轴/副轴 |
| slideMs | **65** | 每格滑移 |
| slideEase | **soft** | 整段曲线 |
| appearMs | **250** | 新块出现 |
| mergePopMs | **200** | 合并弹 |
| inputLockMs | **0** | 输入锁 |
| rearmMs | 0 | 转向再等 |
| nudgePx / nudgeMs | **5 / 350** | 回弹 |
| boardY | **0** | 棋盘上下 |
| boardScale | **1.1** | 棋盘缩放 |

涂色盘（与手感表分开存）：格子边长默认 **24** 设计 px（范围 24–56）；每格移动 **20ms**（范围 20–160）。

震动默认：`slideI` / `slideS` **0.30**；`pulseTailI` **0.20**；合强度下限 **0.70**。

---

## 5. UI

- 顶栏：[UI-ORIGINAL.md](./UI-ORIGINAL.md) — 标题 **104²**，分数 **93×92**，按钮 **93×28** `#ed995b` 与分数盒左右对齐。  
- **点黄块** ↔ 2048 / 涂色。滑动忽略 `#g-title`。  
- **菜单** = 新局。**设置** = 手感表。  
- 棋盘格 72、缝 8 × `boardScale`（**1.1**）；`boardY` **0**。  
- 结束层：盖满 `#ui-root`（`overlay.ts`）。上：本局分数；下：再来。800ms fade，delay 1200ms。

设置项：2048 显示每格滑移、曲线、出现、合并弹；涂色显示格子边长与每格用时。模型见 [MOTION.md](./MOTION.md)。

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
iOS：`AVAudioSession` `.ambient` + `.mixWithOthers`，**不要** `.duckOthers`。

---

## 8. 近期改动（相对最初底座 demo）

按主题，不是按 commit。

| 主题 | 现在 |
|------|------|
| 玩法 | 2048 + 涂色迷宫；黄块切换 |
| 手势 | 段锁轴 + 两套出手；斜滑分叉；慢滑锁；pointerdown 新段 |
| 每格滑移 | **65ms**（手感2）；输入锁 **0** |
| 走棋 / 画面 | 逻辑立刻结算；打断从当前像素接过去 |
| 结束层 | 盖满 UI；分数在上、再来在下 |
| 系统手势 | 与走棋互斥；回桌面一次上滑；细带两次拦便捷访问 |
| 音效 | 两套；合优先于滑；iOS 不 duck 后台音乐 |
| 震动 | 滑 0.30 / 合下限 0.70 |

---

## 9. 踩过的坑

| 现象 | 处理 |
|------|------|
| 点了没反应 | 设计 px × (stage宽/390)；全屏 pointer |
| 斜下当左 / 横判竖 | 段内锁轴；commit 只看 along |
| 长按斜向反轴 | **出手时** consume，不要等 settle |
| cancel 后失灵 | holding 保持；新 pointer 再 grab |
| 按住动画飞 | 逻辑立刻结算；打断从当前像素接 |
| 系统手势同时走棋 | 顶/底安全区起手不走棋；回桌面一次上滑；800ms 进后台撤回 |
| 改了默认仍是旧值 | localStorage 手感；点「恢复默认」 |
| 玩家口述当规范 | 口述是现象；像素只引 A/B |

---

## 10. 刻意不做

- Android；WebGL 回退；系统 UISwipe  
- 用速度/轨迹 LERP **判方向**  
- 手感2 做成「必须松手才认」  
- 整盘固定滑移时长  
- 热路径 `new Audio()`（音效走 catalog + batcher）  
- App 内关闭便捷访问；iOS `.duckOthers` 压后台音乐

```
npm run dev     # 127.0.0.1:5204
npm run test
npm run ios
```
