# Reelvas — 项目说明

短剧 AI 无限画布。自研画布引擎 + 节点 UI，Next.js 15 + Tailwind v4。

## 技术栈

- Next.js 15 (App Router, 静态导出)
- React 19
- Tailwind CSS v4 + daisyUI v5
- Electron 40 (桌面壳)
- TypeScript strict mode + bundler 模块解析

## 目录结构

```
./
├── app/
│   ├── layout.tsx              # 根布局，全局 HTML shell
│   ├── globals.css             # 设计令牌（CSS 变量）+ Tailwind @theme 映射
│   ├── editor/_/page.tsx       # 入口：直接渲染 EditorLayout
│   ├── login/                  # 登录页面
│   └── register/               # 注册页面
├── components/editor/
│   ├── EditorLayout.tsx        # 顶层容器：组装 TopBar + Canvas + 面板
│   ├── TopBar.tsx              # 标题栏：文件操作、主题切换、Copilot 开关
│   ├── CanvasInteractive.tsx   # 画布交互层：管理工具栏/帮助/模板/提示词库
│   ├── CanvasFlowCore.tsx      # 画布核心：节点/连线/右键菜单/鼠标事件管理
│   ├── Canvas.tsx              # 画布外壳：empty state + children 容器
│   ├── CanvasToolbar.tsx       # 画布工具栏
│   ├── CanvasSidebar.tsx       # 画布侧边栏
│   ├── ContextMenu.tsx         # 右键菜单：9 种节点入口
│   ├── CopilotPanel.tsx        # AI 对话面板
│   ├── AssetPanel.tsx          # 素材资产管理面板
│   ├── TrashPanel.tsx          # 回收站面板
│   ├── WorkflowPanel.tsx       # 工作流管理面板
│   ├── ClipEditor.tsx          # 剪辑器面板
│   ├── nodes/                  # 节点组件目录
│   │   ├── index.ts            # 节点注册表：nodeTypes + nodeConfigs
│   │   ├── Dropdown.tsx        # 共享下拉选择组件
│   │   ├── TextNode.tsx        # 文本生成节点
│   │   ├── ImageNode.tsx       # 图片生成节点
│   │   ├── VideoNode.tsx       # 视频生成节点
│   │   ├── AudioNode.tsx       # 音频生成节点
│   │   ├── ThreeDNode.tsx      # 3D 节点：卡片 + iframe 开源导演台
│   │   ├── TextInputNode.tsx   # 文本输入（资源）
│   │   ├── StickyNoteNode.tsx  # 便签节点
│   │   ├── CanvasNode.tsx      # 画板节点
│   │   └── UploadNode.tsx      # 上传节点
│   ├── DirectorDeskEmbed.tsx   # 开源导演台 iframe + hostBridge
│   └── flow/                   # 自研画布引擎
│       ├── types.ts            # 类型定义：FlowNode, FlowEdge, Viewport
│       ├── constants.ts        # 共享常量：缩放范围、网格步长
│       ├── index.ts            # 统一导出
│       ├── FlowContext.tsx      # React Context：setNodes + Handle 交互
│       ├── FlowCanvas.tsx       # 画布容器：视口平移/缩放/节点渲染/连线/框选
│       ├── Edges.tsx            # 连线层：SVG 贝塞尔曲线 + 动画
│       ├── Handle.tsx           # 连接点：测量偏移 + 拉线交互
│       ├── Background.tsx       # 网格背景
│       ├── MiniMap.tsx          # 小地图
│       ├── CanvasControls.tsx   # 缩放/网格/小地图控制条
│       └── PerfMonitor.tsx      # 性能监视面板
├── lib/
│   ├── workflowStore.ts        # 工作流持久化（localStorage）
│   ├── editor.ts               # Copilot 快捷操作数据
│   ├── builtinRecipes.json     # 内置配方
│   ├── builtinSkills.json      # 内置技能
│   └── settingsData.ts         # 设置面板数据
├── electron-main.js            # Electron 主进程
├── next.config.mjs             # Next.js 配置（静态导出）
├── postcss.config.mjs          # PostCSS（Tailwind v4 插件）
└── tsconfig.json               # TS 配置（path alias @/*）
```

## 设计系统

- **主题**：light / dark 两套，CSS 变量驱动
- **强调色**：最多 1 个，当前为 `--primary: #171717`
- **阴影**：上限 `shadow-sm`，禁用重阴影/渐变/花哨动画
- **圆角**：`--radius: .625rem`
- **所有样式通过 Tailwind utility class**，globals.css 仅定义设计令牌和少量核心样式

## 节点开发规范

### B 节点类型步骤

1. 在 `components/editor/nodes/` 下新建 `<NodeName>Node.tsx`
2. 实现接口：`interface NodeProps { id: string; data: Record<string, any>; selected?: boolean }`
3. 使用 `Handle` 组件暴露连接点（source/target + position）
4. 在 `components/editor/nodes/index.ts` 中注册：
   - `nodeTypes` 加 `<type>: <Component>`
   - `nodeConfigs` 加菜单 ID → 默认尺寸配置
5. 在 `ContextMenu.tsx` 中添加菜单入口

### 节点数据约定

- `data.label`: 节点标题
- `data.value`: 节点输出值（上游↓后自动填充）
- `data.tags`: 标签列表
- 各节点可扩展自有字段（如 prompt/model/preset）

### 媒体预览节点自适应（强制 · Image / Upload / Video）

凡节点卡片内展示**真实图片或视频预览**，必须按媒体真实宽高比调整节点 `style.width/height`，且**全项目统一一套算法**，禁止各节点各写一套基准宽。

