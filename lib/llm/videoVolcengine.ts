// NewAPI → 火山引擎（Seedance）生视频
// 端点同通用 /v1/video/generations，body 与通用不同：
// - seconds 必须是字符串
// - resolution / ratio 放 metadata（非顶层 width/height）
// - 多模态参考：images + metadata.content（image/video/audio + role）
//   对齐 cava backend/video_handlers.go

import { createLogger } from '../logger';
import { normalizeOpenAIBase } from './openaiChat';
import type { VideoCreateParams, VideoCreateOk } from './videoCreate';
import {
  formatVideoApiError,
  pickApiErrorText,
  postJson,
  unwrapJob,
  type VideoJob,
} from './videoJobUtils';

const log = createLogger('videoVolcengine');

function parseDuration(seconds?: string | number): number {
  const n =
    typeof seconds === 'number'
      ? seconds
      : parseInt(String(seconds ?? '4').replace(/[^\d]/g, ''), 10);
  if (!Number.isFinite(n) || n <= 0) return 4;
  return Math.min(20, n);
}

function uniqUrls(list?: string[]): string[] {
  const out: string[] = [];
  for (const u of list || []) {
    const t = u?.trim();
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}

function allImages(params: VideoCreateParams): string[] {
  const out: string[] = [];
  if (params.image?.trim()) out.push(params.image.trim());
  for (const u of uniqUrls(params.images)) {
    if (!out.includes(u)) out.push(u);
  }
  return out;
}

function allVideos(params: VideoCreateParams): string[] {
  return uniqUrls(params.videos);
}

function allAudios(params: VideoCreateParams): string[] {
  return uniqUrls(params.audios);
}

/** UI res / size → 480p | 720p | 1080p */
export function mapVolcengineResolution(
  resolution?: string,
  size?: string,
  height?: number,
): string {
  const raw = String(resolution || '').toLowerCase();
  if (/1080|4k|high/.test(raw)) return '1080p';
  if (/480|sd|low/.test(raw)) return '480p';
  if (/720|hd/.test(raw)) return '720p';

  const h =
    typeof height === 'number' && height > 0
      ? height
      : (() => {
          const m = String(size || '').match(/(\d+)\s*[x×]\s*(\d+)/i);
          return m ? parseInt(m[2], 10) : 0;
        })();
  if (h >= 1000) return '1080p';
  if (h > 0 && h <= 500) return '480p';
  return '720p';
}

export function mapVolcengineRatio(aspectRatio?: string, size?: string): string {
  const r = String(aspectRatio || '').trim();
  if (r && /^\d+:\d+$/.test(r)) return r;
  const m = String(size || '').match(/(\d+)\s*[x×]\s*(\d+)/i);
  if (!m) return '16:9';
  const w = parseInt(m[1], 10);
  const h = parseInt(m[2], 10);
  if (!w || !h) return '16:9';
  if (Math.abs(w - h) < Math.min(w, h) * 0.05) return '1:1';
  return w > h ? '16:9' : '9:16';
}

type ContentPart = {
  type: string;
  image_url?: { url: string };
  video_url?: { url: string };
  audio_url?: { url: string };
  role: string;
  /** Seedance 参考权重，默认 1.0。值越大参考图影响越强 */
  weight: number;
};

/** 构建火山/Seedance NewAPI 代理 body（对齐 cava video_handlers.go） */
export function buildVolcengineBody(params: VideoCreateParams): Record<string, unknown> {
  const duration = parseDuration(params.seconds);
  const resolution = mapVolcengineResolution(params.resolution, params.size, params.height);
  const ratio = mapVolcengineRatio(params.aspectRatio, params.size);
  const imgs = allImages(params);
  const vids = allVideos(params);
  const auds = allAudios(params);

  const metadata: Record<string, unknown> = {
    resolution,
    ratio,
  };
  if (params.negativePrompt?.trim()) metadata.negative_prompt = params.negativePrompt.trim();
  if (typeof params.seed === 'number' && Number.isFinite(params.seed)) metadata.seed = params.seed;
  if (typeof params.fps === 'number' && params.fps > 0) metadata.fps = Math.round(params.fps);

  // 多模态参考：images + video + audio 写入 metadata.content（带 role）
  const content: ContentPart[] = [];
  for (const url of imgs) {
    content.push({
      type: 'image_url',
      image_url: { url },
      role: 'reference_image',
      weight: 1.0,
    });
  }
  for (const url of vids) {
    content.push({
      type: 'video_url',
      video_url: { url },
      role: 'reference_video',
      weight: 1.0,
    });
  }
  for (const url of auds) {
    content.push({
      type: 'audio_url',
      audio_url: { url },
      role: 'reference_audio',
      weight: 1.0,
    });
  }
  if (content.length) metadata.content = content;

  const body: Record<string, unknown> = {
    model: params.model,
    prompt: params.prompt,
    seconds: String(duration), // 必须字符串
    metadata,
  };
  // !!! ⚠️ 不发 images 顶层数组，全走 metadata.content !!!
  // - images 数组以纯字符串 URL 发送时，网关火山适配器某些版本会校验每项格式
  // - 报错 "loc:['images',0] model_type" → 期望 object 而非 string
  // - 改为所有参考图/视频/音频只写 metadata.content（带 type/url/role/weight）
  // - cava 发 images + content 双写，但用户网关版本只认 content
  if (typeof params.n === 'number' && params.n > 1) body.n = Math.min(4, Math.round(params.n));

  log.info('buildVolcengineBody', 'body built', {
    seconds: body.seconds,
    resolution,
    ratio,
    imageCount: imgs.length,
    imagePreviews: imgs.map((u) => u.slice(0, 60)),
    videoCount: vids.length,
    audioCount: auds.length,
  });
  return body;
}

export async function createVolcengine(params: VideoCreateParams): Promise<VideoCreateOk> {
  const base = normalizeOpenAIBase(params.baseUrl);
  const body = buildVolcengineBody(params);
  const imgs = allImages(params);
  const vids = allVideos(params);
  const auds = allAudios(params);
  log.info('createVolcengine', 'request', {
    model: params.model,
    seconds: body.seconds,
    resolution: (body.metadata as { resolution?: string })?.resolution,
    ratio: (body.metadata as { ratio?: string })?.ratio,
    imageCount: imgs.length,
    videoCount: vids.length,
    audioCount: auds.length,
    hasContent: Boolean((body.metadata as { content?: unknown })?.content),
  });

  const res = await postJson(`${base}/video/generations`, params.apiKey, body, params.signal);
  if (res.ok && res.json) {
    return { job: unwrapJob(res.json), style: 'newapi-volcengine' };
  }
  const msg = pickApiErrorText(res.json as VideoJob | null, res.text);
  throw new Error(formatVideoApiError(res.status, msg, params.model));
}
