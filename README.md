# portrait-webgpu-base

**最稳健竖屏底座**：合并 **niantu** 的适配/TS/设备预览 + **three-webgpu-cap-shell** 的 Capacitor 打包、安全区、bootstrap、可验证 demo。

| 文档 | 用途 |
|------|------|
| [AGENTS.md](./AGENTS.md) | AI / 新窗口第一入口 |
| [docs/README.md](./docs/README.md) | **docs 索引与规范优先级** |
| [docs/IMPLEMENTATION.md](./docs/IMPLEMENTATION.md) | 现行玩法、手感默认、改动摘要 |
| [docs/MOTION.md](./docs/MOTION.md) | 方块怎么动 |
| [docs/ENGINEERING.md](./docs/ENGINEERING.md) | 底座打包 / 适配 |
| [docs/HAPTICS.md](./docs/HAPTICS.md) | 震动接入 |
| [docs/SWIPE-GESTURE.md](./docs/SWIPE-GESTURE.md) | 同手势族调研名单 |

## 30 秒上手

```bash
cd portrait-webgpu-base
npm install
npm run dev
# → http://127.0.0.1:5204/
```

应看到：桌面手机框、紫色立方体、safe/scale 状态、右上角 **手机/Pad** 切换、底部 **点我震动**。桌面无原生马达，属正常。

## 合并了什么

| 来自 niantu | 来自 three-webgpu-cap-shell |
|-------------|----------------------------|
| TS strict | `base: './'` |
| 390×844 stage + contain | `contentInset: never` + scroll 关 |
| Phone / Pad 预览 | `--safe-*` HUD + debug |
| `clientToDesign` | `ios:bootstrap` 插件真源 |
| | 可验证 3D demo + 震动按钮 |
| AdvancedHaptics 宽 API | ENGINEERING / ENTRYPOINTS 文档结构 |
| Capacitor 8 + Three 0.178 + Vite 6 | |

## iOS 真机

```bash
npm run ios:bootstrap   # 首次
npm run cap:open
# Xcode: Team → 真机 → Run
```

日常只改网页：`npm run cap:sync`。改 Swift / 第一次：`ios:bootstrap`（会改 SceneDelegate，否则真机 `plugin: false`）。

装真机前改 `capacitor.config.ts` 的 `appId`，避免和已装 App 冲突。验收看 HUD `plugin: true` 再点 **点我震动**。

## 复用到新游戏

1. 复制本目录  
2. 改 `capacitor.config.ts` 的 `appId` / `appName`  
3. 在 `src/main.ts` 或 `src/game/*` 写玩法  
4. **保留** adapt / create-renderer / haptics / plugins / `base: './'`  