| 项 | 规定 |
|----|------|
| 工具 | 只用 `components/editor/nodes/fitMediaNodeSize.ts` |
| API | `fitMediaNodeSize(w,h)` / `mapNodeMediaSize(nodes, id, w, h)` |
| 基准宽 | `MEDIA_NODE_BASE_WIDTH = 500`（固定宽，按比例求高） |
| 预览填充 | 卡片内媒体用 `object-cover`（无白边）；**禁止**用 `object-contain` 当「自适应」 |
| 触发时机 | 图片：`img.onLoad` + `naturalWidth/Height`；视频：`video.onLoadedMetadata` + `videoWidth/Height` |
| 写回方式 | `rf.setNodes(nds => mapNodeMediaSize(nds, id, w, h))`，改节点 `style`，不要只改 CSS 假适配 |
| 默认尺寸 | `nodeConfigs` 中 image / upload / video 默认宽与基准宽一致（500）；空态可先 500×500 或 16:9 占位 |

#### 禁止

- 在 ImageNode / UploadNode / VideoNode（或后续媒体节点）里硬编码不同宽度（如 360 vs 500）
- 仅改 `object-fit` 却不改节点外框尺寸（会导致裁切或白边，同资源节点大小不一致）
- 复制粘贴一套本地 `w=xxx` 自适应逻辑而不走 `fitMediaNodeSize`

#### 适用范围

- **必须**：`ImageNode`、`UploadNode`（图片）、`VideoNode`、以及后续任何「预览图/视频」节点
- **不必**：纯文本、音频波形条、无预览的表单节点

#### Agent 自检

1. 新增/改媒体预览节点时，是否 import 了 `fitMediaNodeSize` / `mapNodeMediaSize`？
2. 同资源分别放进图片节点与上传节点，外框尺寸是否一致？
3. 16:9 / 9:16 是否无裁切、无白边、外框比例正确？

## 画布引擎说明

自研引擎，不使用 `@xyflow/react`，保留 `react-flow__*` 类名做 CSS 兼容。

- 状态由 React useState 驱动，ref 缓存交互态避免 re-render
- 连线使用 SVG 贝塞尔曲线（Edges.tsx）
- Handle 偏移通过 `getBoundingClientRect` 测量并归一
- 网格吸附步长 20px（constants.ts）

## 3D 导演台（开源嵌入，禁止再写自研 gizmo）

- 已删除：`lib/director/`、`components/editor/director/`（自研 three 绑定/关节 gizmo）。
- 开源源码：`vendor/storyai-3d-director-desk`（MIT，独立 Vite/R3F，不与主包融合）。
- 构建产物：`public/director-desk/` → 静态导出后为 `/director-desk/`。
- 宿主：`ThreeDNode` → `DirectorDeskEmbed`（同域 iframe + `storyai:director-desk-*` postMessage）。
- 不要把 vendor 源码 import 进主应用；不要恢复旧 joint 绑定逻辑。

## 开发命令

| 命令 | 作用 |
|------|------|
| `npm run dev` | Next.js 开发服务器（仅 UI 热更新；**不能**验证 free TTS 落盘） |
| `npm run build:director-desk` | 仅构建开源导演台 → `public/director-desk/` |
| `npm run build` | 先 `build:director-desk`，再 Next 静态导出到 `out/` |
| `npm run director-desk:dev` | 单独跑 OSS Vite（默认 5173，调试导演台本体） |
| `npm run serve:tts` | **调试模式 1**：`out/` + `POST /api/free-tts`（`scripts/serve-with-tts.js`） |
| `npm run electron` | **调试模式 2**：Electron 桌面壳（IPC `tts:free`） |
| `npm run app` | `build` + Electron |
| `npm run dist` | 构建 + 打包 Windows exe |

## 调试启动规则（强制 · 仅 2 种模式）

**以后本地调试 / 预览 / 验证功能，只允许以下两种启动，禁止纯静态模式。**

| # | 模式 | 命令 | 何时用 |
|---|------|------|--------|
| 1 | **serve:tts** | `npm run build` → `npm run serve:tts` | 浏览器打开 `http://localhost:3000`，需要 free TTS 生成可下载 mp3 |
| 2 | **Electron** | `npm run electron` 或 `npm run app` | 桌面壳；free TTS 走主进程 IPC |

### 禁止

- `npx serve out`、`npx serve out -l 3000`
- 任意无 `/api/free-tts` 的纯静态 HTTP（如 `serve`、`http-server` 只挂 `out/`）
- Agent 不得再建议或启动「静态模式」作为调试入口

### 原因

- 静态导出本身没有 API；浏览器直连 Edge TTS 会 403。
- free 模型真实 mp3 依赖：`serve-with-tts` 的 `POST /api/free-tts`，或 Electron `tts:free` → `scripts/edgeTtsNode.js`。
- 纯静态只能退化系统朗读，无法落盘音频文件。

### Agent 自检

1. 调试前确认 3000 端口是 `node scripts/serve-with-tts.js`，或用户在 Electron 中。
2. 若是纯 `serve out`：**停掉并改用** `npm run serve:tts`（缺产物先 `npm run build`）。
3. `npm run dev` 仅用于改代码热更新；验证 free TTS 落盘必须用上表两种模式之一。

## Git 规范

- 主分支：`main`
- 提交格式：`<type>: <描述>` + `Co-Authored-By: Codex <noreply@anthropic.com>`
- 每轮任务只提交本轮修改的文件

## 代码约束

- 单文件不超过 300 行
- 禁止裸 `console.log`，使用结构化 logger
- 每个功能/职责独立文件
- 入口文件只负责组装和启动
- 修改文件前先阅读相关代码理解上下文
