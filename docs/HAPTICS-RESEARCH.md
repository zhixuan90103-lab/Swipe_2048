# 检索计划 — 游戏震动（Haptics）

日期：**2026-09-02**。计划已执行；并做 **反查→改计划→再检索 × 3**。**不改玩法接线**；结论只进本文。  
配套：[HAPTICS.md](./HAPTICS.md)（怎么接上）· [AUDIO.md](./AUDIO.md)（何时出声）· [MOTION.md](./MOTION.md)（何时动）· [IMPLEMENTATION.md](./IMPLEMENTATION.md)

原则与手势检索相同：**玩家口述是现象，不是规范。** 规范只来自 A/B 源 + 本项目合同。

---

## 合同（本游戏）

一次有效手势 = 一个离散四向命令。出手即有反馈，不等滑移动画结束。

| 通道 | 现行事实 |
|------|----------|
| 画面 | 滑移 / 合并 pop / 无效 nudge；busy 时不再判手势 |
| 音效 | 出手即播；有合只播最高一档合，无合播滑；nudge / ui / 过关失败；合优先于滑 |
| 震动 | 插件已通（Core Haptics + UIKit fallback），**玩法层尚未按事件接线** |

用户要求：**画面、震动、音效感受相同** —— 同一事件、同一时刻、同一「软/硬、轻/重」气质，不是三套互相打架的节奏。

舒适且不打扰：棋盘连滑很快；震动必须能跟手、能被忽略、不能抢过合/滑的主反馈。

刻意不做（本计划阶段）：改 Swift 插件 API、抄 Android `Vibrator`、用 `navigator.vibrate` 当 iOS 规范、用商店文案当证据。

---

## 缺口（检索要回答的问题）

1. **系统预制 vs 自绘**：`UIImpact` / `UISelection` / `UINotification` 各对应什么意图？棋盘滑/合该不该用「按语义选预制」，还是 Core Haptics 自调 intensity/sharpness？Apple 怎么说「不要因为手感好听就乱用某类」？
2. **舒适与克制**：HIG 对 overuse、surprise、必须对准视觉变化 写了什么硬规则？系统何时 **不播**（设置关、后台、没马达、低电）？
3. **与声画同步**：HIG「视觉/听觉/触觉和谐」的原文与示例；碰撞样例如何把 **速度 → intensity/sharpness 且音量同映射**。我们出手即播，震动是否必须同一微任务、禁止晚于音效一帧？
4. **强度空间**：intensity（强弱）vs sharpness（圆钝 ↔ 干脆）。低 sharpness + 中低 intensity 是否就是「不打扰」的官方语言？连续 rumble 适不适合 2048 的离散一步？
5. **叠层与节流**：Core Haptics 会自动 layer；HIG/文档对「不想叠就要自己等」怎么写。连滑 + 合挤掉滑（音效已有）在震动侧该镜像还是更狠？
6. **本游戏事件表**：slide / merge(档) / nudge / ui / win / over 各该 transient 还是 continuous？合档要不要像音高一样抬 intensity，还是只抬 sharpness、强度封顶以免烦？

---

## 来源分级（执行时用）

| 级 | 听谁 | 不听谁 |
|----|------|--------|
| **A** | Apple HIG Playing haptics；Core Haptics 框架页；`CHHapticEvent` / Engine；官方 sample（HapticBounce、HapticPalette、AHAP、Rich Experiences）；WWDC *Designing Audio-Haptic Experiences* | 博客「10 行 UIImpact」 |
| **B** | `UIFeedbackGenerator` 子类文档里的 **意图句**（impact=碰撞/卡位，selection=选择变化，notification=成败警告）；AHAP 参数范围 0–1 | 第三方把 light/medium/heavy 抄成「游戏默认」 |
| **C** | 本仓库音效规则、运动时长、手感1/2 出手时刻 | 「我觉得应该震一下」 |
| **D 淘汰** | 每步 heavy；连续马达当背景；notification.success 当合并（语义错）；模拟器验收；`prepare()` 当接上 | |

禁止当证据：应用商店「沉浸式震动」、教程无差别 `impact.heavy`、把 Android 时长毫秒当成 Taptic 强度。

---

## 检索计划（四轮）

全部优先 **developer.apple.com**。执行时记下原文短句 + URL，不写「感觉」。

### 轮 1 — 设计意图（HIG + 系统反馈语义）

