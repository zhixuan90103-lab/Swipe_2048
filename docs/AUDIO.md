# 音效

配套：[AGENTS.md](../AGENTS.md) · [ENGINEERING.md](./ENGINEERING.md) · [IMPLEMENTATION.md](./IMPLEMENTATION.md)

桌面 **WebAudio**；iOS **`plugins/native-audio/`**（AVAudioEngine）。热路径禁止 `new Audio()`、禁止每发一次桥、iOS 生产禁止 WebAudio。

iOS session：`.ambient` + `.mixWithOthers`（与后台音乐共存）。**不要** `.duckOthers`，否则一进游戏就把其他 App 音量压低。静音拨片仍会静音本游戏效。

---

## 0. 现行产品

设置里两套，默认 **音效2**。`localStorage swipe2048.sfx.pack`。

| | 音效1 短tick | 音效2 长按（默认） |
|--|--|--|
| 目录 | `public/sfx/v2/` | `public/sfx/v3/` |
| 气质 | UI SFX Minimal（CC0） | iOS 长按图标那种干咔 |
| 合/滑样本 | `snap` 按档升音 | ~2 kHz 合成 pop，起音圆、少齿音 |
| 生成 | 从 uisfx 转 wav | `scripts/synth-ios-pop.py` |

**播放规则（两套相同）**

1. 有效滑动：有合并 → **只播最高一块的合**；没有 → 播滑。  
2. 合后下一次滑沿用该档音高（同一声部）。  
3. 出手即播，不等滑移/弹峰。  
4. 同时只保留一条合/滑；新声起、旧声约 18ms 让路。  
5. 无效回弹 `nudge`；菜单 `ui`。过关/失败对准结算，可略晚。

合档（新块数字）：4→0 … 2048→9，C 大调台阶。

业务只调 `gameSfx.*`，不碰播放器。

---

## 1. 卡顿从哪来

- 热路径 `new Audio()` / 读盘 / `decodeAudioData`
- 每发一次 Capacitor 桥
- iOS 上 WebAudio 和 WKWebView 抢 `AVAudioSession`

正确：**Loading 预解码 + 微任务攒一次 flush + 原生 PlayerNode 池**。

## 2. 分层

| 层 | 路径 |
|----|------|
| 业务 | `src/utils/gameSfx.ts` |
| 门面 | `src/audio/AudioManager.ts` |
| 目录 | `src/audio/AudioCatalog.ts` |
| 批处理 | `src/audio/AudioBatcher.ts`（微任务，有单测） |
| Web | `src/audio/WebBackend.ts` |
| iOS JS | `src/audio/IosBackend.ts` |
| 原生 | `plugins/native-audio/` → `ios:bootstrap` |
| 资源 | `public/sfx/v2/` · `public/sfx/v3/` |

改 Swift 走 `ios:bootstrap`，不要手改 pbxproj。

## 3. 流水线

```
gameSfx.merge / slide / nudge / ui
  → 关音 / 未 ready 则排队
  → AudioBatcher（同 key 本拍一条；合挤掉滑）
  → 微任务 flush（绘制前）
  → iOS NativeAudio.flushSfx | Web BufferSource.start
```

`main.ts`：`audio.preload()` + 首次 pointer `unlock()`。

## 4. 验收

- 设置切 **音效1 / 音效2**，点一下有预听。  
- 滑、合、撞墙立刻有声，合比滑优先。  
- 合 4、8、16 能听出台阶。  
- 真机：插件与震动一样要 `BridgeViewController`；不要用 WebAudio。
