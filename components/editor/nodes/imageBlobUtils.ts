// 上游参考图 → Blob：跨域 media-proxy + PNG 压缩（NewAPI edits）

import { createLogger } from '../../../lib/logger';

const log = createLogger('imageBlobUtils');

/** NewAPI / OpenAI edits：参考图须 PNG 且通常 <4MB */
const EDITS_MAX_BYTES = 3.5 * 1024 * 1024;
const LOCAL_API_PROXY =
  typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_PROXY
    ? String(process.env.NEXT_PUBLIC_API_PROXY).replace(/\/$/, '')
    : 'http://127.0.0.1:3921';

async function fetchViaMediaProxy(src: string, signal?: AbortSignal): Promise<Blob> {
  const qs = `url=${encodeURIComponent(src)}`;
  const candidates = [
    `/api/media-proxy?${qs}`,
    // next export 无 rewrite 时：dev 侧车 scripts/local-api-proxy.js（CORS *）
    `${LOCAL_API_PROXY}/api/media-proxy?${qs}`,
  ];
  let lastErr: Error | null = null;
  for (const proxy of candidates) {
    try {
      const res = await fetch(proxy, { signal });
      if (res.status === 404) {
        lastErr = new Error('media-proxy 404');
        continue;
      }
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        throw new Error(`媒体代理失败 ${res.status}: ${t.slice(0, 120) || res.statusText}`);
      }
      log.info('fetchViaMediaProxy', 'ok', { via: proxy.startsWith('http') ? 'sidecar' : 'same-origin' });
      return res.blob();
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
    }
  }
  throw lastErr || new Error('媒体代理不可用：请 npm run dev（含侧车）或 serve:tts');
}

/** dataURL / http(s) / blob: → Blob；跨域 TOS 等走 media-proxy */
export async function srcToBlob(src: string, signal?: AbortSignal): Promise<Blob> {
  if (src.startsWith('data:') || src.startsWith('blob:')) {
    const res = await fetch(src, { signal });
    return res.blob();
  }
  if (src.startsWith('/') && !src.startsWith('//')) {
    const res = await fetch(src, { signal });
    if (!res.ok) throw new Error(`加载上游图片失败 ${res.status}`);
    return res.blob();
  }
  try {
    const res = await fetch(src, { signal, mode: 'cors' });
    if (!res.ok) throw new Error(`加载上游图片失败 ${res.status}`);
    return res.blob();
  } catch (err) {
    if (!/^https?:\/\//i.test(src)) throw err;
    log.warn('srcToBlob', 'direct fail → media-proxy', {
      msg: err instanceof Error ? err.message : String(err),
      host: (() => {
        try {
          return new URL(src).host;
        } catch {
          return '';
        }
      })(),
    });
    return fetchViaMediaProxy(src, signal);
  }
}

/** 转 PNG（NewAPI edits 要求有效 PNG），长边压缩并尽量 <4MB */
export async function compressImageBlob(blob: Blob, maxEdge = 1024): Promise<Blob> {
  if (typeof createImageBitmap !== 'function') {
    return blob.type === 'image/png' ? blob : new Blob([blob], { type: 'image/png' });
  }
  try {
    const bmp = await createImageBitmap(blob);
    const w = bmp.width;
    const h = bmp.height;
    const long = Math.max(w, h) || 1;
    let edge = maxEdge;
    if (blob.type === 'image/png' && long <= edge && blob.size <= EDITS_MAX_BYTES) {
      bmp.close?.();
      return blob;
    }
    const toPng = async (tw: number, th: number): Promise<Blob | null> => {
      const canvas = document.createElement('canvas');
      canvas.width = tw;
      canvas.height = th;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(bmp, 0, 0, tw, th);
      return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
    };
    let scale = Math.min(1, edge / long);
    let tw = Math.max(1, Math.round(w * scale));
    let th = Math.max(1, Math.round(h * scale));
    let out = await toPng(tw, th);
    while (out && out.size > EDITS_MAX_BYTES && edge > 256) {
      edge = Math.floor(edge * 0.75);
      scale = Math.min(1, edge / long);
      tw = Math.max(1, Math.round(w * scale));
      th = Math.max(1, Math.round(h * scale));
      out = await toPng(tw, th);
    }
    bmp.close?.();
    if (!out) return blob.type === 'image/png' ? blob : new Blob([blob], { type: 'image/png' });
    log.info('compressImageBlob', 'png', { from: blob.size, to: out.size, w: tw, h: th });
    return out;
  } catch (err) {
    log.warn('compressImageBlob', 'fail keep original', {
      msg: err instanceof Error ? err.message : String(err),
    });
    return blob.type === 'image/png' ? blob : new Blob([blob], { type: 'image/png' });
  }
}

export async function srcsToBlobs(srcs: string[], signal?: AbortSignal): Promise<Blob[]> {
  // NewAPI 经典 edits 为单图 image*；多图网关支持时最多 4 张 PNG
  const list = srcs.slice(0, 4);
  const out: Blob[] = [];
  for (let i = 0; i < list.length; i++) {
    if (signal?.aborted) break;
    const raw = await srcToBlob(list[i], signal);
    out.push(await compressImageBlob(raw));
  }
  log.info('srcsToBlobs', 'ok', {
    n: out.length,
    bytes: out.reduce((s, b) => s + b.size, 0),
    types: out.map((b) => b.type),
  });
  return out;
}
