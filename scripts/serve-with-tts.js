// 静态 out/ + 免费 Edge TTS 代理（浏览器可落盘 mp3）
// 用法: node scripts/serve-with-tts.js  [port=3000]
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { synthesizeEdgeMp3Node } = require('./edgeTtsNode');
const { attachCanvasBridge } = require('./canvasBridgeHub');

const PORT = Number(process.argv[2] || process.env.PORT || 3000);
const OUT = path.join(__dirname, '..', 'out');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.fbx': 'application/octet-stream',
  '.obj': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
};

function send(res, code, body, headers = {}) {
  res.writeHead(code, headers);
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function handleFreeTts(req, res) {
  if (req.method === 'OPTIONS') {
    send(res, 204, '', {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return;
  }
  if (req.method !== 'POST') {
    send(res, 405, 'Method Not Allowed');
    return;
  }
  try {
    const raw = await readBody(req);
    const json = JSON.parse(raw.toString('utf8') || '{}');
    const text = String(json.text || json.input || '').trim();
    const voice = String(json.voice || 'zh-CN-XiaoxiaoNeural');
    if (!text) {
      send(res, 400, JSON.stringify({ error: 'text required' }), {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      return;
    }
    console.log('[free-tts]', voice, text.slice(0, 40));
    let buf = null;
    let lastErr = null;
    // 外层再试 2 次，覆盖瞬时断连（内部已有 GEC 偏移重试）
    for (let i = 0; i < 2; i++) {
      try {
        buf = await synthesizeEdgeMp3Node({ text, voice });
        if (buf && buf.length) break;
        lastErr = new Error('empty mp3');
      } catch (e) {
        lastErr = e instanceof Error ? e : new Error(String(e));
        console.error('[free-tts] attempt', i + 1, lastErr.message);
        await new Promise((r) => setTimeout(r, 200));
      }
    }
    if (!buf || !buf.length) throw lastErr || new Error('Edge TTS 失败');
    console.log('[free-tts] ok bytes=', buf.length);
    send(res, 200, buf, {
      'Content-Type': 'audio/mpeg',
      'Content-Length': String(buf.length),
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[free-tts] fail', msg);
    send(res, 500, JSON.stringify({ error: msg }), {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
  }
}

// 服务端转发原始请求到上游网关，绕过浏览器 WAF（无 Origin / 伪装 UA）
function forwardUpstream({ url, method, headers, body }) {
  return new Promise((resolve, reject) => {
    let target;
    try {
      target = new URL(url);
    } catch (e) {
      reject(new Error(`非法上游地址: ${url}`));
      return;
    }
    const lib = target.protocol === 'http:' ? http : https;
    const req = lib.request(
      target,
      {
        method: method || 'POST',
        headers: {
          ...headers,
          host: target.host,
          // 伪装成 Chrome，去掉浏览器专属头，对齐 ComfyUI 服务端请求
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          Connection: 'close',
        },
      },
      (up) => {
        const chunks = [];
        up.on('data', (c) => chunks.push(c));
        up.on('end', () =>
          resolve({
            status: up.statusCode || 502,
            headers: up.headers,
            body: Buffer.concat(chunks),
          }),
        );
      },
    );
    req.on('error', reject);
    if (body && body.length) req.write(body);
    req.end();
  });
}

// POST /api/image-proxy —— 转发图像生成/编辑请求到上游网关
// header x-upstream-url 指定完整上游 URL；其余透传（Authorization / Content-Type）
async function handleImageProxy(req, res) {
  if (req.method === 'OPTIONS') {
    send(res, 204, '', {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-upstream-url',
    });
    return;
  }
  if (req.method !== 'POST') {
    send(res, 405, 'Method Not Allowed');
    return;
  }
  try {
    const upstreamUrl = String(req.headers['x-upstream-url'] || '').trim();
    if (!upstreamUrl) {
      send(res, 400, JSON.stringify({ error: 'missing x-upstream-url' }), {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      return;
    }
    const body = await readBody(req);
    // 透传上游需要的头：认证 + 内容类型（含 multipart boundary）
    const fwdHeaders = { Accept: 'application/json' };
    if (req.headers['authorization']) fwdHeaders['Authorization'] = req.headers['authorization'];
    if (req.headers['content-type']) fwdHeaders['Content-Type'] = req.headers['content-type'];
    fwdHeaders['Content-Length'] = String(body.length);
    console.log('[image-proxy] ->', upstreamUrl, 'bytes=', body.length, 'ct=', fwdHeaders['Content-Type'] || '');
    // debug: 打印 size / image 形态（JSON 图生图）
    try {
      const b = JSON.parse(body);
      if (b.size) console.log('[image-proxy]   size=', b.size);
      if (b.image != null) {
        const img = b.image;
        console.log(
          '[image-proxy]   image=',
          Array.isArray(img) ? `array(${img.length})` : typeof img === 'string' ? `str(${img.length})` : typeof img,
        );
      }
    } catch (_) {}
    const up = await forwardUpstream({
      url: upstreamUrl,
      method: 'POST',
      headers: fwdHeaders,
      body,
    });
    console.log('[image-proxy] <-', up.status, 'bytes=', up.body.length);
    send(res, up.status, up.body, {
      'Content-Type': up.headers['content-type'] || 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[image-proxy] fail', msg);
    send(res, 502, JSON.stringify({ error: msg }), {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
  }
}

function safeJoin(root, urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const full = path.normalize(path.join(root, decoded));
  if (!full.startsWith(root)) return null;
  return full;
}

function serveStatic(req, res) {
  let urlPath = req.url || '/';
  if (urlPath === '/') urlPath = '/index.html';
  let filePath = safeJoin(OUT, urlPath);
  if (!filePath) {
    send(res, 403, 'Forbidden');
    return;
  }
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }
  if (!fs.existsSync(filePath) && !path.extname(filePath)) {
    const asHtml = filePath + '/index.html';
    if (fs.existsSync(asHtml)) filePath = asHtml;
  }
  if (!fs.existsSync(filePath)) {
    send(res, 404, 'Not Found');
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type });
  fs.createReadStream(filePath).pipe(res);
}

const { tryHandleApiProxy } = require('./httpProxies');

const server = http.createServer((req, res) => {
  const u = req.url || '/';
  if (u.startsWith('/api/free-tts')) {
    void handleFreeTts(req, res);
    return;
  }
  // /api/image-proxy + /api/media-proxy（跨域参考图）
  if (tryHandleApiProxy(req, res)) return;
  // 兼容旧内联 image-proxy（若 tryHandle 未匹配）
  if (u.startsWith('/api/image-proxy')) {
    void handleImageProxy(req, res);
    return;
  }
  serveStatic(req, res);
});

// MCP / 外部 Agent 画布桥（与静态服务同端口 upgrade）
try {
  attachCanvasBridge(server, { port: PORT });
  console.log(`[canvas-bridge] attached path=/reelvas-canvas-bridge (same port ${PORT})`);
} catch (e) {
  console.error('[canvas-bridge] attach failed', e instanceof Error ? e.message : e);
}

server.listen(PORT, () => {
  console.log(`Reelvas static+tts http://localhost:${PORT}`);
  console.log(`free TTS POST /api/free-tts  out=${OUT}`);
  console.log(`image proxy POST /api/image-proxy (x-upstream-url)`);
  console.log(`media proxy GET  /api/media-proxy?url=`);
  console.log(`canvas MCP bridge ws://127.0.0.1:${PORT}/reelvas-canvas-bridge`);
});
