# 截图说明（GitHub README / Release 用）

目录：`docs/screenshots/`  
分辨率约 **1440×900**，浅色主题。

| 文件 | 画面 | 建议配文 |
|------|------|----------|
| [01-editor-empty.png](./01-editor-empty.png) | 空画布 · 顶栏用量胶囊 · 左侧工具条 · 底部缩放 | 冷启动：Reelvas 无限画布 |
| [02-copilot-agent.png](./02-copilot-agent.png) | 右侧 Copilot（Agent）· 快捷操作 · 底部 Ask/Agent 与模型 | Copilot：上会话、下工具 |
| [03-nodes-pipeline.png](./03-nodes-pipeline.png) | 画布上文本 / 图片 / 视频等节点 | 节点工作流（右键创建） |
| [04-settings-mcp.png](./04-settings-mcp.png) | 设置 · 通用 · MCP 控制（桥在线、读/写开关） | 外部 Agent MCP 桥（当前打开页） |
| [04c-settings-agent.png](./04c-settings-agent.png) | 设置 · Agent · 指南下载 | Codex/Claude 操作指南入口 |
| [04d-settings-assistant.png](./04d-settings-assistant.png) | 设置 · 会话助手 · Tool 开关 | 应用内 Copilot 工具配置 |
| [05-agent-perm.png](./05-agent-perm.png) | Agent 生成权限弹窗（无 emoji） | 生图/视频/音频授权 |
| [06-sidebar-add.png](./06-sidebar-add.png) | 左侧 **+** · 添加节点菜单（文本/图/视频/TTS/3D…） | 画布侧栏 · 添加节点 |
| [06-sidebar-assets.png](./06-sidebar-assets.png) | **资产** 面板 · 导入/分类/搜索 | 画布侧栏 · 资产库 |
| [06-sidebar-history.png](./06-sidebar-history.png) | **历史版本** · 自动保存列表与预览 | 画布侧栏 · 历史 |
| [06-sidebar-workflow.png](./06-sidebar-workflow.png) | **ComfyUI 工作流** · 同款/灵感库/我的 | 画布侧栏 · 工作流 |
| [06-sidebar-clip.png](./06-sidebar-clip.png) | **剪辑编辑器** 全屏时间轴 | 画布侧栏 · 剪辑 |

## README 嵌入示例

```markdown
## 截图

### 编辑器
![空画布](docs/screenshots/01-editor-empty.png)

### Copilot Agent
![Copilot](docs/screenshots/02-copilot-agent.png)

### 节点流水线
![节点](docs/screenshots/03-nodes-pipeline.png)

### MCP 控制
![MCP](docs/screenshots/04-settings-mcp.png)

### Agent 授权
![授权](docs/screenshots/05-agent-perm.png)

### 左侧画布侧栏
![添加节点](docs/screenshots/06-sidebar-add.png)
![资产](docs/screenshots/06-sidebar-assets.png)
![历史](docs/screenshots/06-sidebar-history.png)
![工作流](docs/screenshots/06-sidebar-workflow.png)
![剪辑](docs/screenshots/06-sidebar-clip.png)
```

## 其它保留文件

- `02-copilot-panel.png` / `02b-copilot-agent.png`：Copilot 打开过程备选  
- `04-settings.png`：设置总览备选  
- `04b-settings-mcp.png`：与 `04-settings-mcp.png` 同内容备份  
- `06-sidebar-0.png` … `06-sidebar-5.png`：侧栏逐项点击过程备选  

重拍：在 `npm run serve:tts` 下用浏览器 1440×900 截图覆盖同名文件即可。
