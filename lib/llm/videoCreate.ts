// NewAPI 视频：四协议创建任务
//
// !!! ⚠️ 关键设计：通用协议（newapi-generations）内部按模型名自动适配 body 格式 !!!
//
// 同一台 NewAPI 网关的 /v1/video/generations 端点，不同模型需要的字段不同：
//   - Seedance 类（doubao-seedance-* / Seedance *）：
//     seconds=字符串, metadata.resolution/ratio, metadata.content（带 role 的多模态）
//     不用 duration(width/height
//   - 标准类（Kling / Grok / Wan / MiniMax 等）：
//     duration=数字, width, height, image
//
// ⚡ 用户设置协议为「通用视频」即可，代码自动识别模型名切换 body 格式，
//    不依赖协议下拉切换。如果新增模型需特殊 body，在这里加检测条件就行。

import { createLogger } from '../logger';
import { normalizeOpenAIBase } from './openaiChat';
import {
  formatVideoApiError,
  isHttpUrl,
  normalizeHostRoot,
  pickApiErrorText,
  postJson,
  stripDataUrlBase64,
  unwrapJob,
  type VideoJob,
} from './videoJobUtils';
import { resolveVideoProtocol, type VideoProtocolKind } from './videoProtocolResolve';
import { createVolcengine } from './videoVolcengine';
import { createVolcengineOfficialTask, pollVolcengineOfficial } from './videoVolcengineOfficial';
import { createAliyunTask, pollAliyunTask } from './videoAliyun';

const log = createLogger('videoCreate');

export type VideoCreateParams = {
  baseUrl: string;
  apiKey: string;
  model: string;
  prompt: string;
  protocol?: string;
  image?: string;
  images?: string[];
  /** 火山/Seedance 全能参考：参考视频 URL */
  videos?: string[];
  /** 火山/Seedance 全能参考：参考音频 URL */
  audios?: string[];
  seconds?: string | number;
  size?: string;
  width?: number;
  height?: number;
  fps?: number;
  seed?: number;
  n?: number;
  negativePrompt?: string;
  aspectRatio?: string;
  /** 清晰度文案，火山协议写入 metadata.resolution */
  resolution?: string;
  signal?: AbortSignal;
  /** 官方直连协议轮询进度回调 */
  onProgress?: (label: string) => void;
};

export type VideoCreateOk = {
  job: VideoJob;
  style: VideoProtocolKind;
  klingMode?: 'image2video' | 'text2video';
  jimengReqKey?: string;
};

function parseSize(size?: string): { width: number; height: number } {
  const m = String(size || '1280x720').match(/(\d+)\s*[x×]\s*(\d+)/i);
  if (!m) return { width: 1280, height: 720 };
  return { width: parseInt(m[1], 10) || 1280, height: parseInt(m[2], 10) || 720 };
}

export function parseSeconds(seconds?: string | number): number {
  const n =
    typeof seconds === 'number'
      ? seconds
      : parseInt(String(seconds ?? '4').replace(/[^\d]/g, ''), 10);
  if (!Number.isFinite(n) || n <= 0) return 4;
  return Math.min(20, n);
}

function resolveDims(params: VideoCreateParams): {
  width: number;
  height: number;
  size: string;
  duration: number;
} {
  const duration = parseSeconds(params.seconds);
  const parsed = parseSize(params.size);
  const width =
    typeof params.width === 'number' && params.width > 0 ? Math.round(params.width) : parsed.width;
  const height =
    typeof params.height === 'number' && params.height > 0
      ? Math.round(params.height)
      : parsed.height;
  return { width, height, size: `${width}x${height}`, duration };
}

function firstImage(params: VideoCreateParams): string | undefined {
  if (params.image?.trim()) return params.image.trim();
  const list = params.images?.filter((x) => x?.trim()) || [];
  return list[0];
}

function allImages(params: VideoCreateParams): string[] {
  const out: string[] = [];
  if (params.image?.trim()) out.push(params.image.trim());
  for (const u of params.images || []) {
    if (u?.trim() && !out.includes(u.trim())) out.push(u.trim());
  }
  return out;
}