| 查什么 | 期望 URL / 类型 |
|--------|------------------|
| Playing haptics：complement、harmony、match intensity/sharpness of animation、synchronize sound | [HIG Playing haptics](https://developer.apple.com/design/human-interface-guidelines/playing-haptics) |
| Use feedback intentionally：intended purpose、source clear、never surprise、don’t overuse | [Playing haptic feedback in your app](https://developer.apple.com/documentation/uikit/uifeedbackgenerator) 及同主题「playing haptic feedback」 |
| Impact vs Selection vs Notification 各自 **for** 哪类事件 | [UIFeedbackGenerator](https://developer.apple.com/documentation/uikit/uifeedbackgenerator) · Impact / Selection / Notification 子类 |
| iOS 上「标准控件自带」vs「自定义用 generator」vs「游戏用 Core Haptics」分界 | 同上 HIG Platform considerations → iOS |

**本轮要产出：** 一张「事件意图 → 允许的 API 族」表，还没有具体 0–1 数值。

### 轮 2 — Core Haptics 积木（官方 API + 参数语义）

| 查什么 | 期望 |
|--------|------|
| Transient = tap/impulse；Continuous = 持续振动 | [Core Haptics](https://developer.apple.com/documentation/corehaptics) · [CHHapticEvent](https://developer.apple.com/documentation/corehaptics/chhapticevent) |
| Intensity = 强度；Sharpness = 软圆/有机 ↔ 干脆/机械 | HIG 同页；[AHAP](https://developer.apple.com/documentation/corehaptics/representing-haptic-patterns-in-ahap-files) |
| Attack / Decay / Release 是否只对 continuous 有意义 | AHAP + Event Parameter ID |
| Engine：前台、`playsHapticsOnly`、muted、reset handler | [CHHapticEngine](https://developer.apple.com/documentation/corehaptics/chhapticengine) |
| 单次 tap 最小模式 | [Playing a single-tap haptic pattern](https://developer.apple.com/documentation/corehaptics/playing-a-single-tap-haptic-pattern) |
| 不想叠层：自己等上一段结束 | [Playing a Custom Haptic Pattern from a File](https://developer.apple.com/documentation/corehaptics/playing-a-custom-haptic-pattern-from-a-file) |

**本轮要产出：** 积木词典（我们插件已有 `impact` / `playTransient` / `playPattern` / continuous）。标明 **2048 默认该用哪块、哪块合同外**（长 continuous 很可能合同外）。

### 轮 3 — 声画触觉同一感受（官方样例 + WWDC）

| 查什么 | 期望 |
|--------|------|
| 碰撞速度 → **同一归一化量** 同时驱动 haptic intensity/sharpness **和** audio volume/pitch | [Playing Collision-Based Haptic Patterns](https://developer.apple.com/documentation/corehaptics/playing-collision-based-haptic-patterns)（HapticBounce） |
| 实时改 intensity/sharpness（HapticPalette） | [Updating Continuous and Transient…](https://developer.apple.com/documentation/corehaptics/updating-continuous-and-transient-haptic-parameters-in-real-time) |
| 音+触同一 pattern、layer 闪电+雷 | AHAP Audio Custom + Haptic；WWDC19 [Designing Audio-Haptic Experiences](https://developer.apple.com/videos/play/wwdc2019/223/) 三原则 **causality** 等 |
| Delivering Rich App Experiences with Haptics | [文档入口](https://developer.apple.com/documentation/corehaptics/delivering-rich-app-experiences-with-haptics) |

**本轮要产出：** 映射规则草案 —— 本游戏用 **合并档 / 是否合 / 是否无效** 当「magnitude」，禁止画面 pop 大、声轻、震重这种错位。

对照本仓库已有音效合同（执行时不得改音效规则，只对齐震动）：

| 游戏事件 | 画面 | 音效（已定） | 震动假设（待官方验证，非正式默认） |
|----------|------|--------------|-----------------------------------|
| 滑、无合 | 滑移 | `slide` 出手即播 | 短 transient，偏低 intensity，sharpness 跟音效2「干咔」还是音效1「短 tick」 |
| 合 | pop | 只播最高档合，档位升音高 | 同一时刻；档位升 **一点** intensity 或 sharpness，封顶；不要 notification.success |
| nudge | 回弹 | `nudge` | 更软、更短；可能 selection 或极低 transient |
| ui | 按钮 | `ui` | selection 或 light impact，勿 heavy |
| win / over | 结算可略晚 | 可略晚 | 唯一允许稍长的 pattern；仍避免连续马达 |

### 轮 4 — 不打扰：系统限制 + 本游戏热路径

| 查什么 | 期望 |
|--------|------|
| 无马达 / 系统 Haptics 关 / 非前台 → 系统可不播 | Playing haptic feedback in your app |
| Generator 是「告知事件」不是「强制马达」 | 同上 |
| 插件热路径：已有 batch 思想在音频；震动是否同样禁止每事件一次重桥、禁止每步 `prepare` | [HAPTICS.md](./HAPTICS.md) + 插件 Swift（对照，不改） |
| 合挤滑、同时一条：震动是否镜像 `AudioBatcher` | C 合同 |
| 真机 Taptic；模拟器不当验收 | HAPTICS.md 已写 |

**本轮要产出：** 克制清单（哪些事件默认可关、cooldown、合档是否压缩到 2～3 档触觉以免 10 档都震出新花样）。

---

## 与工程的边界（检索之后才动代码）

已有、不要重接：

- `plugins/native-haptics/` + `src/utils/haptics.ts`
- 验收：真机 HUD `plugin: true` + impact，不用 `prepare()`

检索结束后才允许的产品层（另开实现）：

- `gameSfx` 同拍触发的 `gameHaptics`（事件名对齐 slide/merge/nudge/ui/win/over）
- 设置里震动开关（系统开关之上再加游戏开关）
- 可能的「随音效套装」：音效1 更 tick → 更高 sharpness 更短；音效2 更圆 → 更低 sharpness。须有 A 源支持「与声匹配」，不是两套胡调

---

## 验收（本计划本身）

计划算完成，当且仅当：

1. 四轮 Query 都有官方 URL。  
2. 合同写明声画触同一事件、同一出手时刻。  
3. 明确 A/B/C/D，避免把 UIKit 语义类用错。  
4. **没有** 把 intensity 数字写进 `feel.ts`（那是检索结论阶段的事）。

---

## 检索结果（分级）

执行日：**2026-09-02**。下列句子能在对应 URL 找到；不能当证据的标 D。WWDC19 视频未逐字逐句拉取全文，三原则以 **HIG 已写明的同义句** 为准，不另造 WWDC 编号。

### A — 必须听（HIG + Core Haptics + 系统何时播）

| 事实 | 源 |
|------|-----|
| **按文档含义用系统预制。** 对不上就不要拿该 pattern 表示别的事；改用 generic 或自绘（游戏常用 custom） | [HIG Playing haptics · Best practices](https://developer.apple.com/design/human-interface-guidelines/playing-haptics#Best-practices) |
| **始终一致、因果清楚。** 同一 pattern 不能既当失败又当过关 | 同上 |
| **触觉补视听，三者和谐。** 震动的 intensity/sharpness **对齐它所伴随动画的** intensity/sharpness；可与声音同步 | 同上；开发指引 [Delivering Rich App Experiences with Haptics](https://developer.apple.com/documentation/corehaptics/delivering-rich-app-experiences-with-haptics) |
| **避免滥用。** 偶发刚好、频发就腻。最好的震动是人未必意识到、关掉才觉得缺 | HIG Best practices |
| **多数 App 用短震动配离散事件。** 长时间震动会稀释含义、分心。游戏里伴随流程的长震可以，**普通 App 任务流上的长震不行** | 同上 |
| **必须可关。** 关掉仍能玩 | 同上 |
| **不要因为手感好听就选某类。** 必须用于其 **intended purpose**；来源必须是界面变化或用户动作；**禁止突然震**；滥用会让反馈失去意义 | [Playing haptic feedback in your app](https://developer.apple.com/documentation/applepencil/playing-haptic-feedback-in-your-app) |
| UIKit/SwiftUI 反馈 API **并不直接保证马达响**：只是告知系统。系统按设备、前台、电量等决定。仅当：有触觉硬件、App **前台**、系统 **Haptics 开**。不要自己先判断机型再决定调不调；该事件就调，系统忽略无法完成的请求 | 同上 · Define when to play feedback |
| Transient = 短促冲击（picker / 开关那种一下）；Continuous = 铃声那种拉长 | [CHHapticEvent](https://developer.apple.com/documentation/corehaptics/chhapticevent) · HIG Custom haptics |
| Sharpness：向系统表达意图——软、圆、有机 ↔ 干脆、精确、机械。Intensity = 强弱 | HIG Custom haptics |
| 参数 0–1 是 **系统最小/最大的归一化**，0 不是「没效果/零秒」 | [AHAP](https://developer.apple.com/documentation/corehaptics/representing-haptic-patterns-in-ahap-files) |
| 碰撞样例：用球体速度归一化，**同时**驱动 transient 的 intensity **和** 合成音的 volume（及 decay） | [Playing Collision-Based Haptic Patterns](https://developer.apple.com/documentation/corehaptics/playing-collision-based-haptic-patterns) |
| 模拟器 **没有** haptic 接口；样例要求真机 iPhone 8+ | HapticBounce / HapticSampler 页 Note |
| 同时播放会 **自动叠层**。不想叠就自己等上一段结束。同类事件同时播 **分不清**；不是音频那种混合 | [Playing a Custom Haptic Pattern from a File](https://developer.apple.com/documentation/corehaptics/playing-a-custom-haptic-pattern-from-a-file) |
| OS 仍可覆盖 App 的请求（系统通知等） | [CHHapticEngine](https://developer.apple.com/documentation/corehaptics/chhapticengine) |
| iPad 等可能 `supportsHaptics == false`；无马达时改加强音频/画面，不要假装震了 | [Preparing your app to play haptics](https://developer.apple.com/documentation/corehaptics/preparing-your-app-to-play-haptics) |

### B — 系统预制的意图（按语义用，不按「听着爽」）

| API | 官方意图 | 本游戏能不能当棋盘主反馈 |
|-----|----------|--------------------------|
| **Notification Success / Warning / Error** | 任务或动作的 **结果**：完成 / 警告 / 出错（HIG 例：存款、解锁车） | **不能**当每次合并。合并不是「任务完成」。过关/失败才接近 success/error，且结算稀、可略晚 |
| **Impact Light…Heavy / Rigid / Soft** | **物理隐喻**：轻/重物相撞、硬/软物相撞；视图卡到位、两物碰撞 | 合/滑/撞墙 **语义接近**，但 light/medium/heavy 只有几档，跟不上合档音高。棋盘主路径更适合 **自绘 transient** |
| **Selection** | UI 元素 **取值在变**（一串离散值里移动） | 设置开关、手感旋钮、模式切换。**不是** 每步滑棋 |
| Impact 文档例 | 拖方块 **碰到 superview 边** 才 `impactOccurred` | 对 nudge（撞墙/无效）比对「每步滑」更贴 |

源：[HIG iOS Notification / Impact / Selection](https://developer.apple.com/design/human-interface-guidelines/playing-haptics#iOS) · [UIFeedbackGenerator](https://developer.apple.com/documentation/uikit/uifeedbackgenerator) · [UIImpactFeedbackGenerator](https://developer.apple.com/documentation/uikit/uiimpactfeedbackgenerator) · [UISelectionFeedbackGenerator](https://developer.apple.com/documentation/uikit/uiselectionfeedbackgenerator)

### C — 合同映射（官方原则 × 本仓库音效/出手）

音效已定（[AUDIO.md](./AUDIO.md)）：出手即播；有合只播最高档合；合挤滑；nudge/ui；结算可略晚。

HIG 要求震动与动画/声音 **同一气质**。HapticBounce 要求 **同一归一化量** 推触和声。因此震动必须：

1. 与 `gameSfx` **同一事件名、同一拍**（出手即发，不跟 pop 峰值）。  
2. 合挤滑 **镜像音频**（官方：同类叠在一起分不清）。  
3. 合档只允许 **压缩后的几档** 抬 intensity 或 sharpness，且封顶——HIG：频发会腻；10 档都换波形 = 过用。  
4. 无合的滑：更轻、更短，人可以不意识到（HIG「关掉才缺」）。  
5. 长 **continuous** 不配「一步一命令」。HIG：离散事件用短震。

### D — 淘汰

- 每步 `impact.heavy` / `notification.success`  
- 滑棋过程 continuous rumble  
- 用 notification 表示合并（语义错 + 过用）  
- 模拟器当验收  
- 因「震着爽」选 Success  
- 画面 pop 大、音效轻、震动 heavy 的错位（违反 HIG harmony）  
- 滑+合同帧双 transient（官方：同类同时分不清）

---

## 缺口的答案

1. **预制 vs 自绘：** 棋盘主路径用 **Core Haptics transient**（游戏 custom）。UIKit 三类只用于 **对得上官方含义** 的 UI/结算。不要因为 light 好听就当滑棋。  
2. **舒适：** 短、因果、可关、不突然、不频发到腻。系统可在无马达/后台/设置关时不播。  
3. **声画触同一：** HIG 原文即「visual, auditory, and tactile … in harmony」且 match animation intensity/sharpness。实现上与音效同一微任务 flush。  
4. **强度空间：** 不打扰 = **偏低 intensity + 与音效套装一致的 sharpness**（音效1 tick → 更 crisp；音效2 圆咔 → 更 soft/rounded）。不是「intensity 永远 0.2」的魔法数；0–1 是硬件范围。  
5. **叠层：** 不要靠引擎自动 layer。自己像 `AudioBatcher`：一拍一条，合挤滑。  
6. **事件：** 全部 **transient**。continuous 本游戏默认不用。合档压缩，强度封顶。

---

## 采用方案（实现前规范，数值真机再钉）

| 事件 | 积木 | 气质（对齐画面+音效） | 预制？ |
|------|------|----------------------|--------|
| slide（无合） | 短 transient | 最轻；跟滑移起势，不跟位移结束 | 否（或仅无 Core Haptics 时 fallback `soft`/`light`） |
| merge | 短 transient | 比滑更「到」；档位只分低/中/高三档触觉，封顶 | 否 |
| nudge | 更软、更短 transient | 对齐回弹，不要 error | fallback `soft` |
| ui | selection 或极轻 transient | 设置/菜单取值变化 | **Selection** 语义对 |
| win | 短 pattern（可 2 下 transient） | 对齐结算，可略晚 | 可用 **Success**（稀、真是任务完成） |
| over | 短、偏钝 | 对齐失败层 | 可用 **Error** 或自绘；不要每盘重 rumble |

工程约束（检索后实现时）：

- 只走已有 `haptics.*`，与 `gameSfx` 同拍。  
- 游戏内开关（HIG Make haptics optional）叠在系统开关之上。  
- 无 `supportsHaptics` 不装成功。  
- **不把具体 0.xx 写进 feel.ts**，直到真机对照音效1/2 调一版。

---

## 本轮未做（首轮检索后）

- 未改 `src/game/*` / 插件。  
- 未在真机上量 intensity。  

下文为 **反查 → 改计划 → 再检索 × 3**。

---

## 反查循环（三轮）

### 循环 1 — 缺口 → 计划 → 检索

**反查（首轮结果漏了什么）**

| 缺口 | 为何要紧 |
|------|----------|
| WWDC19 三原则原文未进 A 表 | 计划写了 causality，结果用 HIG 同义句顶上 |
| Transient 要不要 duration；Attack/Decay 对短震有无意义 | 积木词典没闭合 |
| `UIFeedbackGenerator.prepare()` vs 本仓库「不要 prepare」 | 两套 API，容易继续接错 |
| Engine 与 `AVAudioSession`、后台停机 | 我们已有独立 native-audio |
| intensity 官方比喻 | 「不打扰」缺官方量词 |
| HIG Feedback / Motion 父页 | 无障碍：震不能当唯一通道 |

**补进计划的 Query**

| 查 | URL |
|----|-----|
| WWDC19 Designing Audio-Haptic Experiences：causality / harmony / utility | [session 223](https://developer.apple.com/videos/play/wwdc2019/223/)（口播；笔记仅 B） |
| WWDC19 Introducing Core Haptics：引擎先 start、stoppedHandler | [session 520](https://developer.apple.com/videos/play/wwdc2019/520/) |
| `hapticTransient` 无 duration 也完成 | [hapticTransient](https://developer.apple.com/documentation/corehaptics/chhapticevent/eventtype/haptictransient) |
| intensity = 触觉的 volume；sharpness 圆/脆 | [hapticIntensity](https://developer.apple.com/documentation/corehaptics/chhapticevent/parameterid/hapticintensity) · [hapticSharpness](https://developer.apple.com/documentation/corehaptics/chhapticevent/parameterid/hapticsharpness) |
| continuous 最长 30s | [duration](https://developer.apple.com/documentation/corehaptics/chhapticevent/duration) |
| UIKit `prepare()`：提前、不要立刻连打；打完会 idle | [prepare()](https://developer.apple.com/documentation/uikit/uifeedbackgenerator/prepare()) |
| 共用 session vs 只播触觉传 `nil` | [init(audioSession:)](https://developer.apple.com/documentation/corehaptics/chhapticengine/init(audiosession:)) |
| 后台 / 电话打断 → stoppedHandler，须再 start | [Preparing your app…](https://developer.apple.com/documentation/corehaptics/preparing-your-app-to-play-haptics) · [StoppedReason](https://developer.apple.com/documentation/corehaptics/chhapticengine/stoppedreason) |
| 反馈要多通道 | [HIG Feedback](https://developer.apple.com/design/human-interface-guidelines/feedback) · [HIG Motion](https://developer.apple.com/design/human-interface-guidelines/motion) |

**检索结果（循环 1）**

| 级 | 事实 | 源 |
|----|------|-----|
| A | 三原则：**Causality**（必须看得出是什么引起的）、**Harmony**（feel the way they look, the way they sound）、**Utility**（只加有明确价值的；能不加就别加，否则淹没重点） | WWDC19 Designing Audio-Haptic Experiences 口播；WWDC21 Practice audio haptic design 复述同一三原则 |
| A | Transient **即使没有 duration 也会自己结束** | hapticTransient Discussion |
| A | Intensity 0=弱 1=强；官方把它想成触觉的 **volume** | hapticIntensity |
| A | Sharpness 低=round and organic，高=crisp and precise（与 HIG 一致；AHAP「tingly/persistent」是另一句，设计时以 HIG/ParameterID 这句为准） | hapticSharpness |
| A | Continuous 最长 **30 秒** | CHHapticEvent.duration |
| A | UIKit `prepare()`：先进入短时准备态，**再**触发才降延迟；**prepare 完立刻 impact 没有好处**；打完马达 idle；几秒内还要打就再 prepare | UIFeedbackGenerator.prepare() |
| A | 已有 `AVAudioSession` 则 `CHHapticEngine(audioSession: shared)` 才能跟 App 其它音频同 mute/路由。**只要震动、不要引擎出声：传 `nil`** | init(audioSession:) |
| A | 外部停机（音频打断、进后台、idleTimeout、systemError）走 `stoppedHandler`；停是正常生命周期，**下一发之前必须再 start** | Preparing your app… |
| A | StoppedReason：`audioSessionInterrupt` / `applicationSuspended` / `idleTimeout` / `systemError` / `engineDestroyed` / `gameControllerDisconnect` / `notifyWhenFinished` | StoppedReason |
| A | 官方：后台 **不能** 继续播 Core Haptics | Apple 工程师 Forums 回复（辅；主证据仍是 stoppedHandler + 前台才播） |
| A | 颜色+文案+声音+震动一起给，人静音或没看屏仍能收到。震是通道之一，**不能当唯一反馈** | HIG Feedback |
| A | 运动可关；重要信息不要只靠动画，用 haptics **和** audio 补 | HIG Motion |
| B | HapticPalette：X=sharpness Y=intensity，连续事件用动态参数乘 intensity | Updating Continuous and Transient…（连续调参；我们逐步棋用不到长按拖动） |
| D | 第三方把 Harmony 写成「必须同一 CSS 帧」 | 非 Apple 原文。HIG 只要求和谐与对齐气质；实现上仍按本仓库音效同拍（C） |

**补进采用方案：** 引擎应 **plays haptics only / `audioSession: nil`**，声音走现有 `native-audio`，避免两套音频抢 session。UIKit `prepare()` **只适用于 Feedback Generator**，不是插件 JS `prepare()`，也不是每步棋前调。连滑若走 UIKit fallback：pointer **began** 时 prepare 一次，不是 commit 当下才 prepare。

---

### 循环 2 — 缺口 → 计划 → 检索

**反查（循环 1 之后仍开着）**

| 缺口 | 处理 |
|------|------|
| Core Haptics 是否也「只告知系统、可不播」 | UIKit 文档写得很清；CH 是否同一套要查 capabilities / muted |
| `playsHapticsOnly` / `isMutedForHaptics` 行为 | 循环 1 计划写了但页几乎无正文 |
| 参数省略时的 **默认数值** | AHAP 说有 default，没给 0.5 还是 1 |
| 无障碍是否有单独「减弱震动」 | 系统 Haptics 开关已有；Reduce Motion 是否连带 |
| WKWebView 多一跳延迟 | 预期无 Apple 游戏文档；标 C |
| 合档映射该抬 intensity 还是 sharpness | Bounce 样例要再对一次是否 **两参数都** 跟速度 |

**补进计划的 Query**

| 查 | 期望 |
|----|------|
| `playsHapticsOnly` `isMutedForHaptics` `capabilitiesForHardware` | Engine 页已列属性 |
| HapticBounce 是否 sharpness 也跟速度 | 碰撞样例（首轮摘要 + 检索记忆：intensity+volume；sharpness 需标明有无原文） |
| `impactOccurred(intensity:)` 0–1 | UIKit 可调强度但不改 light/heavy 语义 |
| WWDC21：small ball feel small | 和谐的具体句子 |
| Accessibility 无单独「haptic reduce」页则记下「未找到」 | 诚实闭合 |

**检索结果（循环 2）**

| 级 | 事实 | 源 |
|----|------|-----|
| A | Engine 可 `playsHapticsOnly`（忽略音频事件）、`playsAudioOnly`、`isMutedForHaptics`、`isMutedForAudio`、`autoShutdownEnabled` | [CHHapticEngine](https://developer.apple.com/documentation/corehaptics/chhapticengine) Topics |
| A | `capabilitiesForHardware().supportsHaptics` 决定有没有马达 | Preparing your app |
| A | UIKit impact 另有 `intensity` 0–1，**叠加**在 FeedbackStyle（质量隐喻）上 | [impactOccurred(intensity:)](https://developer.apple.com/documentation/uikit/uiimpactfeedbackgenerator/3183920-impactoccurredwithintensity) |
| A | 「小物体应感觉小、听着小；大的应更重」 | WWDC21 Practice audio haptic design 口播（Harmony 展开） |
| A | 不要因为能加就加，很快会 overwhelm and unpleasant | 同上 Utility |
| B | 碰撞样例概述：**velocity → transient intensity 与 audio volume**（及 decay）。概述页 **没有**写 sharpness 也跟速度；实现映射时 **intensity∥音量** 是 A，sharpness 跟速度是推断（勿升 A） | Playing Collision-Based Haptic Patterns Overview |
| — | **未找到** HIG「Reduce Motion 自动关震动」。Motion 页是动画可关、用声+触补画面。系统 Haptics 开关是另一条 | 缺口闭合为「不要把 Reduce Motion 当成震动开关」 |
| — | **未找到** AHAP 省略参数的具体默认数字 | 实现必须显式写 intensity/sharpness，不要靠缺省 |
| — | **未找到** WKWebView 触觉延迟官方数 | C：与音效一样预热引擎、批处理、禁止每步新建 engine |

**补进采用方案：** 合档优先改 **intensity（触觉音量）** 对齐音效音量/音高台阶；sharpness **跟音效套装固定**（tick vs 圆咔），不跟 2048 数字爬。UIKit fallback 用 `soft/light` + `impactOccurred(intensity:)` 压缩档，不要换 Success。

---

### 循环 3 — 缺口 → 计划 → 检索

**反查（循环 2 之后仍开着）**

| 缺口 | 处理 |
|------|------|
| 插件热路径 vs `prepare()` / engine.start | 对照 HAPTICS.md + Apple：引擎生命周期长驻，不是 JS 每步 prepare |
| 电话打断后下一滑无震 | stoppedHandler → start；C 接到插件 |
| 游戏进后台撤回一步（已有）vs 震停 | 已对齐：后台本来不该震 |
| 「出手即播」vs Harmony 跟动画峰值 | 首轮采用出手；WWDC 足球是 **碰撞瞬间** = 因果点。我们因果点是 **命令成立** 不是 pop 峰值。需用 A 钉死 |
| 连续 30s 上限是否暗示逐步棋可用短 continuous | 否：HIG 离散用短 transient；30s 是上限不是推荐 |
| 设置里震动开关 vs 系统开关 | HIG Make optional + 系统已可关；游戏开关是加一层 mute |

**补进计划的 Query**

| 查 | 期望 |
|----|------|
| Causality 足球例：cause=碰撞瞬间 | WWDC19 已取 |
| HIG：match intensity of **the animation it accompanies** | 是否逼我们等 pop？ |
| autoShutdown idle | 连滑间隙会不会被 idle 掉 |

**检索结果（循环 3）**

| 级 | 事实 | 源 |
|----|------|-----|
| A | Causality：有用的反馈必须 **看得出起因**。足球：脚碰球这一刻 → 撞击声+撞击感 | WWDC19 |
| A | Harmony：数字世界里声画触要 **手工对齐**（真实世界里因果自然对齐） | WWDC19 |
| A | HIG：match the intensity and sharpness of a haptic with **the animation it accompanies** | Playing haptics Best practices |
| C（合同仲裁） | 「伴随的动画」在本游戏是 **这一步的滑/合/nudge 整段**，不是必须等 CSS pop 峰值。因果点与音效合同相同：**出手（命令成立）**。若等 pop，声已经响完，违反 Harmony「feel the way they sound」和音效「出手即播」 | AUDIO.md + 上表两条 A |
| A | `autoShutdownEnabled`：空闲可自动停；StoppedReason 有 `idleTimeout`。停了下一发要 start | Engine + StoppedReason |
| A | WWDC520：引擎作为成员变量，**界面还在、还有触觉交互就让它跑着**；stoppedHandler 记是否要 restart | Introducing Core Haptics |
| A | UIKit：触发后 idle；几秒内还要打立刻再 `prepare()` | prepare() |
| C | 连滑很快：Core Haptics 路径保持 engine running（或 autoShutdown 后首击允许一次 start 失败重试）；UIKit fallback 在 pointerdown prepare | 上两条 |

**本轮仍不写进 feel.ts 的：** 任何 0.xx。官方只有 0–1 语义，没有「游戏默认 0.35」。

---

## 三轮后：缺口闭合表

| # | 原缺口 | 状态 |
|---|--------|------|
| 1 预制 vs 自绘 | **闭合** | 棋盘 custom transient；UI Selection；结算才可 Notification |
| 2 舒适克制 | **闭合** | 短、可关、不突然、Utility、频发会腻、系统可不播 |
| 3 声画同步 | **闭合** | Harmony + 同一因果点=出手；intensity∥音量；sharpness∥套装 |
| 4 强度空间 | **闭合语义，数值开放** | intensity=触觉音量；sharpness=圆/脆；不打扰=偏低 volume + 对的 sharpness，不是长 rumble |
| 5 叠层节流 | **闭合** | 不要自动 layer；合挤滑；同类同时分不清 |
| 6 事件表 | **闭合积木** | 全 transient；合三档 intensity；win/over 可预制 |
| 7 WWDC 三原则 | **闭合** | Causality / Harmony / Utility |
| 8 prepare 混淆 | **闭合** | UIKit prepare ≠ JS 插件 prepare ≠ 每步新建 engine |
| 9 音频 session | **闭合** | 震动引擎不要绑出声；声音走 native-audio |
| 10 后台/打断 | **闭合** | 停机再 start；后台不播 |
| 11 默认参数数字 | **闭合为必须显式写** | 官方未给缺省值 |
| 12 Reduce Motion | **闭合为不混用** | 未找到「减弱动画=关震动」 |
| 13 WKWebView 延迟 | **无法 A** | 用音频同款批处理（C） |
| 14 真机 0–1 刻度 | **仍开放** | 实现阶段真机对音效1/2 |

---

## 采用方案（三轮后最终，仍不改代码）

1. **因果点 = 出手**（与 `gameSfx` 同拍）。画面随后滑/pop 是同一事件的延续，不是第二下震。  
2. **积木 = 短 transient。** 不用逐步 continuous。  
3. **滑** 最轻（Utility：关掉才缺）。**合** 只抬 intensity 三档并封顶。**sharpness 跟音效套装，不跟数字。**  
4. **一拍一条，合挤滑**（官方 layer 分不清）。  
5. **ui = Selection。** win/over 才可 Success/Error，可略晚对齐结算层。  
6. **游戏内可关** + 信任系统 Haptics 开关；无马达不装成功。  
7. **引擎长驻**，stoppedHandler 后 start；`audioSession: nil` / haptics-only。  
8. **显式 intensity/sharpness。** UIKit fallback：pointerdown `prepare()`，style 用 soft/light + intensity，禁止每步 Success。  
9. 无障碍：震是附加通道，滑/合仍要有声或画面。

实现另开；本文不再扩 Query，除非真机调参发现与 A 源冲突。

---

## 自洽评估（2026-09-02）

对照：本文前后文、[AUDIO.md](./AUDIO.md)、`gameSfx` / `AudioBatcher`、`game2048.ts` 出手点、[MOTION.md](./MOTION.md) 手感、[HAPTICS.md](./HAPTICS.md)、`plugins/native-haptics/AdvancedHapticsPlugin.swift`。

**总判：规范层大体自洽，可以当实现合同；文档内部有两版方案表；与音效/插件有几处必须先仲裁，否则一接线就会打架。**

### 1. 文档内部

| 项 | 判 |
|----|-----|
| 因果点出手 vs HIG「伴随动画」 | **已仲裁（C）**，三轮后方案为准。实现只读文末 9 条，不读中段第一张事件表当终稿 |
| 文中两张「采用方案」 | **不自洽**。前表 win 可 2 下 transient；后表可 Notification Success。须定一：结算层用预制 Success/Error，棋盘不用第二下震 |
| 合三档 intensity vs 「感受与音效相同」 | **有意压缩，需说清**。音效合 10 档音高、音量恒 1；震动不跟 10 档走。相同的是 **事件/时刻/软硬（sharpness∥套装）**，不是档位数 1:1 |
| 滑「最轻固定」vs 音效 `slide(cells)` 音量 0.70–0.86 | **未对齐**。声已随行程 1–3 格微升。Harmony 要求小的听着小、感觉小 → 滑的 intensity 也应 1–3 微档，且 **永远低于合的最低档** |
| Utility「能不加就别加」vs 每步都震 | **弱张力**。用「滑轻到关掉才缺」压住。手感1 `sameDirRepeat` 连发时仍可能腻，实现要跟音效同一 cooldown，不能比声更勤 |
| 「同一微任务 flush」vs 「Harmony 不是同一 CSS 帧」 | **自洽**：官方不要求同帧；本仓库要求与 `gameSfx` 同拍（C） |

**裁定（评估后写入合同）：** 终稿 = 文末 9 条 + 滑 intensity 随 `cells` 微升但封在合之下 + 结算只用 Notification、不再叠第二套 custom pattern。

### 2. 与音效 / 出手代码

| 现行 | 震动规范 | 判 |
|------|----------|-----|
| `playBoardSfx`：有合只 `merge`，无合 `slide(cells)` | 合挤滑、一拍一条 | **自洽**。震动应挂在 `playBoardSfx` 同一函数，禁止另写一套 if |
| 出手即 `playBoardSfx`，不等 `travel` | 因果点=出手 | **自洽** |
| `win` 在 `travel+80`；`over` 1200ms | 结算可略晚 | **自洽** |
| `nudge` 无效步立刻播，busy 时 `tryDir` 直接 return | 不突然、不busy里判 | **自洽** |
| `spawn` 延迟另声 | 事件表 **漏了 spawn** | **漏**。Utility：新块出现已有弱声；再震易过用。**默认 spawn 不震** |
| `setPack` 预听 merge | sharpness 跟套装 | 切音效套装时应 **预听对应 sharpness 的一下合**，否则设置页声画触裂开 |
| `AudioBatcher` 合挤滑、cooldown、busy 窗口、微任务 flush | 「像 AudioBatcher」 | **规范有、震动侧零实现**。每发 `stackImpact` = 一次桥，违反工程热路径 **和** 本文「批处理」 |
| `audio.setEnabled` 与 `haptics.setEnabled` 各有开关 | 游戏内可关震 | API 已有；设置 UI **只有音效套装，没有震开关**。接线时要补，且关音效 **不要** 误关震（HIG：多通道） |

### 3. 与手感 / 运动

| 项 | 判 |
|----|-----|
| 手感1 距离连走 vs 手感2 每按下一步 | 事件相同、频率不同。规范未分手感，**可接受**：震跟出手走，不跟手感旋钮另调 |
| pop 120–200ms | 不在峰值补第二下震 | **自洽**（已仲裁） |
| 后台撤回该步 | 后台本不播震 | **自洽** |

### 4. 与插件（已接上的真源）

| 插件现状 | 本文规范 | 判 |
|----------|----------|-----|
| `playsHapticsOnly = true`，`isAutoShutdownEnabled = false` | haptics-only、引擎长驻 | **已自洽** |
| `CHHapticEngine()` 无 `audioSession:` | 只要震传 `nil` | **基本自洽**（默认 init ≈ 不绑共享 session） |
| `stoppedHandler` 只把 `isEngineRunning=false`，下一发 `ensureEngineRunning` 再 start | 停机后下一发再 start | **自洽** |
| `playTransient` 显式 intensity+sharpness | 必须显式 | **自洽**（`stackImpact` / `playTransient`） |
| `impact()`：`prepare()` **紧接着** `impactOccurred()` | Apple：立刻连打无降延迟；fallback 应 pointerdown prepare | **打架**。HUD/UIKit 路径违反 A 源。棋盘主路径应走 `stackImpact`，不要走 `impact()` |
| `impact` 默认 **medium** | 棋盘不用 medium/heavy | **打架**（若有人拿 HUD 写法抄进棋盘） |
| `playPattern` 缺省 0.5/0.5 | 不要靠缺省 | **弱打架**。JS 必须传值 |
| 无原生 batch flush | 要像 AudioBatcher | **缺口**。实现要么 JS 微任务合并成一次 `playPattern`，要么扩插件 `flushHaptics`（改 Swift 须 bootstrap） |
| JS `haptics.prepare()` 仍存在 | 不用它当验收 | **文档自洽、API 易误导**。玩法禁止 await prepare |

### 5. 与无障碍 / 克制

关音仍要有画面；关震仍要有声。现行关音走 `audio.setEnabled`，画面始终在。**自洽**，只要不要把两开关绑死。

iPad `supportsHaptics == false`：插件 `stackImpact` 直接 resolve 空操作，**不要**当成功去降音量补偿（除非另做 C）。HIG 说无马达可加强音频——本游戏音效已独立，**不因无震而自动加大音量**（避免桌面预览突然变吵）。

### 6. 评估结论（实现前清单）

**保持：** 出手同拍、transient、合挤滑、sharpness∥套装、合 intensity 三档封顶、结算 Notification、引擎现状（hapticsOnly + 不 autoShutdown）。

**实现前改规范（本文已在本节省定）：**

1. 滑 intensity 随 `cells` 1–3 微升，上限 < 合档低。  
2. spawn 不震。  
3. 结算：win=`notification('success')`，over=`notification('error')`，不再 custom 双击。  
4. 与 `playBoardSfx` 同函数触发；批处理镜像 `AudioBatcher`（合挤滑 + cooldown）。  
5. 棋盘禁止 `haptics.impact('medium')`。  
6. 设置：震动开关独立于音效；切音效套装预听一下对应 sharpness。

**不自洽但留到真机：** 0–1 具体值；WKWebView 多一跳是否要原生 flush。

**插件暂不改**（除非批处理证明桥太慢）：`impact` 的 prepare-立即打只影响 HUD，不要抄进棋盘即可。
