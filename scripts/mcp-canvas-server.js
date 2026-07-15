#!/usr/bin/env node
// Reelvas Canvas MCP（stdio）——操作「当前打开的画布页」
// 优先复用 serve:tts 已挂载的桥；否则本进程自建桥。

const WebSocket = require('ws');
const { attachCanvasBridge, DEFAULT_PORT, PATH } = require('./canvasBridgeHub');

// 与 serve:tts 默认 3000 一致；独立跑桥时可 export REELVAS_BRIDGE_PORT=3927
const PORT = Number(process.env.REELVAS_BRIDGE_PORT || DEFAULT_PORT || 3000);
const WS_URL = `ws://127.0.0.1:${PORT}${PATH}`;

const TOOLS = [
  {
    name: 'canvas_status',
    description: '检查是否有已打开的 Reelvas 画布页。操作前建议先调用。',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'read_canvas_summary',
    description: '只读：当前打开画布的节点与连线摘要。',
    inputSchema: {
      type: 'object',
      properties: { include_data_keys: { type: 'boolean' } },
    },
  },
  {
    name: 'list_node_types',
    description: '列出可创建的节点 menu_type。',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'list_node_fields',
    description: '列出节点可写 data 字段参考。',
    inputSchema: {
      type: 'object',
      properties: { menu_type: { type: 'string' } },
    },
  },
  {
    name: 'get_node',
    description: '读取节点状态/参数。改参前先调用。',
    inputSchema: {
      type: 'object',
      properties: {
        ids: { type: 'array', items: { type: 'string' } },
        include_full_data: { type: 'boolean' },
      },
      required: ['ids'],
    },
  },
  {
    name: 'update_node',
    description: '更新节点 data/位置。改 prompt 后需 submit_nodes 才生成。',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        data: { type: 'object', additionalProperties: true },
        x: { type: 'number' },
        y: { type: 'number' },
      },
      required: ['id'],
    },
  },
  {
    name: 'update_nodes',
    description: '批量 update_node。',
    inputSchema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              data: { type: 'object', additionalProperties: true },
              x: { type: 'number' },
              y: { type: 'number' },
            },
            required: ['id'],
          },
        },
      },
      required: ['items'],
    },
  },
  {
    name: 'submit_nodes',
    description: '触发节点真正生成（等同点生成）。',
    inputSchema: {
      type: 'object',
      properties: {
        ids: { type: 'array', items: { type: 'string' } },
        reason: { type: 'string' },
      },
      required: ['ids'],
    },
  },
  {
    name: 'create_nodes',
    description: '在打开的画布上创建节点。',
    inputSchema: {
      type: 'object',
      properties: {
        nodes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              menu_type: { type: 'string' },
              x: { type: 'number' },
              y: { type: 'number' },
              id: { type: 'string' },
              data: { type: 'object', additionalProperties: true },
            },
            required: ['menu_type'],
          },
        },
      },
      required: ['nodes'],
    },
  },
  {
    name: 'connect_nodes',
    description: '创建 source→target 连线。',
    inputSchema: {
      type: 'object',
      properties: {
        edges: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              source: { type: 'string' },
              target: { type: 'string' },
            },
            required: ['source', 'target'],
          },
        },
      },
      required: ['edges'],
    },
  },
  {
    name: 'delete_nodes',
    description: '按 id 删除节点。',
    inputSchema: {
      type: 'object',
      properties: { ids: { type: 'array', items: { type: 'string' } } },
      required: ['ids'],
    },
  },
  {
    name: 'layout_nodes',
    description: '排布画布节点。',
    inputSchema: {
      type: 'object',
      properties: {
        mode: { type: 'string', enum: ['flow', 'grid'] },
        gap_x: { type: 'number' },
        gap_y: { type: 'number' },
        origin_x: { type: 'number' },
        origin_y: { type: 'number' },
      },
    },
  },
  {
    name: 'build_workflow',
    description: '按业务目标一键搭流水线（优先）。',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        steps: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              menu_type: { type: 'string' },
              label: { type: 'string' },
              prompt: { type: 'string' },
              data: { type: 'object', additionalProperties: true },
            },
            required: ['menu_type'],
          },
        },
        origin_x: { type: 'number' },
        origin_y: { type: 'number' },
        gap_x: { type: 'number' },
      },
      required: ['steps'],
    },
  },
];

/** @type {{ callTool: Function, getStatus: Function } | null} */
let hub = null;
/** @type {WebSocket | null} */
let bridgeWs = null;
/** @type {Map<string, {resolve:Function, timer:NodeJS.Timeout}>} */
const pending = new Map();
let lastStatus = { canvasConnected: false };

function writeMessage(msg) {
  const body = Buffer.from(JSON.stringify(msg), 'utf8');
  process.stdout.write(Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, 'utf8'));
  process.stdout.write(body);
}

function logErr(...a) {
  console.error('[mcp-canvas]', ...a);
}