function buildCommonBody(params: VideoCreateParams): Record<string, unknown> {
  const { width, height, duration } = resolveDims(params);
  const body: Record<string, unknown> = {
    model: params.model,
    prompt: params.prompt,
    duration,
    width,
    height,
  };
  const img = firstImage(params);
  if (img) body.image = img;
  if (typeof params.fps === 'number' && params.fps > 0) body.fps = Math.round(params.fps);
  if (typeof params.seed === 'number' && Number.isFinite(params.seed)) body.seed = params.seed;
  if (typeof params.n === 'number' && params.n > 1) body.n = Math.min(4, Math.round(params.n));

  const metadata: Record<string, unknown> = {};
  if (params.negativePrompt?.trim()) metadata.negative_prompt = params.negativePrompt.trim();
  if (typeof params.fps === 'number' && params.fps > 0) metadata.fps = params.fps;
  if (typeof params.seed === 'number' && Number.isFinite(params.seed)) metadata.seed = params.seed;
  if (Object.keys(metadata).length) body.metadata = metadata;
  return body;
}

function throwFromResponse(
  status: number,
  json: VideoJob | null,
  text: string,
  model?: string,
): never {
  const msg = pickApiErrorText(json, text);
  throw new Error(formatVideoApiError(status, msg, model));
}

function isSeedanceModel(model: string): boolean {
  const m = model.toLowerCase();
  return /doubao-seedance|seedance|火山|豆包/i.test(m);
}

async function createGenerations(params: VideoCreateParams): Promise<VideoCreateOk> {
  const base = normalizeOpenAIBase(params.baseUrl);

  // !!! ⚠️ 通用 /v1/video/generations 端点内部分流 !!!
  // Seedance 类模型需要 volcengine 风格 body（seconds=字符串 + metadata.resolution/ratio/content），
  // 不能用标准 duration+width+height。其它模型走标准 body。
  // 见文件顶注释。
  if (isSeedanceModel(params.model)) {
    log.info('createGenerations', 'auto volcengine body', { model: params.model });
    return createVolcengine(params);
  }

  const body = buildCommonBody(params);
  log.info('createGenerations', 'request', {
    model: params.model,
    hasImage: Boolean(firstImage(params)),
    duration: body.duration,
  });
  const res = await postJson(`${base}/video/generations`, params.apiKey, body, params.signal);
  if (res.ok && res.json) {
    return { job: unwrapJob(res.json), style: 'newapi-generations' };
  }
  throwFromResponse(res.status, res.json, res.text, params.model);
}

async function createSora(params: VideoCreateParams): Promise<VideoCreateOk> {
  const base = normalizeOpenAIBase(params.baseUrl);
  const { width, height, size, duration } = resolveDims(params);
  const body: Record<string, unknown> = {
    model: params.model,
    prompt: params.prompt,
    seconds: String(duration),
    size,
    duration,
    width,
    height,
  };
  const img = firstImage(params);
  if (img) body.image = img;
  if (typeof params.fps === 'number' && params.fps > 0) body.fps = Math.round(params.fps);
  if (typeof params.seed === 'number' && Number.isFinite(params.seed)) body.seed = params.seed;
  if (typeof params.n === 'number' && params.n > 1) body.n = Math.min(4, Math.round(params.n));
  const metadata: Record<string, unknown> = {};
  if (params.negativePrompt?.trim()) metadata.negative_prompt = params.negativePrompt.trim();
  if (Object.keys(metadata).length) body.metadata = metadata;

  log.info('createSora', 'request', {
    model: params.model,
    size,
    duration,
    hasImage: Boolean(img),
  });
  const res = await postJson(`${base}/videos`, params.apiKey, body, params.signal);
  if (res.ok && res.json) {
    return { job: unwrapJob(res.json), style: 'newapi-sora' };
  }
  throwFromResponse(res.status, res.json, res.text, params.model);
}

