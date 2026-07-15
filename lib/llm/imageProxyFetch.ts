// 图像 API 请求代理：Electron IPC → 本地 image-proxy → 直连

import { createLogger } from '../logger';

const log = createLogger('imageProxyFetch');

type DesktopImageApi = {
  imageProxy?: (payload: {
    url: string;
    method?: string;
    headers?: Record<string, string>;
    bodyBase64?: string;
  }) => Promise<{ ok: boolean; status?: number; base64?: string; error?: string }>;
};

function desktopImageApi(): DesktopImageApi | null {
  if (typeof window === 'undefined') return null;
  return (window as unknown as { reelvasDesktop?: DesktopImageApi }).reelvasDesktop || null;
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  let bin = '';
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function base64ToBlob(base64: string, type: string): Blob {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

/** 代理探测缓存：null=未测；''=同源；'http://127.0.0.1:3921'=dev 侧车 */
let httpImageProxyBase: string | null | false = null;

async function probeHttpImageProxy(): Promise<string | false> {
  if (httpImageProxyBase !== null) return httpImageProxyBase;
  if (typeof window === 'undefined') {
    httpImageProxyBase = false;
    return false;
  }
  const candidates = ['', 'http://127.0.0.1:3921'];
  for (const base of candidates) {
    try {
      const t0 = performance.now();
      // OPTIONS only：避免空 POST 打出 400 missing x-upstream-url，污染 Network
      const res = await fetch(`${base}/api/image-proxy`, { method: 'OPTIONS' });
      if (res.status === 404) continue;
      httpImageProxyBase = base;
      log.info('probeHttpImageProxy', 'available', {
        base: base || 'same-origin',
        status: res.status,
        ms: Math.round(performance.now() - t0),
      });
      return base;
    } catch {
      /* try next */
    }
  }
  httpImageProxyBase = false;
  log.warn('probeHttpImageProxy', 'missing → direct');
  return false;
}

/**
 * 图像请求统一走服务端代理，绕过浏览器直连网关触发的 WAF 403。
 * 优先 Electron IPC，否则本地 /api/image-proxy，最后直连。
 */
export async function proxiedImageFetch(
  upstreamUrl: string,
  init: { headers: Record<string, string>; body: BodyInit; signal?: AbortSignal },
): Promise<Response> {
  const t0 = performance.now();
  const api = desktopImageApi();
  if (api?.imageProxy) {
    const serialReq = new Request(upstreamUrl, { method: 'POST', body: init.body });
    const bodyBlob = await serialReq.blob();
    const bodyBase64 = await blobToBase64(bodyBlob);
    const ct = serialReq.headers.get('content-type') || init.headers['Content-Type'];
    const headers = { ...init.headers, ...(ct ? { 'Content-Type': ct } : {}) };
    const r = await api.imageProxy({
      url: upstreamUrl,
      method: 'POST',
      headers,
      bodyBase64,
    });
    if (!r?.ok) {
      return new Response(JSON.stringify({ error: r?.error || 'Electron 图像代理失败' }), {
        status: r?.status || 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const bytes = r.base64 ? base64ToBlob(r.base64, 'application/json') : new Blob([]);
    log.info('proxiedImageFetch', 'electron ok', { ms: Math.round(performance.now() - t0) });
    return new Response(bytes, {
      status: r.status || 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const proxyBase = await probeHttpImageProxy();
  if (proxyBase !== false) {
    const endpoint = `${proxyBase}/api/image-proxy`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { ...init.headers, 'x-upstream-url': upstreamUrl },
      body: init.body,
      signal: init.signal,
    });
    if (res.status === 404) {
      httpImageProxyBase = null;
      log.warn('proxiedImageFetch', 'proxy 404, next call re-probe', { endpoint });
    }
    log.info('proxiedImageFetch', 'http-proxy', {
      status: res.status,
      base: proxyBase || 'same-origin',
      ms: Math.round(performance.now() - t0),
    });
    return res;
  }

  log.info('proxiedImageFetch', 'direct', { upstreamUrl: upstreamUrl.slice(0, 80) });
  const res = await fetch(upstreamUrl, {
    method: 'POST',
    headers: init.headers,
    body: init.body,
    signal: init.signal,
  });
  log.info('proxiedImageFetch', 'direct done', {
    status: res.status,
    ms: Math.round(performance.now() - t0),
  });
  return res;
}
