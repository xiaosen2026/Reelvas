---
name: reelvas-canvas
description: "This skill should be used when the user wants Codex (or any Agent-Skills client) to control the currently open Reelvas infinite canvas — nodes, edges, short-drama/ecommerce pipelines, and media submit — via the reelvas-canvas MCP bridge to the live page."
license: MIT
metadata:
  version: "1.0.0"
  mcp: "reelvas-canvas"
---

# reelvas-canvas (Codex / Agent Skills)

You control the **live open browser/Electron page**, not a detached file.

## Setup

1. User opens Reelvas editor (same machine).
2. MCP:

```json
{
  "mcpServers": {
    "reelvas-canvas": {
      "command": "node",
      "args": ["scripts/mcp-canvas-server.js"],
      "env": { "REELVAS_BRIDGE_PORT": "3000" }
    }
  }
}
```

`REELVAS_BRIDGE_PORT` must match the page port (default `npm run serve:tts` → **3000**).

3. Place this skill under `.agents/skills/reelvas-canvas/` (or the client’s skills scan path).

## Protocol

1. `canvas_status` → require online canvas.
2. `read_canvas_summary` before writes.
3. Goals → `build_workflow`; edits → `get_node` / `update_node` / `submit_nodes`.
4. Layout → `layout_nodes`; remove → `delete_nodes` only if asked.
5. Report tool JSON truthfully.

## Tools

canvas_status, read_canvas_summary, list_node_types, list_node_fields, get_node, update_node, update_nodes, submit_nodes, create_nodes, connect_nodes, delete_nodes, layout_nodes, build_workflow

## Intent → menu_type

上传→upload · 文案→text/input/script · 生图→image · 增强→upscale · 扩图→outpaint · 视频→video · 配音→tts/audio · 分镜→storyboard · 便签→note

Feed the user-downloaded `AI生成画布操作指南_V1.md` when onboarding a new session.
