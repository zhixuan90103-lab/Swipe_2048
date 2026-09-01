# 四向一步滑 — 有效来源

配套：[SWIPE-GESTURE.md](./SWIPE-GESTURE.md) · [ENGINEERING.md](./ENGINEERING.md) · [AGENTS.md](../AGENTS.md)

检索三轮（合同 → OS/Web 常量 → 自洽评估）后的 **可引用清单**。  
实现手势时只准用本表 **A/B**；C 只能当玩法合同，不能当像素；D 禁止再当证据。

等级：

| 级 | 含义 |
|----|------|
| **A** | 源码 / 官方 API 文档。数字和语义可直接引用 |
| **B** | 官方或准官方工程常量（引擎、Chromium、学术测速）。可引用，注意单位 |
| **C** | 二手攻略/百科/商店文案。只证「规则/提交模型」，不证死区 px |
| **D** | 无效：教程抄作业、评测套话、闭源像素猜测 |

单位不要混：本工程常量走 **设计 px（390×844）**；下表数字保持原文单位（CSS px / iOS pt / dp）。

---

## A. 开源与官方（硬证据）

### A1 — 2048 原作（Cirulli）

操作样本里 **唯一全文可读** 的输入实现。

| 文件 | URL | 钉死的事实 |
|------|-----|------------|
| 仓库 | https://github.com/gabrielecirulli/2048 | MIT；触控由 chrisprice 所加 |
| 输入 | https://raw.githubusercontent.com/gabrielecirulli/2048/master/js/keyboard_input_manager.js | 只绑 `.game-container`；`touchend` 才 `move`；`max(\|dx\|,\|dy\|)>10`（clientX CSS px）；`absDx>absDy` 水平；多指忽略；**速度不参与**；无划回取消；`keydown` **不挡 repeat** |
| 规则 | https://raw.githubusercontent.com/gabrielecirulli/2048/master/js/game_manager.js | 仅 `moved===true` 才出新块/actuate；无效静默；**无输入锁** |
| 动画 | 仓库 `style/main.scss`（`$transition-speed: 100ms`） | 位移 100ms ease-in-out；新块 `appear 200ms` 且 delay 一个 transition-speed |
| 试玩 | https://gabrielecirulli.github.io/2048/ | 对照真机，不是商店克隆 |

**可偷：** 无效不算进度；滑距≠停点。  
**不可偷：** 10px 当提交阈值；无锁；键盘连发；无效完全静默。

### A2 — Apple UIKit / WebKit

| 文档 | URL | 钉死的事实 |
|------|-----|------------|
| UISwipeGestureRecognizer | https://developer.apple.com/documentation/uikit/uiswipegesturerecognizer | 离散、成功只回调一次；**慢滑要方向准、距离可短；快滑方向可歪、距离要长** |
| Handling swipe gestures | https://developer.apple.com/documentation/uikit/handling-swipe-gestures | 用途是水平/垂直 **导航**，不是棋盘命令 |
| Handling pan gestures | https://developer.apple.com/documentation/uikit/handling-pan-gestures | Pan 连续；`translation(in:)` 相对按下点；边缘用 `UIScreenEdgePanGestureRecognizer` |
| Coordinating recognizers | https://developer.apple.com/documentation/uikit/coordinating-multiple-gesture-recognizers | 同视图上 **Pan 先于 Swipe 成功**；要 Swipe 必须 `require(toFail:)` |
| WKWebView 历史滑 | https://developer.apple.com/documentation/webkit/wkwebview/allowsbackforwardnavigationgestures | **`allowsBackForwardNavigationGestures` 默认 `false`** |
| 推迟系统边缘手势 | https://developer.apple.com/documentation/uikit/uiviewcontroller/2887512-preferredscreenedgesdeferringsystemgestures | 游戏应推迟底边（Home / Reachability），不是关掉无障碍 |

**结论：** 棋盘用手写 pan→离散命令，不要 `UISwipeGestureRecognizer`。

### A3 — W3C / MDN（Web 画布）

| 文档 | URL | 钉死的事实 |
|------|-----|------------|
| Pointer Events `touch-action` | https://www.w3.org/TR/pointerevents/#the-touch-action-css-property | 视口平移/缩放 **不能靠 cancel pointer 关掉**，必须 CSS `touch-action` |
| MDN Using Pointer Events | https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events/Using_Pointer_Events | 画布标准：`canvas { touch-action: none }` |
| MDN `touch-action` | https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action | `none` = 禁止浏览器默认平移/缩放 |
| MDN Touch events | https://developer.mozilla.org/en-US/docs/Web/API/Touch_events | `preventDefault` 与兼容鼠标事件；推荐 Pointer Events |

