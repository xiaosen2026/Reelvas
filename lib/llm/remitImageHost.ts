// img.remit.ee 免费图床：Blob → 公网 URL（经本地代理绕过浏览器 CORS）

import { createLogger } from '../logger';

const log = createLogger('remitImageHost');

const UPLOAD_HOST = 'https://img.remit.ee';
const UPLOAD_API = `${UPLOAD_HOST}/api/upload`;

export type RemitUploadResult = {
  url: string;
  bytes: number;
};

type RemitJson = {
  success?: boolean;
  url?: string;
  directUrl?: string;
  previewUrl?: string;
  message?: string;
};

/** null=未测；''=同源；'http://127.0.0.1:3921'=dev 侧车；false=无代理 */
let hostUploadBase: string | null | false = null;

function toAbsoluteUrl(pathOrUrl: string): string {
  const u = pathOrUrl.trim();
  if (!u) return '';
  if (/^https?:\/\//i.test(u)) return u;
  if (u.startsWith('//')) return `https:${u}`;
  if (u.startsWith('/')) return `${UPLOAD_HOST}${u}`;
  return `${UPLOAD_HOST}/${u}`;
}

async function probeHostUploadProxy(): Promise<string | false> {
  if (hostUploadBase !== null) return hostUploadBase;
  if (typeof window === 'undefined') {
    hostUploadBase = false;
    return false;
  }
  const candidates = ['', 'http://127.0.0.1:3921'];
  for (const base of candidates) {
    try {
      const res = await fetch(`${base}/api/image-host-upload`, {
        method: 'OPTIONS',
      });
      // 404 表示路由不存在；其它（含 CORS preflight 204/405）视为可用
      if (res.status === 404) continue;
      hostUploadBase = base;
      log.info('probeHostUploadProxy', 'available', {
        base: base || 'same-origin',
        status: res.status,
      });
      return base;
    } catch {
      /* try next */
    }
  }
  hostUploadBase = false;
  log.warn('probeHostUploadProxy', 'missing → direct remit (may CORS)');
  return false;
}

function isBusyStatus(status: number, body: string): boolean {
  if (status === 429 || status === 503 || status === 502) return true;
  return /busy|稍后|retry|限流|too many|processing uploads/i.test(body);
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const t = window.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      window.clearTimeout(t);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * 上传单张图片到 remit.ee。
 * 优先本地 /api/image-host-upload（dev 侧车 3921 或 serve:tts），再直连。
 * 免费图床 503 busy 会退避重试（非业务逻辑错误）。
 */
export async function uploadBlobToRemit(
  blob: Blob,
  signal?: AbortSignal,
  filename = 'reelvas.png',
): Promise<RemitUploadResult> {
  const type = blob.type || 'image/png';
  const file = blob instanceof File ? blob : new File([blob], filename, { type });

  const proxyBase = await probeHostUploadProxy();
  const endpoint =
    proxyBase === false ? UPLOAD_API : `${proxyBase}/api/image-host-upload`;
  const headers: Record<string, string> =
    proxyBase === false
      ? {
          Accept: 'application/json',
          Referer: `${UPLOAD_HOST}/free-image-hosting`,
          Origin: UPLOAD_HOST,
        }
      : { Accept: 'application/json' };

  const via = proxyBase === false ? 'direct' : proxyBase || 'same-origin';
  log.info('uploadBlobToRemit', 'start', { bytes: blob.size, type, filename, via });

  const maxAttempts = 5;
  let lastErr: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    // FormData 可复用；部分环境消费后需重建
    const form = new FormData();
    form.append('file', file, filename);

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: form,
      signal,
    });
    const text = await res.text().catch(() => '');

    if (res.ok) {
      let data: RemitJson;
      try {
        data = JSON.parse(text) as RemitJson;
      } catch {
        throw new Error(`图床响应非 JSON: ${text.slice(0, 120)}`);
      }
      if (data.success === false) {
        const msg = data.message || text.slice(0, 120);
        if (isBusyStatus(503, msg) && attempt < maxAttempts) {
          lastErr = new Error(`图床忙：${msg}`);
        } else {
          throw new Error(`图床上传失败：${msg}`);
        }
      } else {
        const raw = (data.directUrl || data.url || '').trim();
        const url = toAbsoluteUrl(raw);
        if (!/^https?:\/\//i.test(url)) {
          throw new Error(`图床返回了无效 URL：${raw || text.slice(0, 80)}`);
        }
        log.info('uploadBlobToRemit', 'ok', {
          url: url.slice(0, 120),
          bytes: blob.size,
          attempt,
        });
        return { url, bytes: blob.size };
      }
    } else {
      lastErr = new Error(
        `图床上传失败 ${res.status}: ${text.slice(0, 120) || res.statusText}`,
      );
      if (!isBusyStatus(res.status, text) || attempt >= maxAttempts) {
        log.error('uploadBlobToRemit', 'http error', {
          status: res.status,
          body: text.slice(0, 200),
          via,
          attempt,
        });
        throw lastErr;
      }
    }

    const waitMs = Math.min(12000, 800 * 2 ** (attempt - 1));
    log.warn('uploadBlobToRemit', 'busy retry', { attempt, waitMs, via });
    await sleep(waitMs, signal);
  }

  throw lastErr || new Error('图床上传失败：重试耗尽');
}

export function isRemitPublicUrl(src: string): boolean {
  return /^https?:\/\/img\.remit\.ee\//i.test(src.trim());
}
