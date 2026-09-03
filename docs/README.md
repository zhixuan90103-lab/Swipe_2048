# 文档索引

打开仓库先读根目录 [AGENTS.md](../AGENTS.md)。本页只排 docs 职责，避免两份规范打架。

| 文件 | 角色 |
|------|------|
| **IMPLEMENTATION.md** | **产品与实现现状**（玩法、两套手感、UI、现行默认、改动摘要） |
| **FEEL-LOOP.md** | **手感回路**（结束层、斜滑、慢滑锁、打断画面、系统手势互斥） |
| **MOTION.md** | **方块怎么动**（速度模型、合并/出现、字号、对象池） |
| **SWIPE-DESIGN.md** | 手势状态机（判定纯函数 + 事件层）。手感2 扩展见文首「现行产品」 |
| **SWIPE-RESEARCH-2026-09.md** | 检索计划与结论：为何两套手感、速度怎么测 |
| **SWIPE-SOURCES.md** | A/B/C/D 来源分级与 URL |
| **SWIPE-GESTURE.md** | 同手势族游戏名单（合同筛选） |
| ENGINEERING.md | 底座打包/适配 |
| MERGE.md | 双工程合并决策 |
| HAPTICS.md | 震动接入（插件怎么接上） |
| **HAPTICS-RESEARCH.md** | 震动检索：iOS 官方、舒适、与声画同一感受 |
| **HAPTICS-GAME.md** | **玩法震动实现方案**（事件、批处理、落点、验收） |
| AUDIO.md | 音效：现行两套 + 接入/热路径 |
| ENTRYPOINTS.md | 入口链 |
| UI-ORIGINAL.md | 原版截图实测：尺寸/位置/颜色 |

**规范优先级：** 手势判定以 `SWIPE-DESIGN.md` 为准；手感回路（结束层/斜滑/慢滑/打断）以 `FEEL-LOOP.md` 为准；方块运动以 `MOTION.md` 为准；默认值、模式绑定、UI 以 `IMPLEMENTATION.md` 为准；音效以 `AUDIO.md` 为准；玩法震动以 `HAPTICS-GAME.md` 为准。代码与文档冲突时改文档或改代码，不要并列两套默认。
