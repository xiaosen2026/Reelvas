# GitHub 开源文案（可直接粘贴）

## Repository description（简介一行）

```
Reelvas — 短剧 AI 无限画布：节点工作流 + Copilot Agent + MCP 操作当前打开页（Next.js / Electron）
```

## Topics（标签）

```
short-drama, ai-canvas, node-editor, nextjs, electron, mcp, copilot, react, typescript, open-source
```

## About / Website

- Homepage: （你的文档站或演示站，可留空）
- 勾选：Releases / Packages 按需

---

## README 首屏（已写入仓库 README.md）

核心卖点 4 句：

1. **无限画布**：自研节点引擎，短剧分镜 / 文图视音频链路  
2. **Copilot Ask / Agent**：搭工作流、改节点参数、提交生成  
3. **MCP 桥**：Claude Code / Codex 操作**当前打开的页面**  
4. **无预置密钥**：渠道 Key 用户自填；免费 Edge TTS 可用  

---

## 截图说明（上传到 `docs/screenshots/` 后嵌入 README）

| 序号 | 建议文件名 | 画面内容 | 配文 |
|------|------------|----------|------|
| 1 | `01-editor-empty.png` | 空画布 + 顶栏用量胶囊 + 左侧工具 | 冷启动编辑器 |
| 2 | `02-copilot-agent.png` | 右侧 Copilot，会话在上、工具在下 | Agent 对话与 tool 时间线 |
| 3 | `03-nodes-pipeline.png` | 文本→图→视频 连线流水线 | 节点工作流 |
| 4 | `04-settings-mcp.png` | 设置 · 通用 · MCP 控制（`ws://localhost:3000/...`） | 外部 Agent 桥状态 |
| 5 | `05-agent-perm.png` | 生成权限弹窗（无 emoji 文案） | Agent 授权 |

README 插入示例：

```markdown
## 截图

![编辑器](docs/screenshots/01-editor-empty.png)
![Copilot](docs/screenshots/02-copilot-agent.png)
```

---

## Release 说明模板（v0.2.0）

**标题**：`v0.2.0 — Copilot Agent · MCP 画布桥 · 开源清理`

**正文**：

```markdown
## 亮点
- Copilot Ask / Agent：画布 tool（读写节点、submit 生成、ask_user、上下文总结）
- MCP：`npm run mcp:canvas` 操作**当前打开页**
- Skill：Claude Code + Codex 双份
- 顶栏用量统计美化
- 移除源码中的默认 API Key；渠道需用户自填

## 运行
- 浏览器：`npm i && npm run build && npm run serve:tts`
- 桌面：解压/运行 `dist/win-unpacked/Reelvas.exe`（需本机已 build 出 out/）

## 安全
若你曾 fork 含密钥的历史版本，请在网关侧轮换 Key。
```

**附件**：可将 `dist/win-unpacked` 打成 zip 上传（注意体积与 Electron 许可）。

---

## 首次提交建议命令

```bash
cd D:/B_2026-7/cavas
git init
git add .
git status   # 确认无 .env / dist / node_modules / sk-
git commit -m "chore: initial open-source release of Reelvas"
# 创建空仓库后：
git branch -M main
git remote add origin https://github.com/<you>/reelvas.git
git push -u origin main
```

## 清理清单（已做）

- [x] 删除 build-log* / 探针 mp3 / 调试 png / *.bak / 一次性 fix 脚本  
- [x] 默认渠道 `apiKey: ''`，去掉硬编码 `sk-…`  
- [x] 默认网关不再写死第三方域名  
- [x] `.gitignore` 覆盖 dist / out / .env / 调试垃圾  
- [x] README 开源向重写  

## 你还需要做

1. **轮换**曾暴露在旧代码里的 API Key（若该 Key 仍有效）  
2. 本地截图 5 张放入 `docs/screenshots/`  
3. 增加 `LICENSE`（如 MIT）  
4. `git init` 后推送到 GitHub  
5. 可选：用管理员权限开「开发者模式」后再打 portable 安装包（当前已产出 `dist/win-unpacked/Reelvas.exe`）