本工程：`#stage` / canvas 必须 `touch-action: none`。已有 `ios.scrollEnabled: false` **不能替代** 这一条。

### A4 — 本仓库已核实配置

| 文件 | 钉死的事实 |
|------|------------|
| `capacitor.config.ts` | `contentInset: never`；`scrollEnabled: false` |
| Capacitor iOS issue #3808 | https://github.com/ionic-team/capacitor/issues/3808 — 社区要求 **打开** 历史滑 ⇒ **默认关**（与 A2 一致） |
| `src/adapt/design.ts` | 阈值必须 `clientToDesign`；letterbox 外忽略 |

真机 App 里 WK 历史滑不是默认威胁。仍要测：Home 条、Reachability、`pointercancel`。Safari **网页** 另说。

---

## B. 引擎 / OS 常量（刻度，不是棋盘最优）

用来定 **slop（不是点按）** 和 **什么叫 fling**。提交阈值不要抄 fling/翻页。

| 来源 | URL | 数字 | 单位 | 用在哪一层 |
|------|-----|------|------|------------|
| iOS pan slop（Compose 互操作写死） | https://github.com/JetBrains/compose-multiplatform-core/pull/1440 | **10** | points | 按下死区 / tap vs pan |
| Flutter issue：实验 iOS ≈10pt | https://github.com/flutter/flutter/issues/163339 | ~10 | pt | 同上 |
| Flutter `kTouchSlop` | `gestures/constants.dart`（注释：从 8 加到 18，因 8 太容易把点按当拖） | **18.0** | 逻辑 px | slop 上限参考；**不是**提交阈值 |
| Flutter `kPanSlop` | 同上 | `kTouchSlop * 2` = 36 | 逻辑 px | 更像「开始拖」 |
| Flutter `kMinFlingVelocity` | 同上 | 50 | 逻辑 px **/秒** | 极低，几乎不是「甩」 |
| Android `ViewConfiguration` | https://developer.android.com/reference/android/view/ViewConfiguration | `getScaledTouchSlop()` | px（按密度） | slop |
| Compose 默认 touch slop | `DragGestureDetector.kt` | **18.dp** | dp | slop |
| Compose `SwipeableDefaults.VelocityThreshold` | AndroidX Swipeable.kt | **125.dp** | 解释为 1.8 dp/ms 量级 | **swipe-to-dismiss**，合同外 |
| Hammer Pan | https://hammerjs.github.io （Pan 文档） | threshold **10** | px | slop 量级 |
| Hammer **Swipe** | https://hammerjs.github.io/recognizer-swipe/ | 10px **且** velocity **0.3 px/ms**；在 **INPUT_END** 才认 | px, px/ms | **不要当棋盘识别**（慢拖失败） |
| jQuery touchSwipe | http://labs.rampinteractive.co.uk/touchSwipe/docs/$.fn.swipe.defaults.html | threshold **75**；`cancelThreshold`；默认 `triggerOnTouchEnd: true` | CSS px | 翻页/取消模型；75 偏 UI |
| jQuery Mobile swipe | https://api.jquerymobile.com/swipe/ | 水平 ≥**30px**，垂直偏移 <**75px**，≤**1s** | px, ms | 只适合横向翻页 |
| Phaser rex Swipe | https://rexrainbow.github.io/phaser3-rex-notes/docs/site/gesture-swipe/ | threshold 10 + velocityThreshold 1000 | 引擎单位 | 模板，非游戏手感 |
| Chrome iOS 侧滑 | Chromium `side_swipe_ui_controller.mm` | `kSwipeEdge = 20`；`kPanGestureRecognizerThreshold = 25` | pt | 网页左缘，不是 App 默认 |
| iOS flick 测速 | Quek / Hinckley 等 *Touch Scrolling Transfer Functions* | 松手合成速度 **> 250 points/s** 判 flick | pt/s | 速度通道；v1 棋盘不用来提交 |
| UIScrollView 翻页（SO 实测） | https://stackoverflow.com/questions/48416315 | ~**300** pt/s | pt/s | 同上 |
| Material Drag/Swipe/Fling | https://m2.material.io/archive/guidelines/patterns/gestures.html | 分类：慢跟手 / 快无靶 / 过线不可悔 | 无 px | 棋盘是离散命令，不是 fling |
| Joe Cieplinski | http://joecieplinski.com/blog/2018/03/02/the-power-of-the-pan/ | 十次里九次该用 Pan 不是 Swipe | — | 实现原则 |

