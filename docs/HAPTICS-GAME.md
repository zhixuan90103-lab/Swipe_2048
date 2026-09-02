# 游戏震动实现方案

日期：**2026-09-02**。  
依据：[HAPTICS-RESEARCH.md](./HAPTICS-RESEARCH.md)（含自洽评估）· [AUDIO.md](./AUDIO.md) · [HAPTICS.md](./HAPTICS.md) · 实验室 `Joystick_haptics`。  
**本页是玩法层合同。** 插件怎么接上仍以 HAPTICS.md 为准。数值是真机起点，改数字只改 `src/game/hapticFeel.ts`，不改插件。

---

## 1. 一句话

震动是音效的触觉声部：与 `gameSfx` **同一事件、同一出手拍、同一软硬**；棋盘只用 **短 transient**；合挤滑；可关。

不跟 pop 峰值、不做逐步 rumble、不抄 `impact('medium')`、不跟 10 档音高 1:1。

---

## 2. 因果点

`game2048.tryDir` 里有效步已经：`render(true)` + `playBoardSfx(...)`。

震动挂在 **同一个 `playBoardSfx`**：有合只合、无合 `slide(cells)`。nudge / ui / win / over 与现有 `gameSfx.*` 成对，delay 相同。

```
出手（命令成立）
  → playBoardSfx + playBoardHaptics   // 同函数、同拍
  → 画面开始滑/pop                    // 延续，不再震第二下
win:  travel+80
over: 1200ms
spawn: 不震
```

手感1 连走、手感2 每按一步：都只跟出手走，不另调旋钮。

---

## 3. 积木（允许 / 禁止）

| 用 | 不用 |
|----|------|
| `haptics.stackImpact(intensity, sharpness)` → Core Haptics transient | `startContinuous` / 逐步 rumble |
| 结算 `haptics.notification('success' \| 'error')` | 每步 `notification` |
| 设置/菜单 `haptics.selection()` | 棋盘 `impact('medium'\|'heavy')` |
| JS 微任务批处理（合挤滑） | 每事件裸桥；`await haptics.prepare()` |
| 显式 0–1 | 靠插件缺省 0.5 |

无 Core Haptics（插件 `stackImpact` 空成功）时：棋盘仍走 stackImpact 的 no-op；**不要**改走 UIKit impact，**不要**因此加大音量。Web：`navigator.vibrate` 已在封装里，桌面可忽略。

引擎：插件已 `playsHapticsOnly` + 关 autoShutdown。本方案 **不改 Swift**，除非真机证明合挤滑仍糊成一层再考虑原生 flush。

---

## 4. 事件表

`mergeStepFromValue`：4→0 … 2048→9。触觉与音高 **同一档指数**，强度按几何级数拉开（Weber）。

默认（真机调过）：滑 I/S 0.70；合 I 0.70–0.95、S 0.70–1.00、增长 0.50；回弹撞 0.70 / 弹 0.40 / 锐度 0.70 / 余韵 0.14。

| 事件 | 何时 | API | 参数 |
|------|------|-----|------|
| slide | 无合 | 一下 transient | 基础强度 `slideI` + 基础锐度 `slideS` |
| merge | 与音效同一 `mergeStep` 0–9 | 一下 transient | 强度/锐度各一组下限–上限，用 `mergeGrowth` 铺 10 档 |
| nudge | 无效步 | 两下，对齐动画 22% / 48% | `nudgeI` / `nudgeBounceI` / `nudgeS` |
| ui | 按钮/切模式 | `selection()` | — | — |
| win | 现 `gameSfx.win` 同时刻 | `notification('success')` | — | — |
| over | 现 `gameSfx.over` 同时刻 | `notification('error')` | — | — |
| spawn | — | **不震** | — | — |

全部滑条 **0–1**。强度/锐度原样进 Core Haptics。合档：`t = 档/9`，增长 `u∈[0,1]`（0.5=匀速）先换成 `g=2^(2u−1)`，再 `w=(g^t−1)/(g−1)`，强度/锐度 `下限+(上限−下限)×w`。

