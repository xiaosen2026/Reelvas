// OpenAI 兼容 Images API：generations / edits；图床 URL 图生图

import { createLogger } from '../logger';
import { normalizeOpenAIBase } from './openaiChat';
import { proxiedImageFetch } from './imageProxyFetch';
import {
  resolveImageCount,
  resolveImageQuality,
  resolveImageSize,
  resolveImageSizeFromSpec,
  type ImageAspect,
  type ImageQuality,
  type ImageRes,
  type ImageSizeSpec,
} from './imageSizeUtils';
import { prefersJsonImage2ImageByProtocol } from './imageProtocolResolve';

export type { ImageAspect, ImageQuality, ImageRes, ImageSizeSpec };
export {
  resolveImageCount,
  resolveImageQuality,
  resolveImageSize,
  resolveImageSizeFromSpec,
};

const log = createLogger('openaiImages');

export interface ImageGenerateParams {
  baseUrl: string;
  apiKey: string;
  model: string;
  prompt: string;
  n?: number;
  size?: string;
  quality?: string;
  /** 豆包/Seedream 常用：如 9:16（与 cava 对齐） */
  aspectRatio?: string;
  /** 豆包/Seedream 常用：1K / 2K / 4K（与 cava 对齐） */
  imageSize?: string;
  signal?: AbortSignal;
}

export interface ImageEditParams extends ImageGenerateParams {
  image?: Blob;
  images?: Blob[];
  /** 公网图床 / 上游 http(s)；优先 JSON image 字段 */
  imageUrls?: string[];
  mask?: Blob;
}

export interface ImageGenerateResult {
  urls: string[];
  model: string;
  rawCount: number;
}

function maskKey(key: string): string {
  if (key.length <= 4) return '***';
  return `${key.slice(0, 2)}***${key.slice(-2)}`;
}

export {
  prefersJsonImage2ImageByProtocol,
  resolveImageProtocol,
  normalizeImageProtocolLabel,
  IMAGE_PROTOCOL_OPTIONS,
} from './imageProtocolResolve';
export type { ImageProtocolKind } from './imageProtocolResolve';

/** Seedream / 豆包等：优先 JSON + URL（协议优先，否则模型名启发式） */
export function prefersJsonImage2Image(model: string, protocol?: string): boolean {
  return prefersJsonImage2ImageByProtocol(protocol, model);
}

export function normalizeImageSrc(item: Record<string, unknown>): string | null {
  const url =
    (typeof item.url === 'string' && item.url) ||
    (typeof item.image_url === 'string' && item.image_url) ||
    (typeof item.imageUrl === 'string' && item.imageUrl) ||
    null;
  if (url) {
    const u = url.trim();
    if (u.startsWith('//')) return `https:${u}`;
    return u;
  }
  const rawB64 =
    (typeof item.b64_json === 'string' && item.b64_json) ||
    (typeof item.b64 === 'string' && item.b64) ||
    (typeof item.base64 === 'string' && item.base64) ||
    (typeof item.image_base64 === 'string' && item.image_base64) ||
    null;
  if (!rawB64) return null;
  const b64 = rawB64.trim();
  if (b64.startsWith('data:')) return b64;
  const mime = b64.startsWith('/9j/') ? 'image/jpeg' : 'image/png';
  return `data:${mime};base64,${b64}`;
}

function dataUrlsFromResponse(data: {
  data?: Array<Record<string, unknown>>;
  images?: Array<Record<string, unknown>>;
  result?: Array<Record<string, unknown>>;
}): string[] {
  const list = data.data ?? data.images ?? data.result ?? [];
  const urls: string[] = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const src = normalizeImageSrc(item as Record<string, unknown>);
    if (src) urls.push(src);
  }
  return urls;
}

