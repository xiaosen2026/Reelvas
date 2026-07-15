---
name: reelvas-canvas
description: "This skill should be used when the user wants Claude Code to control the currently open Reelvas infinite canvas editor — create/update/connect nodes, build short-drama or ecommerce workflows, submit image/video/audio generation, or inspect canvas state via the reelvas-canvas MCP server."
---

# reelvas-canvas (Claude Code)

Operate the **already open** Reelvas editor page through MCP. Do not invent offline graph state.

## Prerequisites

1. User has Reelvas open (`npm run serve:tts` → editor, or Electron).
2. MCP server `reelvas-canvas` is configured:

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

Run MCP from the Reelvas project root so the script path resolves.

## Operating rules

1. Always call `canvas_status` first. If `canvasConnected` is false, tell the user to open the editor.
2. Prefer `read_canvas_summary` before creating nodes (avoid duplicates).
3. Business goals → `build_workflow` first; fine-tuning → `get_node` → `update_node` → `submit_nodes`.
4. `update_node` does **not** generate media; only `submit_nodes` triggers generate (same as the UI button).
5. Never claim generation succeeded unless tool result says so.
6. Destructive `delete_nodes` only with clear user intent.

## menu_type map

upload | text | input | script | image | upscale | outpaint | video | tts | audio | storyboard | note

## Example

```
canvas_status
read_canvas_summary
build_workflow { title, steps:[{menu_type,label,prompt}, ...] }
update_node { id, data:{ prompt } }
submit_nodes { ids:[...] }
```

Full guide: download **AI生成画布操作指南_V1.md** from Settings → Agent, or read `lib/canvasAgentGuide.ts`.