async function createKling(params: VideoCreateParams): Promise<VideoCreateOk> {
  const root = normalizeHostRoot(params.baseUrl);
  const img = firstImage(params);
  const mode: 'image2video' | 'text2video' = img ? 'image2video' : 'text2video';
  const body = buildCommonBody(params);
  if (mode === 'image2video' && img) body.image = img;
  if (mode === 'text2video') delete body.image;

  const url = `${root}/kling/v1/videos/${mode}`;
  log.info('createKling', 'request', { mode, model: params.model, hasImage: Boolean(img) });
  const res = await postJson(url, params.apiKey, body, params.signal);
  if (res.ok && res.json) {
    return { job: unwrapJob(res.json), style: 'newapi-kling', klingMode: mode };
  }
  throwFromResponse(res.status, res.json, res.text, params.model);
}

async function createJimeng(params: VideoCreateParams): Promise<VideoCreateOk> {
  const root = normalizeHostRoot(params.baseUrl);
  const duration = parseSeconds(params.seconds);
  const frames = duration >= 10 ? 241 : 121;
  const reqKey = params.model || 'jimeng_vgfm_t2v_l20';
  const body: Record<string, unknown> = {
    req_key: reqKey,
    prompt: params.prompt,
    frames,
    aspect_ratio: params.aspectRatio || '16:9',
  };
  if (typeof params.seed === 'number' && Number.isFinite(params.seed)) {
    body.seed = params.seed;
  }

  const imgs = allImages(params);
  if (imgs.length) {
    const httpOnes = imgs.filter(isHttpUrl);
    const dataOnes = imgs.filter((u) => !isHttpUrl(u)).map(stripDataUrlBase64);
    if (httpOnes.length) body.image_urls = httpOnes;
    if (dataOnes.length) body.binary_data_base64 = dataOnes;
  }

  const url = `${root}/jimeng/?Action=CVSync2AsyncSubmitTask&Version=2022-08-31`;
  log.info('createJimeng', 'request', { reqKey, frames, imageCount: imgs.length });
  const res = await postJson(url, params.apiKey, body, params.signal);
  if (res.ok && res.json) {
    const code = res.json.code;
    if (code != null && Number(code) !== 0 && Number(code) !== 10000) {
      throwFromResponse(res.status, res.json, res.text, params.model);
    }
    return { job: unwrapJob(res.json), style: 'newapi-jimeng', jimengReqKey: reqKey };
  }
  throwFromResponse(res.status, res.json, res.text, params.model);
}

export async function createVideoJob(params: VideoCreateParams): Promise<VideoCreateOk> {
  const kind = resolveVideoProtocol(params.protocol);
  log.info('createVideoJob', 'route', {
    kind,
    protocol: params.protocol,
    model: params.model,
    hasImage: Boolean(firstImage(params)),
  });

  // !!! 官方直连协议：创建任务 → 轮询等结果 → URL 嵌入 job，waitVideoResult 直接返回 !!!
  if (kind === 'volcengine-direct') {
    const created = await createVolcengineOfficialTask(params, params.signal);
    const pollResult = await pollVolcengineOfficial(params, created, params.onProgress);
    embedUrl(created.job, pollResult.videoUrl, pollResult.status);
    return created;
  }
  if (kind === 'aliyun-direct') {
    const created = await createAliyunTask(params, params.signal);
    const pollResult = await pollAliyunTask(params, created, params.onProgress);
    embedUrl(created.job, pollResult.videoUrl, pollResult.status);
    return created;
  }

  // 默认通用；Sora / 可灵 / 即梦 / 火山 走特殊路径
  switch (kind) {
    case 'newapi-sora':
      return createSora(params);
    case 'newapi-kling':
      return createKling(params);
    case 'newapi-jimeng':
      return createJimeng(params);
    case 'newapi-volcengine':
      return createVolcengine(params);
    case 'newapi-generations':
    default:
      return createGenerations(params);
  }
}

/** 把最终视频 URL 写入 job，waitVideoResult 首轮 extractUrl 就能拿到 */
function embedUrl(job: VideoJob, videoUrl: string, status: string): void {
  job.status = status;
  job.video_url = videoUrl;
  job.result_url = videoUrl;
  job.url = videoUrl;
}
