// 本地桥枢纽：浏览器画布页 ↔ MCP（WebSocket JSON）
// 可被 serve-with-tts 挂载；MCP 进程也可独立 listen（端口空闲时）

const { WebSocketServer } = require('ws');
const http = require('http');

const DEFAULT_PORT = Number(process.env.REELVAS_BRIDGE_PORT || 3000);
const PATH = '/reelvas-canvas-bridge';

/**
 * @param {import('http').Server | null} existingServer
 * @param {{ port?: number }} [opts]
 */
function attachCanvasBridge(existingServer, opts = {}) {
  const port = opts.port || DEFAULT_PORT;
  let server = existingServer;
  let owned = false;
  if (!server) {
    server = http.createServer((req, res) => {
      if ((req.url || '').startsWith('/health')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, service: 'reelvas-canvas-bridge' }));
        return;
      }
      res.writeHead(404);
      res.end('not found');
    });
    owned = true;
  }

  const wss = new WebSocketServer({ noServer: true });
  /** @type {import('ws').WebSocket | null} */
  let canvasClient = null;
  /** @type {Map<string, { ws: import('ws').WebSocket, timer: NodeJS.Timeout }>} */
  const pending = new Map();

  function safeSend(ws, obj) {
    if (ws && ws.readyState === 1) {
      try {
        ws.send(JSON.stringify(obj));
      } catch (_) {}
    }
  }

  function broadcastStatus() {
    const msg = {
      type: 'status',
      canvasConnected: !!(canvasClient && canvasClient.readyState === 1),
      clients: wss.clients.size,
    };
    wss.clients.forEach((c) => safeSend(c, msg));
  }

  function handleUpgrade(req, socket, head) {
    let pathname = '/';
    try {
      pathname = new URL(req.url || '/', 'http://127.0.0.1').pathname;
    } catch (_) {}
    if (pathname !== PATH) return false;
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
    return true;
  }

  if (owned) {
    server.on('upgrade', (req, socket, head) => {
      if (!handleUpgrade(req, socket, head)) socket.destroy();
    });
  } else {
    const prev = server.listeners('upgrade').slice();
    server.removeAllListeners('upgrade');
    server.on('upgrade', (req, socket, head) => {
      if (handleUpgrade(req, socket, head)) return;
      for (const fn of prev) fn.call(server, req, socket, head);
    });
  }

  function forwardToolRequest(fromWs, msg) {
    const id = String(msg.id || '');
    const name = String(msg.name || '');
    if (!id || !name) {
      safeSend(fromWs, {
        type: 'tool_response',
        id: id || 'na',
        ok: false,
        error: 'tool_request 需要 id 与 name',
      });
      return;
    }
    if (!canvasClient || canvasClient.readyState !== 1) {
      safeSend(fromWs, {
        type: 'tool_response',
        id,
        ok: false,
        error: '没有已打开的 Reelvas 画布页。请先打开编辑器（浏览器或 Electron）。',
      });
      return;
    }
    const timer = setTimeout(() => {
      pending.delete(id);
      safeSend(fromWs, {
        type: 'tool_response',
        id,
        ok: false,
        error: `工具超时: ${name}`,
      });
    }, Number(msg.timeoutMs) > 0 ? Number(msg.timeoutMs) : 30000);
    pending.set(id, { ws: fromWs, timer });
    safeSend(canvasClient, {
      type: 'tool_request',
      id,
      name,
      arguments: msg.arguments || {},
    });
  }

  wss.on('connection', (ws) => {
    let role = 'unknown';
    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(String(raw));
      } catch {
        return;
      }
      if (msg.type === 'hello') {
        role = msg.role || 'unknown';
        if (role === 'canvas') {
          if (canvasClient && canvasClient !== ws && canvasClient.readyState === 1) {
            try {
              canvasClient.close(4000, 'replaced');
            } catch (_) {}
          }
          canvasClient = ws;
          console.log('[canvas-bridge] canvas connected', msg.page || '');
        } else {
          console.log('[canvas-bridge] client connected role=', role);
        }
        broadcastStatus();
        return;
      }
      if (msg.type === 'ping') {
        safeSend(ws, { type: 'pong', t: msg.t || Date.now() });
        return;
      }
      // MCP 进程 / 其它客户端通过 WS 发起工具调用
      if (msg.type === 'tool_request') {
        forwardToolRequest(ws, msg);
        return;
      }
      // 画布页回传
      if (msg.type === 'tool_response' && msg.id) {
        const p = pending.get(String(msg.id));
        if (p) {
          clearTimeout(p.timer);
          pending.delete(String(msg.id));
          safeSend(p.ws, msg);
        }
      }
    });
    ws.on('close', () => {
      if (canvasClient === ws) {
        canvasClient = null;
        console.log('[canvas-bridge] canvas disconnected');
        for (const [id, p] of pending) {
          clearTimeout(p.timer);
          safeSend(p.ws, {
            type: 'tool_response',
            id,
            ok: false,
            error: '画布页已断开',
          });
          pending.delete(id);
        }
        broadcastStatus();
      }
      // 清理该连接上的 pending
      for (const [id, p] of pending) {
        if (p.ws === ws) {
          clearTimeout(p.timer);
          pending.delete(id);
        }
      }
    });
  });

  function callTool(name, args = {}, timeoutMs = 30000) {
    return new Promise((resolve) => {
      if (!canvasClient || canvasClient.readyState !== 1) {
        resolve({
          type: 'tool_response',
          id: 'na',
          ok: false,
          error: '没有已打开的 Reelvas 画布页。请先打开编辑器。',
        });
        return;
      }
      const id = `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      // 伪 ws：in-process resolve
      const fakeWs = {
        readyState: 1,
        send: (s) => {
          try {
            resolve(JSON.parse(s));
          } catch (e) {
            resolve({ type: 'tool_response', id, ok: false, error: String(e) });
          }
        },
      };
      const timer = setTimeout(() => {
        pending.delete(id);
        resolve({ type: 'tool_response', id, ok: false, error: `工具超时: ${name}` });
      }, timeoutMs);
      pending.set(id, { ws: fakeWs, timer });
      safeSend(canvasClient, {
        type: 'tool_request',
        id,
        name,
        arguments: args || {},
      });
    });
  }

  function getStatus() {
    return {
      canvasConnected: !!(canvasClient && canvasClient.readyState === 1),
      clients: wss.clients.size,
      port,
      path: PATH,
    };
  }

  function listen() {
    if (!owned) return Promise.resolve(port);
    return new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, '127.0.0.1', () => {
        console.log(`[canvas-bridge] ws://127.0.0.1:${port}${PATH}`);
        resolve(port);
      });
    });
  }

  return { server, wss, callTool, getStatus, listen, handleUpgrade, port, path: PATH, owned };
}

module.exports = { attachCanvasBridge, DEFAULT_PORT, PATH };