**分层口诀：** 10–18 是 slop；30–75 是 UI 翻页提交；250–300 pt/s 是系统 flick。棋盘提交应 **大于 slop、小于翻页**，且 v1 不用速度。

---

## C. 闭源样本（只证合同，不证像素）

公开检索 **停止向这些条目要 mm/px**。真机录像才能升级。

| 游戏 | 来源 | URL | 可引用 | 不可引用 |
|------|------|-----|--------|----------|
| **Threes!** | Wikipedia | https://en.wikipedia.org/wiki/Threes_(video_game) | 四向；走一格；可慢拖预览 | 阈值 |
| | Gamezebo 攻略 | https://www.gamezebo.com/walkthroughs/threes-walkthrough/ | 慢拖预览；划回原点取消；不能动的方向 **不算回合**（nuh-uh） | px |
| | iMore / Kotaku | https://www.imore.com/five-threes-tips-have-you-matching-expert · https://kotaku.com/tips-for-playing-threes-the-new-mobile-game-everyones-1522388747 | 同上，多源交叉 | px |
| **AMAZE!!!** | AmazeSolver README | https://github.com/jonluca/AmazeSolver | 四向；沿网格走到头；涂满；停点可建图 | 立刻提交、死区（**未证实**） |
| | App Store | `id1452526406` | 美区可装 | — |
| **House Paint** | 商店/攻略文案 | App `id1458095674`（SayGames） | 四向滑、涂白 | 走到头/3D 绕角/相机抢手势 |
| **Tomb of the Mask** | Wikipedia | https://en.wikipedia.org/wiki/Tomb_of_the_Mask | 四向滑；**撞墙前不能转向**；Switch 摇杆/D-pad | 缓冲窗口 ms |
| | 教程手势 | http://mgt.stelabouras.com/tomb-of-the-mask/ | 强制划对方向；没教下划；双击护盾 | 与短滑冲突的 px |
| | TouchArcade 评测 | https://toucharcade.com/2016/03/09/tomb-of-the-mask-review/ | 操作是滑 | — |
| | App | `id1057889290`；Arcade `id6476391931` | 真机优先打 + 无广告 | — |

**邻族（操作课，非必须装）：** Slayaway Camp 短划预演；Slider Scouts 短锁快打。见 [SWIPE-GESTURE.md](./SWIPE-GESTURE.md) 名单。

---

## D. 不要当证据（淘汰）

| 类型 | 例子 | 原因 |
|------|------|------|
| `games like 2048` 列表 | 应用商店「类似」 | 筛的是合并数字，不是手势合同 |
| 网页 2048 克隆阈值 | 随手 fork | 大多仍抄 10px，或改了不说明 |
| Android 博客 `SWIPE_THRESHOLD = 100` | 无数 GestureDetector 教程 | 翻页 + 要速度，合同外 |
| Tinder/卡片滑走 | 50px 或速度 | **行程改变结果** |
| 横版 Amaze runner | 别的游戏 | 污染 AMAZE!!! |
| 商店套话 “Swipe left, right, up and down” | House Paint FAQ | 无几何 |
| 把 nudge 2–4px、120–180ms 当调研 | 本仓库旧文 | **手感初值**，不是测量 |

---

## 对本项目的引用方式

实现/改文档时：

1. 阈值与坐标系 → A1 + 本仓库 `design.ts`（设计 px，不要写「等于 10pt」）。
2. 不用系统 Swipe → A2。
3. WebView 画布 → A3 `touch-action: none`。
4. slop vs 提交分层 → B 表；v1 建议 slop 8–12 设计 px、提交 24–40 设计 px（**建议**，真机可改）。
5. 提交时刻（松手 vs 立刻）→ 玩法选择；原作 2048 = A1 松手；AMAZE 立刻 = **C 级假设**。
6. 锁动画 → **本项目修正**，不要写成「偷自 2048」（A1 无锁）。
7. 闭源像素 → 不写进代码注释当事实。

公开网对 C 级像素 **停搜**。下一信息增量：真机录像，不是第四轮网页。
