// 生成结果远程 URL → asset:// 引用（落 IndexedDB 不丢）
// 保留旧 dataURL 行为向后兼容，但新生成优先入库

import { createLogger } from '../../../lib/logger';
import { putAsset } from '../../../lib/assetStore';
import { srcToBlob } from './imageBlobUtils';

const log = createLogger('localizeImageUrls');

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ''));
    r.onerror = () => reject(r.error || new Error('FileReader failed'));
    r.readAsDataURL(blob);
  });
}

/**
 * 把接口返回的 http(s)/blob 结果落成 data:image/* + 存 IndexedDB 资产库。
 * 失败时保留原 URL；图床仍可走 media-proxy（签名未过期时）。
 */
export async function localizeImageUrls(
  urls: string[],
  signal?: AbortSignal,
): Promise<string[]> {
  const list = urls.map((u) => String(u || '').trim()).filter(Boolean);
  if (!list.length) return [];

  const out: string[] = [];
  const t0 = performance.now();
  let storedAssets = 0;

  for (let i = 0; i < list.length; i++) {
    if (signal?.aborted) break;
    const src = list[i];
    // 已有入库引用不再重复入库
    if (src.startsWith('data:image/') || src.startsWith('asset://')) {
      out.push(src);
      continue;
    }
    try {
      const blob = await srcToBlob(src, signal);
      if (!blob.size) throw new Error('empty blob');

      // 1) 存 IndexedDB 资产库（长久保留）
      let assetRef = '';
      try {
        assetRef = await putAsset(blob, {
          name: `gen-image-${Date.now()}.png`,
          folder: '/生成',
        });
        storedAssets += 1;
      } catch {
        // 资产库不可用时退化 dataURL
      }

      // 2) 同时保留 dataURL 以兼容旧流程（作兜底）
      const dataUrl = await blobToDataUrl(blob);
      if (!dataUrl.startsWith('data:image/')) {
        throw new Error(`unexpected data url: ${dataUrl.slice(0, 40)}`);
      }

      out.push(assetRef || dataUrl);
      log.info('localizeImageUrls', 'ok', {
        i,
        bytes: blob.size,
        stored: Boolean(assetRef),
        type: blob.type || 'unknown',
      });
    } catch (err) {
      log.warn('localizeImageUrls', 'fail keep remote', {
        i,
        msg: err instanceof Error ? err.message : String(err),
        head: src.slice(0, 96),
      });
      out.push(src);
    }
  }

  log.info('localizeImageUrls', 'done', {
    n: out.length,
    storedAssets,
    ms: Math.round(performance.now() - t0),
  });
  return out;
}
