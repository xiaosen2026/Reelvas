// 启动时资产迁移：扫描工作流节点 data 中的旧 dataURL，
// 存入 IndexedDB 资产库（工作流资产 or 全局），生成 asset://{id} 引用。
// 不删除原 dataURL（回溯兼容）。

import type { FlowNode } from '../components/editor/flow/types';
import {
  putAsset,
  collectAssetRefs,
  isAssetRef,
  getAssetDataUrl,
} from './assetStore';
import { ASSET_PREFIX } from './assetStore';
import { createLogger } from './logger';
import { srcToBlob } from '../components/editor/nodes/imageBlobUtils';

const log = createLogger('migrateAssets');

const DATA_IMAGE_PREFIX = 'data:image/';

/**
 * 迁移旧 dataURL → asset:// 引用。
 * workflowName 传空/null 存为全局资产；传工作流名存为工作流资产。
 */
export async function migrateDataUrlsToAssets(
  nodes: FlowNode[],
  workflowName?: string,
): Promise<{ patches: Record<string, Record<string, unknown>>; migrated: number; failed: number }> {
  const patches: Record<string, Record<string, unknown>> = {};
  let migrated = 0;
  let failed = 0;

  for (const node of nodes) {
    const d = node.data || {};
    if (collectAssetRefs(d).length) continue;

    const candidates: string[] = [];
    const keys: string[] = [];

    for (const key of ['value', 'fileUrl', 'imageUrl', 'videoUrl', 'audioUrl']) {
      const v = typeof d[key] === 'string' ? String(d[key]).trim() : '';
      if (v && !v.startsWith('asset://') && !v.startsWith('http')) {
        candidates.push(v);
        keys.push(key);
      }
    }
    if (Array.isArray(d.imageUrls)) {
      for (const u of d.imageUrls) {
        if (typeof u === 'string' && u.startsWith(DATA_IMAGE_PREFIX) && !candidates.includes(u)) {
          candidates.push(u);
          keys.push('');
        }
      }
    }
    if (!candidates.length) continue;

    for (let i = 0; i < candidates.length; i++) {
      const url = candidates[i];
      if (!url.startsWith('data:')) continue;
      try {
        const blob = await srcToBlob(url);
        if (!blob.size) continue;
        const assetRef = await putAsset(blob, {
          name: `migrated-${Date.now()}.png`,
          folder: '/迁移',
          workflowId: workflowName ?? null,
        });
        if (!patches[node.id]) patches[node.id] = {};
        const k = keys[i];
        if (k) patches[node.id][k] = assetRef;
        migrated += 1;
      } catch (err) {
        failed += 1;
        log.warn('migrateDataUrlsToAssets', 'fail', { id: node.id, msg: String(err).slice(0, 120) });
      }
    }
  }

  log.info('migrateDataUrlsToAssets', 'done', { nodes: nodes.length, migrated, failed });
  return { patches, migrated, failed };
}

const resolveCache = new Map<string, string>();

export async function resolveAssetRefsInData(
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const changed: Record<string, unknown> = {};
  for (const key of Object.keys(data)) {
    const v = data[key];
    if (typeof v === 'string' && isAssetRef(v)) {
      const cached = resolveCache.get(v);
      if (cached) { changed[key] = cached; continue; }
      const resolved = await getAssetDataUrl(v.slice(ASSET_PREFIX.length));
      if (resolved) {
        resolveCache.set(v, resolved);
        changed[key] = resolved;
      }
    } else if (key === 'imageUrls' && Array.isArray(v)) {
      const resolved = await Promise.all(
        v.map(async (u) => {
          if (typeof u === 'string' && isAssetRef(u)) {
            const cached = resolveCache.get(u);
            if (cached) return cached;
            const r = await getAssetDataUrl(u.slice(ASSET_PREFIX.length));
            if (r) resolveCache.set(u, r);
            return r || u;
          }
          return u;
        }),
      );
      if (resolved.some((r, i) => r !== v[i])) {
        changed.imageUrls = resolved;
      }
    }
  }
  return changed;
}
