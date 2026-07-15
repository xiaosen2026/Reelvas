# Reelvas — Agent / Copilot 强制规则

## 本地调试启动（强制，仅 2 种模式）

本项目为 Next.js `output: 'export'`。**免费 TTS 落盘**依赖 Node 侧 `POST /api/free-tts` 或 Electron IPC `tts:free`。

**调试 / 预览 / 验证 TTS 时，只允许下面两种启动方式：**

| 模式 | 命令 | 说明 |
|------|------|------|
| **1. serve:tts** | 先 `npm run build`，再 `npm run serve:tts`（或 `node scripts/serve-with-tts.js`） | 提供 `out/` 静态资源 + `/api/free-tts` |
| **2. Electron** | `npm run electron` 或 `npm run app`（build + electron） | 主进程 IPC `tts:free`，preload `freeTts` |

### 禁止（Agent 与人工调试均不得使用）

- `npx serve out` / `npx serve out -l 3000`
- 任意**纯静态** HTTP 服务（无 `scripts/serve-with-tts.js`、无 `/api/free-tts`）
- 把「静态模式」当成正式调试入口

原因：纯静态没有 free-TTS 代理，浏览器直连 Edge TTS 会 403，只能系统朗读，**无法生成可下载 mp3**。

### 允许的例外

- `npm run dev`：仅改 UI/逻辑的热更新开发；**不要**用它验证 free TTS 落盘。
- 需要 free TTS 真实 mp3 时：必须切回 **serve:tts** 或 **Electron**。

### Agent 自检

启动或让用户打开 `http://localhost:3000` 前：

1. 确认端口进程是 `node scripts/serve-with-tts.js`，或当前是 Electron 窗口。
2. 若发现 `serve out` / 纯静态，**先停掉**，改为 `npm run serve:tts`（必要时先 `npm run build`）。
3. 禁止再建议用户 `npx serve out`。

## 媒体预览节点自适应（强制）

Image / Upload / Video（及后续同类预览节点）**必须**统一：

- 只用 `components/editor/nodes/fitMediaNodeSize.ts`（`MEDIA_NODE_BASE_WIDTH=500`、`mapNodeMediaSize`）
- 图片 `onLoad` / 视频 `onLoadedMetadata` 后写回节点 `style.width/height`
- 预览用 `object-cover`；禁止各节点硬编码不同基准宽；禁止只改 object-fit 不改外框

详情见 `CLAUDE.md` →「媒体预览节点自适应」。

## 其它项目约束摘要

- 回复简体中文；单文件 ≤300 行；无裸 `console.log`（用 `lib/logger`）。
- 禁止无用户要求的付费 API 探测（避免超额扣款）。
- 不擅自 `git commit`，除非用户明确要求。
