// 阿里云通义万相官方直连（不走 NewAPI 网关）
//
// 官方 API：https://help.aliyun.com/zh/model-studio/wan-video-to-video-api-reference
// endpoint：POST /api/v1/services/aigc/video-generation/video-synthesis
//   Header: X-DashScope-Async: enable
// 轮询：GET /api/v1/tasks/{task_id}
//
// 与 newapi-generations 的区别：
// - 直接调用阿里云百炼 API，不经过 NewAPI 网关
// - body 使用 input.media 数组（type: first_frame / last_frame / reference_image）
// - 阿里云 API Key（非 NewAPI Key）
//
// 模型命名规则：wan2.7-*（如 wan2.7-i2v-2026-04-25 / wan2.7-t2v-2026-06-12）

import { createLogger } from '../logger';
import { type VideoCreateParams, type VideoCreateOk } from './videoCreate';
import {
  getJson,
  isHttpUrl,
  isTerminalFail,
  isTerminalSuccess,
  jobErrorMessage,
  jobId,
  postJson,
  sleep,
  unwrapJob,
  type VideoJob,
} from './videoJobUtils';
import { formatJobProgress } from './formatJobProgress';

const log = createLogger('videoAliyun');

const DEFAULT_BASE = 'https://dashscope.aliyuncs.com';

// 阿里云异步任务 POST 需要额外 header
async function postJsonAsync(
  url: string,
  apiKey: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<{ ok: boolean; status: number; text: string; json: any }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'X-DashScope-Async': 'enable',
    },
    body: JSON.stringify(body),
    signal,
  });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* ignore */ }
  return { ok: res.ok, status: res.status, text, json };
}

type MediaItem = { type: string; url: string };

export async function createAliyunTask(
  params: VideoCreateParams,
  signal?: AbortSignal,
): Promise<VideoCreateOk> {
  const base = (params.baseUrl || DEFAULT_BASE).replace(/\/+$/, '');
  const allImgs = collectImages(params);

  const media: MediaItem[] = [];
  if (allImgs.length === 1) {
    media.push({ type: 'first_frame', url: allImgs[0] });
  } else if (allImgs.length >= 2) {
    media.push({ type: 'first_frame', url: allImgs[0] });
    media.push({ type: 'last_frame', url: allImgs[1] });
  }

  const duration = parseDuration(params.seconds);

  const body: Record<string, unknown> = {
    model: params.model,
    input: {
      prompt: params.prompt?.trim() || '',
    },
    parameters: {
      resolution: params.resolution || '720P',
      ratio: params.aspectRatio || '16:9',
      duration,
      prompt_extend: true,
      watermark: false,
    },
  };

  // 有参考图才加 media；纯文生视频不加
  if (media.length > 0) {
    (body.input as Record<string, unknown>).media = media;
  }

  // 文生视频模型映射
  const isT2V = !media.length;

  log.info('createAliyunTask', 'request', {
    model: params.model,
    mode: isT2V ? 't2v' : 'i2v',
    imageCount: allImgs.length,
    duration,
    ratio: (body.parameters as Record<string, unknown>).ratio,
  });

  const res = await postJsonAsync(
    `${base}/api/v1/services/aigc/video-generation/video-synthesis`,
    params.apiKey,
    body,
    signal,
  );

  if (!res.ok || !res.json) {
    const msg = (res.json as any)?.message || res.text.slice(0, 200);
    throw new Error(`阿里云任务创建失败 ${res.status}: ${msg}`);
  }

  // 阿里云返回：{ output: { task_id: "..." }, request_id: "..." }
  const taskId = res.json?.output?.task_id || res.json?.task_id || '';
  if (!taskId) {
    throw new Error(`阿里云未返回任务 ID：${res.text.slice(0, 200)}`);
  }

  const job = unwrapJob({ id: taskId, task_id: taskId, status: 'pending' } as VideoJob);
  log.info('createAliyunTask', 'created', { taskId });

  return { job, style: 'aliyun-direct' };
}

function collectImages(params: VideoCreateParams): string[] {
  const out: string[] = [];
  const push = (u?: string) => {
    const t = String(u || '').trim();
    if (t && isHttpUrl(t) && !out.includes(t)) out.push(t);
  };
  push(params.image);
  for (const u of params.images || []) push(u);
  return out;
}

function parseDuration(v?: string | number): number {
  const n = typeof v === 'number' ? v : parseInt(String(v || '5').replace(/[^\d]/g, ''), 10);
  if (!Number.isFinite(n) || n <= 0) return 5;
  return Math.min(15, n);
}

export async function pollAliyunTask(
  params: VideoCreateParams,
  created: VideoCreateOk,
  onProgress?: (label: string) => void,
): Promise<{ videoUrl: string; id: string; status: string }> {
  const base = (params.baseUrl || DEFAULT_BASE).replace(/\/+$/, '');
  const id = jobId(created.job);
  if (!id) throw new Error('阿里云任务无 ID');

  const pollIntervalMs = 3000;
  const timeoutMs = 10 * 60 * 1000;
  const started = Date.now();

  onProgress?.('排队中…');

  while (Date.now() - started < timeoutMs) {
    if (params.signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    const res = await getJson(`${base}/api/v1/tasks/${encodeURIComponent(id)}`, params.apiKey, params.signal);
    if (!res.ok || !res.json) {
      await sleep(pollIntervalMs, params.signal);
      continue;
    }

    const data = res.json as Record<string, any>;
    // 阿里云返回：{ output: { task_status, video_url, ... }, request_id }
    const output = data.output || data;
    const status = String(output.task_status || output.status || '').toLowerCase();
    const pct = formatJobProgress(output.progress);

    if (pct) onProgress?.(pct);

    // 提取视频 URL
    let videoUrl = '';
    if (typeof output.video_url === 'string') videoUrl = output.video_url;
    else if (typeof output.url === 'string') videoUrl = output.url;
    else if (Array.isArray(output.results) && output.results[0]?.url) videoUrl = output.results[0].url;

    if (isTerminalSuccess(status)) {
      if (videoUrl) {
        onProgress?.('100%');
        return { videoUrl, id, status };
      }
      await sleep(pollIntervalMs, params.signal);
      continue;
    }

    if (isTerminalFail(status)) {
      throw new Error(
        (output.message || (data as any)?.message || `阿里云任务失败: ${status}`),
      );
    }

    onProgress?.(pct || `生成中（${status}）`);
    await sleep(pollIntervalMs, params.signal);
  }

  throw new Error(`阿里云任务超时（>${Math.round(timeoutMs / 1000)}s）`);
}
