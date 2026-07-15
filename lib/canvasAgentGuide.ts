// 外部 Agent（Codex / Claude Code）操作当前打开画布的指南 Markdown

export const CANVAS_AGENT_GUIDE_FILENAME = 'AI生成画布操作指南_V1.md';

export function buildCanvasAgentGuideMarkdown(opts?: {
  projectRoot?: string;
  bridgePort?: number;
}): string {
  const root = opts?.projectRoot || 'D:/B_2026-7/cavas';
  const port = opts?.bridgePort || 3000;
  const mcpScript = `${root.replace(/\\/g, '/')}/scripts/mcp-canvas-server.js`;

  return `# Reelvas 画布 MCP 操作指南 V1

> 目标：用 **Claude Code / Codex / 其它支持 MCP 的 AI IDE** 操作**用户当前已打开**的 Reelvas 编辑器页面（不是另起一个离线状态）。

## 前置条件

1. 本机已安装 Node.js
2. 已打开 Reelvas 画布页（任选其一）：
   - 浏览器：\`npm run serve:tts\` 后访问 http://localhost:3000/editor/_
   - 或 Electron：\`npm run electron\`
3. 编辑器右上角设置 → **Agent** 中可看到「MCP 桥」状态；页面会自动连 \`ws://127.0.0.1:${port}/reelvas-canvas-bridge\`

## 架构（务必理解）

\`\`\`
Claude Code / Codex
    │  MCP stdio
    ▼
scripts/mcp-canvas-server.js
    │  WebSocket JSON
    ▼
本地桥 ws://127.0.0.1:${port}/reelvas-canvas-bridge
    │  tool_request / tool_response
    ▼
【当前浏览器/Electron 里打开的画布页】
    │  executeCanvasTool + WorkflowHandle
    ▼
真实 nodes / edges / 提交生成
\`\`\`

- **没有打开画布页** → 所有写操作会失败，请先 \`canvas_status\`
- **操作的是当前页**，不是磁盘上某个 JSON 文件的离线拷贝

## 安装 MCP

### Claude Code

项目或用户配置（示例 \`.claude/settings.json\` / Claude Desktop MCP）：

\`\`\`json
{
  "mcpServers": {
    "reelvas-canvas": {
      "command": "node",
      "args": ["${mcpScript}"],
      "env": {
        "REELVAS_BRIDGE_PORT": "${port}"
      }
    }
  }
}
\`\`\`

### Codex / 其它 Agent Skills 客户端

1. 安装 skill 目录（见文末「Skill 适配」）
2. 注册同名 MCP server \`reelvas-canvas\`（command/args 同上）
3. 在对话中说明：操作 **当前已打开的 Reelvas 画布**

## 推荐工作流

1. \`canvas_status\` — 确认画布在线
2. \`read_canvas_summary\` — 看现有节点，避免重复创建
3. 业务目标清晰 → \`build_workflow\`（优先）
4. 精细改参 → \`get_node\` → \`update_node\` → \`submit_nodes\`
5. 布局混乱 → \`layout_nodes\`

### 意图 → menu_type

| 用户说法 | menu_type |
|---------|-----------|
| 上传/原图/参考 | upload |
| 文案/剧本/提示词 | text / input / script |
| 生图/抠图/海报 | image |
| 增强/超分 | upscale |
| 扩图 | outpaint |
| 视频 | video |
| 配音 | tts / audio |
| 分镜 | storyboard |
| 便签 | note |

### 示例：搭一条短剧流水线

\`\`\`text
1) canvas_status
2) build_workflow
   title: 短剧试镜
   steps:
     - menu_type: text, label: 角色卡, prompt: ...
     - menu_type: image, label: 关键帧, prompt: ...
     - menu_type: video, label: 镜头01, prompt: ...
3) get_node { ids: ["..."] }
4) update_node { id, data: { prompt: "更具体的运镜..." } }
5) submit_nodes { ids: ["image节点id"] }
\`\`\`

## 工具清单（MCP）

| 工具 | 说明 |
|------|------|
| canvas_status | 桥与画布是否在线 |
| read_canvas_summary | 节点/连线摘要 |
| list_node_types | 可创建类型 |
| list_node_fields | 可写 data 字段 |
| get_node | 读节点 |
| update_node / update_nodes | 改参 |
| submit_nodes | 真正点生成 |
| create_nodes | 创建节点 |
| connect_nodes | 连线 |
| delete_nodes | 删除 |
| layout_nodes | 排布 |
| build_workflow | 一键流水线 |

## 安全与权限

- 只监听 \`127.0.0.1\`，不暴露公网
- 生成类提交仍受用户在画布里勾选的 **image/video/audio 权限** 约束
- 破坏性操作（delete）请二次确认用户意图
- 不要编造「已生成成功」——以 tool 返回的 ok/result 为准

## Skill 适配

### Claude Code

将仓库内 \`.claude/skills/reelvas-canvas/SKILL.md\` 拷到项目 \`.claude/skills/\` 或用户 skills 目录。
Agent 会在「操作 Reelvas 画布 / 短剧工作流」类任务时自动匹配 description。

### Codex

将 \`.agents/skills/reelvas-canvas/SKILL.md\` 拷到 Codex 扫描的 skills 目录（如 \`.agents/skills/\`），
并确保 MCP \`reelvas-canvas\` 已配置。Skill 正文要求：先 canvas_status，再读写当前页。

## 故障排查

| 现象 | 处理 |
|------|------|
| canvasConnected: false | 打开编辑器页面；确认 serve:tts 或桥端口 ${port} |
| 工具超时 | 页面是否卡死；刷新后重连 |
| submit 无反应 | 节点类型是否支持生成；是否已 update prompt；权限是否勾选 |
| EADDRINUSE | 已有 serve:tts 占用桥端口属正常；MCP 会连已有桥（见 mcp 脚本日志） |

## 版本

- Guide: V1
- Bridge default port: ${port}
- Server: scripts/mcp-canvas-server.js
`;
}

/** 浏览器下载用 */
export function downloadCanvasAgentGuide(): void {
  if (typeof document === 'undefined') return;
  const port =
    typeof window !== 'undefined' && Number(window.location?.port || 0) > 0
      ? Number(window.location.port)
      : 3000;
  const md = buildCanvasAgentGuideMarkdown({
    projectRoot: 'D:/B_2026-7/cavas',
    bridgePort: port,
  });
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = CANVAS_AGENT_GUIDE_FILENAME;
  a.click();
  URL.revokeObjectURL(url);
}
