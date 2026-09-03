# 手感回路（现行设计）

日期：**2026-09-03**。  
范围：结束层、斜滑意图、手感2 慢滑/抬手、走棋与画面打断。  
手势状态机细节仍以 [SWIPE-DESIGN.md](./SWIPE-DESIGN.md) 为准；滑移公式以 [MOTION.md](./MOTION.md) 为准；旋钮默认以 [IMPLEMENTATION.md](./IMPLEMENTATION.md) 为准。

**优先级：手感反馈第一。** 逻辑立刻跟手；画面可以赶路、可以半路转向，不能卡住下一手。

---

## Key Decisions

1. **结束层盖住局内全部 UI**  
   Overlay 是 `#ui-root` 的兄弟层（不在棋盘里），`z-index: 200`。分数在上三分之一，按钮偏下；「没有可走的步了」贴在分数下。

2. **意图纠偏只开 2048、且只开未锁轴的 40°–45°**  
   日常拇指偏角当主轴，绝不改判。斜滑两向里只有一向能走才走那向。涂色、键盘不开。

3. **手感2：先慢后快也不走**  
   本按下一旦 `along ≥ commit` 且窗速度不够，锁 `slowDrag`。抬手不写入速度窗，并忽略末 32ms 揭指。

4. **走棋不等动画（A′）**  
   `isBlocked` 仅 `merge && over`。清段只在出手瞬间和抬手。画面从当前 `transform` 接到新格，打断最短 48ms；打断时不播 appear/pop。

---

## 分层

```
判定  swipeSegment + swipeVelocity     纯函数，可单测
事件  swipeInput                       pointer / 底缘 / 后台撤回
玩法  board + amaze + game2048         逻辑盘立刻结算
表现  view + amazeView + tilePool      可打断；从像素接过去
结束  overlay（#g-overlay）            盖满 ui-root
```

---

## 结束层

- DOM：`#g-overlay` 与 `.g2048` 并列，铺满 `#ui-root`（含安全区垫）。  
- 上块 `.g-over-top`：`top: 33.333%` 垂直居中该块（本局分数 / 大号数字 / 结束文案）。  
- 下块 `.g-over-bottom`：`top: 62%`（再来）。  
- 棋盘方块 `z-index` ≤ 20；overlay 200，避免合并块盖住按钮。

---

## 斜滑分叉（2048）

未锁轴（`axisRatio` 约 1.55 → 偏角 &gt; ~33° 锁不上）且副/主 ≥ tan40°、两轴都 ≥ commit：

| 盘面 | 结果 |
|------|------|
| 只有一向 `canMove`（手感2 还要该轴速度够） | fire 该向 |
| 两向都能走 | 不出手 |
| 两向都不能走 | `dead` → 较长轴 nudge（平手向下） |
| 已锁轴（含略偏） | 只走主轴，非法则 nudge |

`legal` 缺省则不做分叉（涂色、旧测试）。

---

## 手感2 速度

- 80ms 窗净位移，不判向。  
- 抬手：不 `vel.push(pointerup)`；按下超过约 120ms 才剥末 32ms 揭指。短快甩不剥，避免第二下速度被吃光。  
- **每次 `pointerdown` 都开新段**（清 `lastDir`）。iOS 第一下常以 `pointercancel` 结束，若仍当同一指，手感2 会丢掉紧接着的第二下。  
- **底缘下滑仍走棋**（仅让出上滑回桌面）。Home 条一带向下由原生 pan **独占认领**（`cancelsTouchesInView`），达到约 28pt 后派 `swipe2048-edge-down` 让棋盘走下。空 pan 同时识别挡不住 Reachability。  
- `shouldLatchSlowDrag(along, speed, commit, speedMin)` 在 **pointermove** 上锁；本按下 `slowDrag` 后 evaluate 不再 fire。

---

## 走棋与画面

- `tryDir` 立刻 `applyMove` / `moveAmaze`，不设输入 busy。  
- `paintBoard`：先快照可见块 computed transform（按 `dataset.id`，合并看源块），同 id 复用池元素，从像素 `catchUpMs`（`CATCH_UP_MIN_MS = 48`）接到新格。  
- 成功走棋去掉 `g-nudge`。  
- 音效/震动跟逻辑出手。  
- 游戏层不因滑移结束调用 `onMoveSettled`。

---

## 刻意不做

- 策略 AI / 四向里找能走的。  
- 斜滑阈值进设置表。  
- 等动画播完再接受下一手。  
- 打断时先瞬移回逻辑 `previous` 再滑。

---

## 验收

- 结束：分数在上、按钮可点、顶栏被挡住。  
- 往下略偏、下不动右能动 → nudge，不向右。  
- 一开始就很斜、只有右能动 → 向右。  
- 慢拖过 commit 再甩/快抬 → 不走棋。  
- 真下再马上上 → 第二步立刻改盘，方块半路转向不闪格。
