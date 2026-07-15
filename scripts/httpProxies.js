// 本地 HTTP 代理：image-proxy（POST 转发 API）+ media-proxy（GET 拉跨域图）
// 供 serve-with-tts.js / local-api-proxy.js 共用
const http = require('http');
const https = require('https');
const { URL } = require('url');

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

/** 上游转发；timeoutMs 默认 180s，避免 image-proxy 挂死导致前端半小时「生成中」 */
function forwardUpstream({ url, method, headers, body, timeoutMs = 180000 }) {
  return new Promise((resolve, reject) => {
    let target;
    try {
      target = new URL(url);
    } catch {
      reject(new Error(`非法上游地址: ${url}`));
      return;
    }
    const lib = target.protocol === 'http:' ? http : https;
    const req = lib.request(
      target,
      {
        method: method || 'GET',
        headers: {
          ...headers,
          host: target.host,
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
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`上游超时 ${timeoutMs}ms: ${url.slice(0, 120)}`));
    });
    req.on('error', reject);
    if (body && body.length) req.write(body);
    req.end();
  });
}

function corsHeaders(extra = {}) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-upstream-url',
    ...extra,
  };
}

/** POST /api/image-proxy — header x-upstream-url */
async function handleImageProxy(req, res) {
  if (req.method === 'OPTIONS') {
    send(res, 204, '', corsHeaders());
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
        ...corsHeaders(),
        'Content-Type': 'application/json',
      });
      return;
    }
    const body = await readBody(req);
    const fwdHeaders = { Accept: 'application/json' };
    if (req.headers.authorization) fwdHeaders.Authorization = req.headers.authorization;
    if (req.headers['content-type']) fwdHeaders['Content-Type'] = req.headers['content-type'];
    // 明确长度，避免部分上游对 chunked/multipart 解析异常
    fwdHeaders['Content-Length'] = String(body.length);
    console.log('[image-proxy] ->', upstreamUrl, 'bytes=', body.length, 'ct=', fwdHeaders['Content-Type'] || '');
    try {
      const b = JSON.parse(body.toString('utf8'));
      if (b.size) console.log('[image-proxy]   size=', b.size);
      if (b.image != null) {
        const img = b.image;
        console.log(
          '[image-proxy]   image=',
          Array.isArray(img) ? `array(${img.length})` : typeof img === 'string' ? `str(${img.length})` : typeof img,
        );
      }
    } catch {
      /* multipart */
    }
    const up = await forwardUpstream({
      url: upstreamUrl,
      method: 'POST',
      headers: fwdHeaders,
      body,
    });
    const snippet =
      up.status >= 400
        ? up.body.toString('utf8').slice(0, 240).replace(/\s+/g, ' ')
        : '';
    console.log(
      '[image-proxy] <-',
      up.status,
      'bytes=',
      up.body.length,
      snippet ? `body=${snippet}` : '',
    );
    send(res, up.status, up.body, {
      ...corsHeaders({ 'Cache-Control': 'no-store' }),
      'Content-Type': up.headers['content-type'] || 'application/json',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[image-proxy] fail', msg);
    send(res, 502, JSON.stringify({ error: msg }), {
      ...corsHeaders(),
      'Content-Type': 'application/json',
    });
  }
}

