# 检索计划与结论 — 四向棋盘「最佳手感」

日期：2026-09-01。  
原则：**玩家口述是现象，不是规范。** 规范只来自 A/B 源 + 本项目合同。

合同：一次手势 = 一个离散四向命令；滑多远/多快 **不改变这一步停点**；死区防点按误滑；方向要准、行程不必很长；按住可转向；iOS WK WebView。

---

## 检索计划（三轮）

### 缺口

1. 提交时刻：滑动中 vs 抬手 vs 速度门槛 — 各适合哪类手势。  
2. slop / 提交距离 / fling 速度 三层刻度，谁能进棋盘。  
3. 方向锁：净向量 vs 段内锁轴 vs 系统 Swipe。  
4. 同类游戏（Threes / 2048 源码）实际写了什么，不是「我玩着像什么」。

### Query（执行过）

| 轮 | 查什么 | 期望类型 |
|----|--------|----------|
| 1 合同 | Cirulli `keyboard_input_manager.js`；Apple Pan vs Swipe；Hammer Swipe `INPUT_END`+velocity | A 源码/官方 |
| 2 OS 刻度 | Android `touchSlop` vs `minFlingVelocity`；Material drag/swipe/fling；UIScrollView directional lock | B 常量 |
| 3 玩法 | Threes slow-drag 预览；SO「用 translation 不要用 velocity 判向」 | C 合同 / A 工程经验 |

**禁止当证据：** 商店套话、教程 `SWIPE_THRESHOLD=100`、Tinder、把玩家体感写成「原版规则」。

---

## 检索结果（分级）

### A — 必须听

| 事实 | 源 |
|------|-----|
| 网页 2048：**`touchend` 才 `emit("move")`**，`touchmove` 只 preventDefault；`max(\|dx\|,\|dy\|)>10`；**无速度** | Cirulli `keyboard_input_manager.js` |
| 棋盘不要用系统 **Swipe**（离散、要速度/方向、成功一次）。用 **Pan** 自己切成命令 | Apple UIPan vs UISwipe；同视图上 Pan 先成功 |
| Pan 连续，有 translation + velocity；**velocity 给结束动画/惯性，不是给「有没有这一步」** | Apple UIPan 文档 |
| Hammer **Swipe** = 距离 **且** velocity **且 `INPUT_END`**。慢拖永远失败 | hammerjs recognizer-swipe 源码 |
| 判向用 **translation 全程**，不要用松手瞬间 velocity（尾部会抖、轴会跳） | SO 13873827 高票 |
| Android：**MOVE 过 touchSlop = 开始当滑动**；**UP + fling 速度 = 甩**。两套标准，不是一套 | developer.android.com ViewGroup / ViewConfiguration |

### B — 刻度

| 层 | 量级 | 用途 |
|----|------|------|
| slop | ~8–18 逻辑 px / ~10 pt | 点按 vs 开始认滑 |
| 翻页/卡片提交 | ~30–75 px 或半页 | **UI**，不是棋盘 |
| fling | ~250–300 pt/s；Hammer 0.3 px/ms | **甩**，松手通道 |
| 轴锁 | 对角先不锁；主轴明显再锁 | UIScrollView `directionalLockEnabled`；Gecko 30° |

棋盘提交应 **大于 slop、小于半格～翻页**。不要把 fling 速度抄成「必须达到才走棋」。

### C — 合同，不抄像素

- **Threes!**：官方攻略写明 **慢拖预览**，划回可取消。速度门槛会直接毁掉这种「想清楚再提交」的棋类手感。  
- 玩家「原版滑到就动」：与 Cirulli 源码不一致。可能是克隆、或 10px+立刻抬手的体感。**当现象，不当 A。**

### D — 淘汰

- 手感2「慢再远也不动、必须够快」= Hammer Swipe / Material **Fling**，合同外（棋盘允许慢、准、短）。  
- 用速度判 **方向**。

---

## 最佳方案（采用）

**主方案 = 手感1（距离 Pan → 立刻命令），不是手感2。**

1. **死区 slop**（默认 10）：防点按抖动。不是走棋距离。  
2. **段内锁轴 + 轴比**：过死区后看清横竖再锁；斜的等；不清段重来。  
3. **沿轴距离 ≥ commit 立刻走棋**（默认 16，略大于 slop）。不看速度。慢划只要够直够远也出手。  
4. **出手清段**（`setTranslation(0)` 类比）：按住转向；斜尾不带进下一手。  
5. **手感1：速度不参与能不能走。** 手感2（另一类用户）：距离 **且** 轴上窗速度，AND 是产品选择，不是误用 Hammer 松手 Swipe。  
6. 抬手：短滑未出手可 nudge；长斜静默。  
7. 动画锁 + rearm：防连发，不参与识别。

两套都是正式手感，服务不同人：

| | 手感1 距离 | 手感2 甩动 |
|--|--|--|
| 用户 | 要慢划、想清楚再走 | 不要慢划误触，习惯甩一下 |
| 出手 | 沿轴 ≥ commit | 沿轴 ≥ commit **且** 轴上窗速度 ≥ speedPxS |
| 速度算法 | 不用 | **80ms 窗净位移/时间**（VelocityTracker 类），只看 **已锁轴**。不用单帧、不用欧氏距离、不用松手 Hammer Swipe |
| 方向 | 段内锁轴 + 位移 | 同左（速度不判向） |
| 提交时刻 | 滑动中立刻 | 滑动中立刻（条件满足就 fire，不把判定推迟到抬手） |
| 按住 | 可转向、可同向连走（旋钮） | **每次按下只出手一次**，抬手再按才能下一步 |

---

## 自洽

| 需求 | 主方案 |
|------|--------|
| 防误触 | slop |
| 方向准、行程短 | 轴比 + commit≈slop+ |
| 慢划也要能走（棋类） | 不要求速度 |
| 快甩也要能走 | 距离一够就 fire，快的人更容易够 |
| 按住转向 | 增量段 |
| 滑距≠停点 | 规则层算墙/合并 |
| 你测到的「滑到就动」 | 主方案就是立刻 fire（比 Cirulli 网页更跟手） |

「必须甩才动」单独当全产品唯一方案时，偏导航 Swipe。作为 **手感2** 与手感1 并存则成立：认方向仍用位移，速度只挡出手，且滑动中立刻 fire、一次按下只一步。