/** POST /v1/images/generations */
export async function imageGenerations(params: ImageGenerateParams): Promise<ImageGenerateResult> {
  const {
    apiKey, model, prompt, n = 1, size, quality, aspectRatio, imageSize, signal,
  } = params;
  const base = normalizeOpenAIBase(params.baseUrl);
  const url = `${base}/images/generations`;
  const payload: Record<string, unknown> = { model, prompt, n, response_format: 'url' };
  if (size) payload.size = size;
  if (quality) payload.quality = quality;
  // 文生图也带上 cava 同款字段（部分网关只认这俩）
  if (aspectRatio && aspectRatio !== 'auto') payload.aspect_ratio = aspectRatio;
  if (imageSize) payload.image_size = imageSize;

  log.info('imageGenerations', 'request', {
    url, model, n, size: size ?? null, quality: quality ?? null,
    aspectRatio: aspectRatio ?? null, imageSize: imageSize ?? null,
    promptLen: prompt.length, apiKey: maskKey(apiKey),
  });

  const res = await proxiedImageFetch(url, {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(payload),
    signal,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    log.error('imageGenerations', 'http error', { status: res.status, body: body.slice(0, 500) });
    throw new Error(`图像生成失败 ${res.status}: ${body.slice(0, 200) || res.statusText}`);
  }
  const data = (await res.json()) as {
    model?: string; data?: Array<Record<string, unknown>>; images?: Array<Record<string, unknown>>;
  };
  const urls = dataUrlsFromResponse(data);
  log.info('imageGenerations', 'ok', { count: urls.length, model: data.model ?? model });
  return { urls, model: data.model ?? model, rawCount: urls.length };
}

/** URL 参考图：JSON → /images/generations（edits 仅 multipart，JSON 会 500） */
async function jsonImage2Image(params: {
  baseUrl: string; apiKey: string; model: string; prompt: string;
  n: number; size?: string; quality?: string; aspectRatio?: string;
  imageSize?: string; imageUrls: string[]; signal?: AbortSignal;
}): Promise<ImageGenerateResult> {
  const {
    apiKey, model, prompt, n, size, quality,
    aspectRatio, imageSize, imageUrls, signal,
  } = params;
  const base = normalizeOpenAIBase(params.baseUrl);
  const url = `${base}/images/generations`;
  // 火山官方多图：image 为 string[]；单图保持 string（兼容 cava / 旧网关）
  // scalar image=首张 会导致多参考只吃图1；images[] 作兼容字段
  const imageField: string | string[] =
    imageUrls.length === 1 ? imageUrls[0] : imageUrls;
  const payload: Record<string, unknown> = {
    model, prompt, n, response_format: 'url',
    image: imageField, images: imageUrls,
  };
  if (size) payload.size = size;
  if (quality) payload.quality = quality;
  if (aspectRatio && aspectRatio !== 'auto') payload.aspect_ratio = aspectRatio;
  if (imageSize) payload.image_size = imageSize;

  log.info('jsonImage2Image', 'request', {
    url, model, n, size: size ?? null, aspectRatio: aspectRatio ?? null,
    imageSize: imageSize ?? null, imageCount: imageUrls.length,
    imageIsArray: Array.isArray(imageField),
    hosts: imageUrls.map((u) => { try { return new URL(u).host; } catch { return 'invalid'; } }),
    apiKey: maskKey(apiKey),
  });

  const res = await proxiedImageFetch(url, {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(payload),
    signal,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    log.error('jsonImage2Image', 'http error', { status: res.status, body: body.slice(0, 500) });
    throw new Error(`图生图失败 ${res.status}: ${body.slice(0, 200) || res.statusText}`);
  }
  const data = (await res.json()) as {
    model?: string; data?: Array<Record<string, unknown>>; images?: Array<Record<string, unknown>>;
  };
  const urls = dataUrlsFromResponse(data);
  log.info('jsonImage2Image', 'ok', { count: urls.length, model: data.model ?? model });
  return { urls, model: data.model ?? model, rawCount: urls.length };
}

/** imageUrls → generations JSON；Blob → edits multipart */
export async function imageEdits(params: ImageEditParams): Promise<ImageGenerateResult> {
  const {
    apiKey, model, prompt, n = 1, size, quality, aspectRatio, imageSize,
    image, images, imageUrls, mask, signal,
  } = params;
  const base = normalizeOpenAIBase(params.baseUrl);
  const urlList = (imageUrls || []).map((u) => u.trim()).filter(Boolean);
  const blobList: Blob[] = [];
  if (images?.length) blobList.push(...images);
  else if (image) blobList.push(image);

  if (urlList.length > 0) {
    return jsonImage2Image({
      baseUrl: params.baseUrl, apiKey, model, prompt, n, size, quality,
      aspectRatio, imageSize, imageUrls: urlList, signal,
    });
  }
  if (!blobList.length) throw new Error('图像编辑缺少参考图');

  const url = `${base}/images/edits`;
  log.info('imageEdits', 'multipart', {
    url, model, n, size: size || null, promptLen: prompt.length,
    imageCount: blobList.length, imageBytes: blobList.map((b) => b.size),
    imageTypes: blobList.map((b) => b.type), hasMask: !!mask, apiKey: maskKey(apiKey),
  });

  const form = new FormData();
  blobList.forEach((blob, i) => {
    const mime = blob.type || 'image/png';
    const ext = mime.includes('jpeg') || mime.includes('jpg') ? 'jpg' : 'png';
    form.append('image', blob, `image_${i}.${ext}`);
  });
  form.append('prompt', prompt);
  if (model) form.append('model', model);
  form.append('n', String(n));
  form.append('response_format', 'url');
  if (size) form.append('size', size);
  if (quality) form.append('quality', quality);
  if (aspectRatio && aspectRatio !== 'auto') form.append('aspect_ratio', aspectRatio);
  if (imageSize) form.append('image_size', imageSize);
  if (mask) form.append('mask', mask, 'mask.png');

  const res = await proxiedImageFetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    signal,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    log.error('imageEdits', 'http error', { status: res.status, body: body.slice(0, 500) });
    throw new Error(`图像编辑失败 ${res.status}: ${body.slice(0, 200) || res.statusText}`);
  }
  const data = (await res.json()) as {
    model?: string; data?: Array<Record<string, unknown>>; images?: Array<Record<string, unknown>>;
  };
  const urls = dataUrlsFromResponse(data);
  log.info('imageEdits', 'ok', { count: urls.length, model: data.model ?? model });
  return { urls, model: data.model ?? model, rawCount: urls.length };
}
