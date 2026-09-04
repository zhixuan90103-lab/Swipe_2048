# 手感回路（现行设计）

日期：**2026-09-03**。  
范围：结束层、斜滑意图、手感2 慢滑/抬手、走棋与画面打断、iOS 系统手势互斥。  
手势状态机细节以 [SWIPE-DESIGN.md](./SWIPE-DESIGN.md) 为准；滑移公式以 [MOTION.md](./MOTION.md) 为准；旋钮默认以 [IMPLEMENTATION.md](./IMPLEMENTATION.md) 为准。

**优先级：手感反馈第一。** 逻辑立刻跟手；画面可以赶路、可以半路转向，不能卡住下一手。  
**系统手势与走棋互斥：** 触发回桌面 / 便捷访问 / 控制中心时，棋盘不得同时动。

---

## Key Decisions

1. **结束层盖住局内全部 UI**  
   `#g-overlay` 与 `.g2048` 并列，铺满 `#ui-root`，`z-index: 200`。上三分之一：本局分数 + 大号数字 + 结束文案；约 62% 高度：再来。

2. **意图纠偏只开 2048、且只开未锁轴的 40°–45°**  
   日常拇指偏角当主轴，绝不改判。斜滑两向里只有一向能走才走那向。涂色、键盘不开。

3. **手感2：先慢后快也不走**  
   本按下一旦 `along ≥ commit` 且窗速度不够，锁 `slowDrag`。抬手不写入速度窗；按下超过约 120ms 才剥末 32ms 揭指。短快甩不剥。

4. **2048 走棋不等动画（A′）。涂色滑移中可 90° 转弯**  
   2048：`isBlocked` 仅 `merge && over`。清段只在出手瞬间和抬手。画面从当前 `transform` 接到新格，打断最短 `CATCH_UP_MIN_MS`（48ms）；打断时不播 appear/pop。  
   **涂色：** 滑移途中只接受垂直方向：先赶到当前轴上将到达的格，再沿新向滑到墙。同向 / 反向忽略。不斜接。

5. **系统手势与走棋互斥**  
   按下点在 **顶或底安全区** → 本段不 `onMove`、不 nudge。  
   回桌面：**不 defer 底边**，从 Home 条上滑一次即退出。  
   便捷访问：无公开 API 可关；原生只在屏幕最底约 **10–14pt** 拦向下：第一次吞掉，5s 内第二次放给系统。不派 JS 走棋。  
   不要 `prefersHomeIndicatorAutoHidden`（会让底边 defer 失效；我们已不 defer 底边，仍不要藏条）。

6. **连滑第二下**  
   每次 `pointerdown` 都 `grab(true)` 开新段。iOS 常把第一下结束成 `pointercancel`，若仍当同一指，手感2 会丢掉下一甩。

---

## 分层

```
判定  swipeFeel1 / swipeFeel2 + swipeVelocity     纯函数，可单测
事件  swipeInput                       pointer / 安全区忽略 / 后台撤回
玩法  board + amaze + game2048         逻辑盘立刻结算
表现  view + amazeView + tilePool      可打断；从像素接过去
结束  overlay.ts → #g-overlay          盖满 ui-root
iOS   BridgeViewController             不 defer 底边；细带两次拦向下
音频  NativeAudioPlugin                ambient + mixWithOthers，无 duckOthers
```

---

## 结束层

- DOM：`overlay.ts` 的 `OVERLAY_HTML`，与 `.g2048` 并列。  
- `.g-over-top`：`top: 33.333%`（本局分数 / 数字 / 「没有可走的步了」）。  
- `.g-over-bottom`：`top: 62%`（再来，约 168×52）。  
- 棋盘方块 `z-index` ≤ 20；overlay 200。

---

## 斜滑分叉（2048）

未锁轴（`axisRatio` 1.55 → 偏角 ≳ 33° 锁不上）且副/主 ≥ tan40°、两轴都 ≥ commit：

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
- 抬手不 `vel.push(pointerup)`；整段按下 **≥ 120ms** 才剥末 32ms。  
- `shouldLatchSlowDrag` 只在 **pointermove** 上锁。  
- `pointerdown` 一律新段。

---

## 走棋与画面

- 2048：`tryDir` 立刻 `applyMove`，无输入 busy。涂色：滑移中垂直滑可转弯，同向/反向丢掉。  
- `paintBoard`：快照 computed transform（id；合并看源块），同 id 复用池，`catchUpMs` 接到新格。  
- 成功走棋去掉 `g-nudge`。音效/震动跟逻辑出手。  
- 游戏层不因滑移结束调用 `onMoveSettled`。

---

## iOS 系统手势

| 手势 | 行为 |
|------|------|
| 棋盘内四向 | 走棋 |
| 顶/底安全区起手 | **整段不走棋** |
| Home 条上滑 | 一次回桌面（`preferredScreenEdgesDeferringSystemGestures = []`） |
| Home 条一带往下（约 10–14pt） | 第一次原生吞掉；5s 内第二次给便捷访问 |
| 后台音乐 | `.ambient` + `.mixWithOthers`，**无** `.duckOthers` |

800ms 内进后台仍撤回「本按下已走棋」的快照（K14），作为互斥的补刀。

---

## 刻意不做

- 策略 AI / 四向里找能走的。  
- 斜滑阈值进设置表。  
- 等动画播完再接受下一手。  
- 打断时先瞬移回逻辑 `previous`。  
- App 内关闭便捷访问（无公开 API）。  
- `prefersHomeIndicatorAutoHidden`。

---

## 验收

- 结束：分数在上、按钮可点、顶栏被挡住。  
- 往下略偏、下不动右能动 → nudge，不向右。  
- 一开始就很斜、只有右能动 → 向右。  
- 慢拖过 commit 再甩/快抬 → 不走棋。  
- 真下再马上上 → 第二步立刻改盘，方块半路转向不闪格。  
- 贴 Home 条上滑退出 → 棋盘不动。  
- 打开游戏时后台音乐音量不明显被压低。
