// 参考图 src → 图床公网 URL（不压缩；跨域仍可走 media-proxy 拉原图）

import { createLogger } from '../../../lib/logger';
import {
  isRemitPublicUrl,
  uploadBlobToRemit,
} from '../../../lib/llm/remitImageHost';
import { srcToBlob } from './imageBlobUtils';

const log = createLogger('uploadRefsToHost');

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

/** 最多 4 张；已是 remit 直链则复用；不调用 compressImageBlob */
export async function uploadRefsToHost(
  srcs: string[],
  signal?: AbortSignal,
  max = 4,
): Promise<string[]> {
  const list = srcs.map((s) => s.trim()).filter(Boolean).slice(0, max);
  const out: string[] = [];
  const t0 = performance.now();

  for (let i = 0; i < list.length; i++) {
    if (signal?.aborted) break;
    const src = list[i];
    const kind = src.startsWith('data:')
      ? 'data'
      : src.startsWith('blob:')
        ? 'blob'
        : src.startsWith('http')
          ? 'http'
          : 'other';
    if (isRemitPublicUrl(src)) {
      log.info('uploadRefsToHost', 'reuse remit', { i, url: src.slice(0, 100) });
      out.push(src);
      continue;
    }
    try {
      log.info('uploadRefsToHost', 'src→blob', {
        i,
        kind,
        preview: src.startsWith('data:') ? `data…(${src.length})` : src.slice(0, 100),
      });
      const tBlob = performance.now();
      const blob = await srcToBlob(src, signal);
      // 原图上传，不压缩
      const name =
        blob.type === 'image/jpeg' || blob.type === 'image/jpg'
          ? `reelvas_${i}.jpg`
          : blob.type === 'image/webp'
            ? `reelvas_${i}.webp`
            : `reelvas_${i}.png`;
      log.info('uploadRefsToHost', 'blob→host', {
        i,
        name,
        bytes: blob.size,
        type: blob.type,
        blobMs: Math.round(performance.now() - tBlob),
      });
      const tUp = performance.now();
      const { url } = await uploadBlobToRemit(blob, signal, name);
      log.info('uploadRefsToHost', 'host ok', {
        i,
        url: url.slice(0, 120),
        upMs: Math.round(performance.now() - tUp),
      });
      out.push(url);
    } catch (err) {
      if (isAbortError(err) || signal?.aborted) {
        log.warn('uploadRefsToHost', 'aborted', { i, kind });
        break;
      }
      const msg = err instanceof Error ? err.message : String(err);
      log.warn('uploadRefsToHost', 'fail', { i, kind, msg });
      throw new Error(`[图床#${i + 1}/${list.length}] ${msg}`);
    }
  }

  log.info('uploadRefsToHost', 'ok', {
    n: out.length,
    ms: Math.round(performance.now() - t0),
  });
  return out;
}
