// 图生图参考图：图床 URL / 原 URL / PNG Blob

import { prefersJsonImage2Image } from '../../../lib/llm/openaiImages';
import { loadImageHostSettings } from '../../../lib/imageHostSettings';
import { createLogger } from '../../../lib/logger';
import { srcsToBlobs } from './collectUpstream';
import { uploadRefsToHost } from './uploadRefsToHost';

const log = createLogger('resolveEditRefs');

export type EditRefs = {
  editImages?: Blob[];
  editImageUrls?: string[];
};

/** 默认图床（不压缩）；关闭后 Seedream/火山 原 URL，其它模型 PNG Blob */
export async function resolveEditRefs(
  imageSrcs: string[],
  model: string,
  nodeId: string,
  signal?: AbortSignal,
  protocol?: string,
): Promise<EditRefs> {
  if (!imageSrcs.length) return {};
  const refs = imageSrcs.slice(0, 4);
  const host = loadImageHostSettings();
  const jsonI2i = prefersJsonImage2Image(model, protocol);

  if (host.enabled) {
    const t0 = performance.now();
    try {
      log.info('resolveEditRefs', 'host upload start', {
        id: nodeId,
        provider: host.provider,
        n: refs.length,
        protocol: protocol || '',
        kinds: refs.map((u) =>
          u.startsWith('data:') ? 'data' : u.startsWith('http') ? 'http' : 'other',
        ),
      });
      const editImageUrls = await uploadRefsToHost(refs, signal);
      log.info('resolveEditRefs', 'image_host_urls', {
        id: nodeId,
        provider: host.provider,
        n: editImageUrls.length,
        ms: Math.round(performance.now() - t0),
      });
      return { editImageUrls };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // 免费图床 503/429：JSON 图生图可直接用原 http/data URL，避免整次生成失败
      if (jsonI2i) {
        log.warn('resolveEditRefs', 'host fail → raw urls', {
          id: nodeId,
          msg,
          n: refs.length,
        });
        return { editImageUrls: refs };
      }
      throw new Error(`[参考图图床] ${msg}`);
    }
  }

  if (jsonI2i) {
    log.info('resolveEditRefs', 'json_i2i_urls', {
      id: nodeId,
      n: refs.length,
      protocol: protocol || '',
      kinds: refs.map((u) =>
        u.startsWith('data:') ? 'data' : u.startsWith('http') ? 'http' : 'other',
      ),
    });
    return { editImageUrls: refs };
  }

  const tBlob = performance.now();
  const editImages = await srcsToBlobs(refs, signal);
  log.info('resolveEditRefs', 'blobs', {
    id: nodeId,
    n: editImages.length,
    ms: Math.round(performance.now() - tBlob),
    bytes: editImages.reduce((s, b) => s + b.size, 0),
  });
  return { editImages };
}