/** GET /api/media-proxy?url= — 拉取跨域参考图（TOS 等无 CORS） */
async function handleMediaProxy(req, res) {
  if (req.method === 'OPTIONS') {
    send(res, 204, '', corsHeaders());
    return;
  }
  if (req.method !== 'GET') {
    send(res, 405, 'Method Not Allowed');
    return;
  }
  try {
    const u = new URL(req.url || '/', 'http://localhost');
    const target = String(u.searchParams.get('url') || '').trim();
    if (!target) {
      send(res, 400, JSON.stringify({ error: 'missing url' }), {
        ...corsHeaders(),
        'Content-Type': 'application/json',
      });
      return;
    }
    let parsed;
    try {
      parsed = new URL(target);
    } catch {
      send(res, 400, JSON.stringify({ error: 'invalid url' }), {
        ...corsHeaders(),
        'Content-Type': 'application/json',
      });
      return;
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      send(res, 400, JSON.stringify({ error: 'only http(s)' }), {
        ...corsHeaders(),
        'Content-Type': 'application/json',
      });
      return;
    }
    console.log('[media-proxy] ->', target.slice(0, 120));
    const up = await forwardUpstream({
      url: target,
      method: 'GET',
      headers: { Accept: 'image/*,*/*' },
    });
    console.log('[media-proxy] <-', up.status, 'bytes=', up.body.length);
    send(res, up.status, up.body, {
      ...corsHeaders({ 'Cache-Control': 'private, max-age=300' }),
      'Content-Type': up.headers['content-type'] || 'application/octet-stream',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[media-proxy] fail', msg);
    send(res, 502, JSON.stringify({ error: msg }), {
      ...corsHeaders(),
      'Content-Type': 'application/json',
    });
  }
}

const REMIT_UPLOAD = 'https://img.remit.ee/api/upload';

/**
 * POST /api/image-host-upload
 * 浏览器把 multipart(file) 交本地，再由 Node 上传 remit（绕过 CORS）
 */
async function handleImageHostUpload(req, res) {
  if (req.method === 'OPTIONS') {
    send(res, 204, '', corsHeaders());
    return;
  }
  if (req.method !== 'POST') {
    send(res, 405, 'Method Not Allowed');
    return;
  }
  try {
    const body = await readBody(req);
    const ct = String(req.headers['content-type'] || '');
    if (!ct.toLowerCase().includes('multipart/form-data')) {
      send(res, 400, JSON.stringify({ error: 'expect multipart/form-data' }), {
        ...corsHeaders(),
        'Content-Type': 'application/json',
      });
      return;
    }
    console.log('[image-host-upload] -> remit bytes=', body.length, 'ct=', ct.slice(0, 80));
    const up = await forwardUpstream({
      url: REMIT_UPLOAD,
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': ct,
        'Content-Length': String(body.length),
        Referer: 'https://img.remit.ee/free-image-hosting',
        Origin: 'https://img.remit.ee',
      },
      body,
    });
    const bodyText = up.body.toString('utf8');
    const snippet = bodyText.slice(0, 240).replace(/\s+/g, ' ');
    console.log(
      '[image-host-upload] <-',
      up.status,
      'bytes=',
      up.body.length,
      'body=',
      snippet,
    );
    send(res, up.status, up.body, {
      ...corsHeaders({ 'Cache-Control': 'no-store' }),
      'Content-Type': up.headers['content-type'] || 'application/json',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[image-host-upload] fail', msg);
    send(res, 502, JSON.stringify({ error: msg }), {
      ...corsHeaders(),
      'Content-Type': 'application/json',
    });
  }
}

/** 是否命中代理路由；命中则处理并返回 true */
function tryHandleApiProxy(req, res) {
  const pathOnly = String(req.url || '/').split('?')[0];
  if (pathOnly === '/api/image-proxy' || pathOnly.startsWith('/api/image-proxy/')) {
    void handleImageProxy(req, res);
    return true;
  }
  if (pathOnly === '/api/media-proxy' || pathOnly.startsWith('/api/media-proxy/')) {
    void handleMediaProxy(req, res);
    return true;
  }
  if (
    pathOnly === '/api/image-host-upload' ||
    pathOnly.startsWith('/api/image-host-upload/')
  ) {
    void handleImageHostUpload(req, res);
    return true;
  }
  return false;
}

module.exports = {
  send,
  readBody,
  forwardUpstream,
  handleImageProxy,
  handleMediaProxy,
  handleImageHostUpload,
  tryHandleApiProxy,
};