设置只有：滑 I/S，合 I 上下限、S 上下限、增长，回弹三项。旧存档键对不上则用新默认。

切音效套装时：现有 `gameSfx.setPack` 预听合声 → 同拍预听 **合低档** 一下触感。

---

## 5. 批处理（镜像音效，更狠）

新文件 `src/game/gameHaptics.ts`（或 `src/utils/gameHaptics.ts`），业务只调它。

规则（与 `AudioBatcher` 对齐，cooldown 用同一量级）：

1. 同微任务内：有 merge **丢掉** slide。  
2. 只保留 **一条** 合或滑（多组合并已在 `playBoardSfx` 取最高块）。  
3. cooldown：slide/merge ~24ms，nudge ~50ms，ui ~24ms，win/over ~400ms。  
4. busy 窗口内（滑移锁）不额外排队——`tryDir` 已 `if (busy) return`。  
5. flush 一次最多 **一条** 棋盘触感（比音频 cap 更严：马达不能叠）。  
6. 关 `haptics.setEnabled(false)` 或系统无马达：静默。

实现：`queueMicrotask` 攒一拍，flush 里调 `stackImpact` / `selection` / `notification`。禁止玩法直接 `haptics.stackImpact`。

---

## 6. 代码落点（不改插件）

| 文件 | 职责 |
|------|------|
| `src/game/hapticFeel.ts` | 套装 sharpness、slide/merge/nudge 映射、三档切分。唯一改数字的地方 |
| `src/utils/gameHaptics.ts` | 事件 API + 批处理 + enabled 持久化 |
| `src/game/game2048.ts` | `playBoardSfx` 旁 `playBoardHaptics`；nudge/ui/win/over 成对 |
| `src/game/feelPanel.ts` | **震动 开/关**（独立于音效）；切音效时预听触感 |
| `src/utils/haptics.ts` | 不改桥。玩法不调用 `impact` / `prepare` / continuous |

存储：`localStorage swipe2048.haptics.enabled`，默认 **开**。

设置文案建议：「震动」开关，说明随系统「触感反馈」；关音效不关震动。

---

## 7. 与画面 / 音效对齐检查

| 通道 | 滑 | 合 | 无效 | 结算 |
|------|----|----|------|------|
| 画面 | 滑移起势 | pop 是延续 | nudge 位移 | overlay 可晚 |
| 声 | `slide(cells)` 音量微升 | 最高档合，音高 10 阶 | `nudge` | win/over 可晚 |
| 触 | cells 微升，更轻 | 3 档 intensity | 更软更短 | Notification |

禁止：画面大 + 声轻 + 震重；合声已响再补第二下震。

---

## 8. 明确不做

- 改 `plugins/native-haptics/`（除非真机合挤滑仍糊）  
- AHAP / 音频驱动 FFT / 双 Player 侧链（实验室音乐向）  
- 手感1/2 各一套震动旋钮  
- 合 10 档各一个波形  
- spawn、连滑过程 continuous  
- 无马达加大音量  

---

## 9. 验收

真机 iPhone（模拟器不当验收）。`plugin: true`。

1. 关设置震动：棋盘完全无触，声画仍在。  
2. 关系统触感：无触，不报错。  
3. 无合滑：很轻；1 格 vs 3 格略有差别但仍轻。  
4. 合：比滑明显「到」；4 与 512 有差别，4 与 8 不必能分清。  
5. 同步有合：只感到合，没有滑+合两下。  
6. 无效 nudge：软、短，不像 error。  
7. 菜单/设置：selection 一下。  
8. 首次 2048：success 在字出来前后，不是出手当下。  
9. 失败：error 对齐失败层。  
10. 音效1 vs 2：合的「脆/圆」能分清，强度台阶仍在。  
11. 手感1 连滑：不麻、不比声更密。  
12. 进后台再回：下一滑仍有触（引擎 restart）。

真机若整体偏吵：只降 `hapticFeel.ts` 的 intensity，先动滑，再动合高档。偏肉：降 sharpness，不要加 continuous。
