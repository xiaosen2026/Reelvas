// 批量取图：优先一次 n 张；网关只回 1 张时再逐张补齐

import {
  imageEdits,
  imageGenerations,
  prefersJsonImage2Image,
  type ImageGenerateResult,
} from '../../../lib/llm/openaiImages';
import { createLogger } from '../../../lib/logger';

const log = createLogger('fetchImageBatch');

export type FetchImageBatchParams = {
  baseUrl: string;
  apiKey: string;
  model: string;
  prompt: string;
  n: number;
  size?: string;
  quality?: string;
  /** 渠道协议：NewAPI（火山）等，驱动图生图路径 */
  protocol?: string;
  /** 与 cava 对齐：9:16 等 */
  aspectRatio?: string;
  /** 与 cava 对齐：1K / 2K / 4K */
  imageSize?: string;
  /** multipart 路径用 Blob；Seedream 可只传 editImageUrls */
  editImages?: Blob[];
  /** Seedream JSON 图生图：原始 http(s)/data URL */
  editImageUrls?: string[];
  signal?: AbortSignal;
};

function pushUrls(target: string[], list: string[], limit: number) {
  for (const u of list) {
    if (target.length >= limit) break;
    if (u) target.push(u);
  }
}

/** 请求最多 n 张图，尽量凑满 */
export async function fetchImageBatch(params: FetchImageBatchParams): Promise<string[]> {
  const {
    baseUrl, apiKey, model, prompt, n, size, quality, protocol,
    aspectRatio, imageSize,
    editImages, editImageUrls, signal,
  } = params;
  const urls: string[] = [];
  const useEdit = !!(editImages?.length || editImageUrls?.length);
  const mode = !useEdit
    ? 'generations'
    : prefersJsonImage2Image(model, protocol)
      ? 'json-generations-i2i' // URL 参考图：/images/generations JSON（edits 仅 multipart）
      : 'multipart-edits';

  const once = async (count: number): Promise<ImageGenerateResult> => {
    if (useEdit) {
      return imageEdits({
        baseUrl,
        apiKey,
        model,
        prompt,
        n: count,
        size,
        quality,
        aspectRatio,
        imageSize,
        images: editImages,
        imageUrls: editImageUrls,
        signal,
      });
    }
    return imageGenerations({
      baseUrl,
      apiKey,
      model,
      prompt,
      n: count,
      size,
      quality,
      aspectRatio,
      imageSize,
      signal,
    });
  };

  log.info('fetchImageBatch', 'start', {
    n, mode, urlCount: editImageUrls?.length ?? 0, blobCount: editImages?.length ?? 0,
  });
  const first = await once(n);
  pushUrls(urls, first.urls, n);

  while (urls.length < n && !signal?.aborted) {
    const more = await once(1);
    if (!more.urls.length) break;
    pushUrls(urls, more.urls, n);
  }

  log.info('fetchImageBatch', 'ok', { want: n, got: urls.length });
  return urls;
}
