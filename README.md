# 世界书 Swipe 与 QR 切换

开场白 Swipe 互斥绑定世界书条目；游玩途中通过输入框上方**前缀栏**切换；可视化面板管理绑定、抓取规则与条件。

## 安装

### 前提

请先安装 [酒馆助手 (JS-Slash-Runner)](https://github.com/n0vi028/JS-Slash-Runner)，版本 **4.8.19+**。

### 扩展管理器安装（推荐）

1. SillyTavern → **扩展** → **Install Extension**
2. 粘贴：`https://github.com/Nancyindaeyo/WorldbookSwipeQrSwitch`
3. 刷新页面 → 启用 **世界书Swipe与QR切换**

拓展由 **bootstrap 直载** `index.js`，**不会**在酒馆助手脚本树中注册条目。

可能产生双实例，且无 lifecycle 清理。

## 使用

| 入口 | 说明 |
|------|------|
| 扩展菜单 | **世界书Swipe与QR切换** |
| 0 楼消息按钮 | 图层图标 → 打开绑定面板 |
| 其他楼消息按钮 | 书签图标 → 设为开场白 |
| 输入框上方 | 前缀切换栏（如 `现代` `修仙`） |

## 条目命名

默认按 `前缀_` 格式，例如 `现代_人设`、`修仙_背景`。前缀按长度降序匹配。

## 本仓库文件

| 文件 | 说明 |
|------|------|
| `manifest.json` | SillyTavern 扩展清单 |
| `bootstrap.js` | 扩展入口、生命周期 hooks |
| `index.js` | 打包后的功能 bundle |
| `changelog.json` | 版本更新说明 |

源码维护于 monorepo 的 `src/世界书Swipe与QR切换/`，**不会**被 ST 直接执行。

## 卸载

在扩展列表删除本拓展 → 自动清理 DOM 与前缀栏。

## 发版

维护者执行：

```bash
pnpm build:wb-swipe-qr
```

将 `WorldbookSwipeQrSwitch/index.js` 提交到 GitHub 发布仓库。
