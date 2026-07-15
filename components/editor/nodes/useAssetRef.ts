'use client';

// 资产引用 hook：asset://{id} → 可渲染 URL（data 或 blob），自动缓存

import { useEffect, useState } from 'react';
import { isAssetRef, getAssetDataUrl } from '../../../lib/assetStore';
import { createLogger } from '../../../lib/logger';

const log = createLogger('useAssetRef');

const cache = new Map<string, string>();

/**
 * 解析 asset:// 引用为可渲染 URL。
 * 如果不是资产引用，原样返回。
 */
export function useAssetUrl(src: string | undefined | null): string {
  const local = typeof src === 'string' && src ? src : '';
  const [url, setUrl] = useState(() => {
    if (!local) return '';
    if (!isAssetRef(local)) return local;
    return cache.get(local) || local;
  });

  useEffect(() => {
    if (!local || !isAssetRef(local)) return;
    const cached = cache.get(local);
    if (cached) {
      setUrl(cached);
      return;
    }
    let cancelled = false;
    getAssetDataUrl(local).then((resolved) => {
      if (cancelled || !resolved) return;
      cache.set(local, resolved);
      setUrl(resolved);
    }).catch((err) => {
      log.warn('useAssetUrl', 'resolve fail', { src: local.slice(0, 40), msg: String(err) });
    });
    return () => { cancelled = true; };
  }, [local]);

  return url;
}

/** 将 dataURL 存入资产库并返回 asset:// 引用 */
export async function storeAsAsset(
  dataUrlOrBlob: string | Blob,
  opts?: {
    name?: string;
    folder?: string;
    kind?: 'image' | 'video' | 'audio' | 'file';
  },
): Promise<string> {
  let blob: Blob;
  if (typeof dataUrlOrBlob === 'string') {
    if (dataUrlOrBlob.startsWith('blob:')) {
      const res = await fetch(dataUrlOrBlob);
      blob = await res.blob();
    } else if (dataUrlOrBlob.startsWith('data:')) {
      const res = await fetch(dataUrlOrBlob);
      blob = await res.blob();
    } else if (/^https?:\/\//i.test(dataUrlOrBlob)) {
      const res = await fetch(dataUrlOrBlob);
      blob = await res.blob();
    } else {
      throw new Error('storeAsAsset: unsupported URL type');
    }
  } else {
    blob = dataUrlOrBlob;
  }

  const { putAsset } = await import('../../../lib/assetStore');
  const assetRef = await putAsset(blob, opts);
  log.info('storeAsAsset', 'ok', { ref: assetRef.slice(0, 32) });
  return assetRef;
}
