# AGENTS.md — portrait-webgpu-base

> **打开本仓库时的第一入口。**  
> 合并自 **niantu**（适配/TS/预览）+ **three-webgpu-cap-shell**（打包/文档/bootstrap/可验证 demo）。

## 一句话

**TypeScript + Three.js WebGPU + Vite + Capacitor iOS** 竖屏手游稳健底座。  
设计空间固定 **390×844**，contain letterbox；桌面可切手机/Pad 预览；`base: './'` 保证真机资源路径。

## 入口地图

| 职责 | 文件 |
|------|------|
| Web 启动 | `index.html` → `src/main.ts` |
| 设计舞台 | `src/adapt/design.ts` |
| 设备预览 | `src/adapt/devicePreview.ts` |
| Safe Area | `src/adapt/safeArea.ts` + `src/style.css` |
| WebGPU | `src/create-renderer.ts` |
| 震动 JS | `src/utils/haptics.ts` |
| 震动 Swift 真源 | `plugins/native-haptics/*` |
| 震动怎么接 | `docs/HAPTICS.md` **§0 正确接入** |
| Capacitor | `capacitor.config.ts`（`contentInset: never`） |
| 构建 | `vite.config.ts`（**`base: './'`**） |
| iOS 注入 | `scripts/bootstrap-ios.mjs` |
| 音效 | `docs/AUDIO.md` · `src/audio/*` · `src/utils/gameSfx.ts` · `plugins/native-audio/` |
| 同手势调研 | `docs/SWIPE-GESTURE.md` |
| 手势有效来源 | `docs/SWIPE-SOURCES.md` |
| 四向手势状态机 | `docs/SWIPE-DESIGN.md` |
| 文档索引 | `docs/README.md` |
| 现行实现 | `docs/IMPLEMENTATION.md` |
| 方块运动 | `docs/MOTION.md` |
| 最佳手感检索 | `docs/SWIPE-RESEARCH-2026-09.md` |
| 原版 UI 实测 | `docs/UI-ORIGINAL.md` |

## DOM（勿拆）

```
#shell > #viewport > #app > #stage
  canvas          ← WebGPU
  #ui-root        ← 所有游戏 UI（safe padding）
#device-switcher  ← 仅桌面预览例外
```

## 硬性约定

1. **`vite` `base: './'`** — Capacitor 禁止绝对 `/assets/`  
2. **`webDir: dist`** 与 Vite `outDir` 一致  
3. **`ios.contentInset: never`** — Safe Area 只走 CSS  
4. **布局坐标 390×844**；禁止 `renderer.setSize(window.innerWidth,…)`  
5. **UI 只挂 `#ui-root`**；禁止玩法 UI `position: fixed` 贴浏览器窗  
6. **Pad 只改外层视口**，不改 `DESIGN_*`  
7. **改 Swift 改 `plugins/native-haptics/` 或 `plugins/native-audio/`** 再 `ios:bootstrap`。震动见 `docs/HAPTICS.md`；音效见 `docs/AUDIO.md`。Capacitor 8 的 `SceneDelegate` 必须 `rootViewController = BridgeViewController()`（默认 `CAPBridgeViewController` 不会注册插件）。不要用 JS `prepare()` 判断是否接上；真机 HUD 看 `plugin: true` + 点「点我震动」。  
8. **无 WebGPU 则明确失败**，不静默 WebGL  
9. **音效** 禁止热路径 `new Audio()` / 每发一次桥；iOS 生产禁止 WebAudio。  

## 命令

```bash
npm install
npm run dev           # http://127.0.0.1:5204/
npm run test
npm run build
npm run cap:sync
npm run ios:bootstrap # 首次 / 修插件
npm run ios
```

查询参数：`?preview=0|1` · `?debugFit=1`  
调试安全区：`document.body.classList.add('debug-safe-area')`

## 业务怎么加

- 玩法：改 `src/main.ts` 或 `src/game/*`  
- 保留：adapt / create-renderer / haptics / plugins / `base`  
- 触控：`clientToDesign` + 忽略 letterbox 外  
- 音效：按 `docs/AUDIO.md`；设置切音效1/2；合优先于滑，出手即播  

## 刻意不做

- Android（可后加）  
- WebGL 静默回退  
- 系统 UISwipe；用速度/轨迹插值 **判方向**  