function callViaWs(name, args, timeoutMs = 30000) {
  return new Promise((resolve) => {
    if (!bridgeWs || bridgeWs.readyState !== WebSocket.OPEN) {
      resolve({
        ok: false,
        error: '未连接到本地桥。请 npm run serve:tts 并打开编辑器，或检查 REELVAS_BRIDGE_PORT。',
      });
      return;
    }
    const id = `mcp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const timer = setTimeout(() => {
      pending.delete(id);
      resolve({ ok: false, error: `工具超时: ${name}` });
    }, timeoutMs);
    pending.set(id, { resolve, timer });
    bridgeWs.send(
      JSON.stringify({
        type: 'tool_request',
        id,
        name,
        arguments: args || {},
      }),
    );
  });
}

async function callTool(name, args) {
  if (name === 'canvas_status') {
    if (hub) return { ok: true, result: hub.getStatus() };
    return {
      ok: true,
      result: {
        ...lastStatus,
        port: PORT,
        path: PATH,
        mode: 'ws-client',
      },
    };
  }
  if (hub) {
    return hub.callTool(name, args || {});
  }
  return callViaWs(name, args || {});
}

function connectAsClient() {
  return new Promise((resolve) => {
    const ws = new WebSocket(WS_URL);
    bridgeWs = ws;
    ws.on('open', () => {
      logErr('connected to existing bridge', WS_URL);
      ws.send(JSON.stringify({ type: 'hello', role: 'mcp', version: '0.2.0' }));
      resolve(true);
    });
    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(String(raw));
      } catch {
        return;
      }
      if (msg.type === 'status') {
        lastStatus = { canvasConnected: !!msg.canvasConnected };
      }
      if (msg.type === 'tool_response' && msg.id && pending.has(msg.id)) {
        const p = pending.get(msg.id);
        clearTimeout(p.timer);
        pending.delete(msg.id);
        p.resolve(msg);
      }
    });
    ws.on('error', () => resolve(false));
    ws.on('close', () => {
      bridgeWs = null;
      logErr('bridge ws closed');
    });
    setTimeout(() => resolve(!!(bridgeWs && bridgeWs.readyState === WebSocket.OPEN)), 1500);
  });
}

async function setupBridge() {
  // 1) 尝试连已有桥（serve:tts）
  const ok = await connectAsClient();
  if (ok) return;
  // 2) 自建桥
  try {
    hub = attachCanvasBridge(null, { port: PORT });
    await hub.listen();
    logErr('started local bridge on', PORT);
  } catch (e) {
    if (e && e.code === 'EADDRINUSE') {
      logErr('port busy, retry client…');
      await connectAsClient();
    } else {
      throw e;
    }
  }
}

async function handleRpc(body) {
  let msg;
  try {
    msg = JSON.parse(body);
  } catch {
    return;
  }
  const { id, method, params = {} } = msg;
  const reply = (result) => {
    if (id === undefined || id === null) return;
    writeMessage({ jsonrpc: '2.0', id, result });
  };
  const fail = (code, message) => {
    if (id === undefined || id === null) return;
    writeMessage({ jsonrpc: '2.0', id, error: { code, message } });
  };

  try {
    if (method === 'initialize') {
      reply({
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'reelvas-canvas', version: '0.2.0' },
      });
      return;
    }
    if (method === 'notifications/initialized' || method === 'initialized') return;
    if (method === 'tools/list') {
      reply({ tools: TOOLS });
      return;
    }
    if (method === 'ping') {
      reply({});
      return;
    }
    if (method === 'tools/call') {
      const name = params.name;
      const args = params.arguments || {};
      const res = await callTool(name, args);
      if (!res.ok) {
        reply({
          content: [
            {
              type: 'text',
              text: JSON.stringify({ error: res.error || res.result || 'fail' }, null, 2),
            },
          ],
          isError: true,
        });
        return;
      }
      reply({
        content: [
          {
            type: 'text',
            text: JSON.stringify(res.result !== undefined ? res.result : res, null, 2),
          },
        ],
      });
      return;
    }
    if (String(method || '').startsWith('notifications/')) return;
    fail(-32601, `Method not found: ${method}`);
  } catch (err) {
    fail(-32000, err instanceof Error ? err.message : String(err));
  }
}

async function main() {
  await setupBridge();
  let buf = Buffer.alloc(0);
  process.stdin.on('data', (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    while (true) {
      const str = buf.toString('utf8');
      const sep = str.indexOf('\r\n\r\n');
      if (sep < 0) break;
      const header = str.slice(0, sep);
      const m = /Content-Length:\s*(\d+)/i.exec(header);
      if (!m) {
        buf = Buffer.alloc(0);
        break;
      }
      const len = Number(m[1]);
      const start = sep + 4;
      if (buf.length < start + len) break;
      const body = buf.slice(start, start + len).toString('utf8');
      buf = buf.slice(start + len);
      void handleRpc(body);
    }
  });
  process.stdin.on('end', () => process.exit(0));
  logErr('stdio MCP ready; tools=', TOOLS.length, 'port=', PORT);
}

main().catch((e) => {
  logErr(e);
  process.exit(1);
});
