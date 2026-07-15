// 火山引擎 Seedance 官方直连（不走 NewAPI 网关）
//
// 官方 API：https://www.volcengine.com/docs/6492/2165104
// endpoint：POST /api/v1/contents/generations/tasks
//
// 与 newapi-volcengine 的区别：
// - 直接调用火山引擎官方 API，不经过 NewAPI 网关
// - body 使用 content 数组（type: text / image_url），不是 images + metadata.content
// - 官方 API Key（非 NewAPI Key）
//
// 模型命名规则：doubao-seedance-{version}（如 doubao-seedance-1-5-pro-251215）

import { createLogger } from '../logger';
import { type VideoCreateParams, type VideoCreateOk } from './videoCreate';
import {
  extractUrl,
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

const log = createLogger('videoVolcengineOfficial');

const DEFAULT_BASE = 'https://operator.las.cn-beijing.volces.com';

/**
 * 构建火山引擎 endpoint URL。
 * Seedance 1.x（operator.las）：base + /api/v1/contents/generations/tasks
 * Seedance 2.0（ark）：base + /contents/generations/tasks（base 已含 /api/v3）
 */
function apiUrl(base: string, path: string): string {
  const b = base.replace(/\/+$/, '');
  const needsPrefix = !/\/api\/v\d+$/i.test(b);
  return `${b}${needsPrefix ? '/api/v1' : ''}${path}`;
}

type ContentItem =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export async function createVolcengineOfficialTask(
  params: VideoCreateParams,
  signal?: AbortSignal,
): Promise<VideoCreateOk> {
  const base = (params.baseUrl || DEFAULT_BASE).replace(/\/+$/, '');
  const content: ContentItem[] = [];

  // 先写文本提示词（如果有）
  if (params.prompt?.trim()) {
    content.push({ type: 'text', text: params.prompt.trim() });
  }

  // 再写参考图 URL
  const allImgs = collectImages(params);
  for (const url of allImgs) {
    if (isHttpUrl(url)) {
      content.push({ type: 'image_url', image_url: { url } });
    }
  }

  if (!content.length) {
    throw new Error('至少需要文本描述或参考图片');
  }

  const duration = parseDuration(params.seconds);
  const body: Record<string, unknown> = {
    model: params.model,
    content,
    ratio: params.aspectRatio || '16:9',
    duration,
    watermark: false,
  };
  if (typeof params.seed === 'number' && Number.isFinite(params.seed)) {
    body.seed = params.seed;
  }

  log.info('createVolcengineOfficialTask', 'request', {
    model: params.model,
    contentTypes: content.map((c) => c.type).join('+'),
    ratio: body.ratio,
    duration,
  });

  const res = await postJson(apiUrl(base, '/contents/generations/tasks'), params.apiKey, body, signal);
  if (!res.ok || !res.json) {
    throw new Error(
      `火山引擎任务创建失败 ${res.status}: ${(res.json as any)?.message || res.text.slice(0, 200)}`,
    );
  }

  // 官方返回格式：{ id: "task-xxx", status: "queued" }
  const job = unwrapJob(res.json as VideoJob);
  const id = jobId(job);
  if (!id) {
    throw new Error(`火山引擎未返回任务 ID：${res.text.slice(0, 200)}`);
  }

  log.info('createVolcengineOfficialTask', 'created', { id, status: job.status });
  return { job, style: 'volcengine-direct', klingMode: undefined };
}

// 收集所有图片 URL（去重）
function collectImages(params: VideoCreateParams): string[] {
  const out: string[] = [];
  const push = (u?: string) => {
    const t = String(u || '').trim();
    if (t && !out.includes(t)) out.push(t);
  };
  push(params.image);
  for (const u of params.images || []) push(u);
  return out;
}

function parseDuration(v?: string | number): number {
  const n = typeof v === 'number' ? v : parseInt(String(v || '4').replace(/[^\d]/g, ''), 10);
  if (!Number.isFinite(n) || n <= 0) return 5;
  return Math.min(12, n);
}

export async function pollVolcengineOfficial(
  params: VideoCreateParams,
  created: VideoCreateOk,
  onProgress?: (label: string) => void,
): Promise<{ videoUrl: string; id: string; status: string }> {
  const base = (params.baseUrl || DEFAULT_BASE).replace(/\/+$/, '');
  const id = jobId(created.job);
  if (!id) throw new Error('火山引擎任务无 ID');

  const pollIntervalMs = 2500;
  const timeoutMs = 10 * 60 * 1000;
  const started = Date.now();

  onProgress?.('排队中…');

  while (Date.now() - started < timeoutMs) {
    if (params.signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    const res = await getJson(apiUrl(base, `/contents/generations/tasks/${encodeURIComponent(id)}`), params.apiKey, params.signal);
    if (!res.ok || !res.json) {
      await sleep(pollIntervalMs, params.signal);
      continue;
    }

    const data = res.json as Record<string, any>;
    const status = String(data.status || '').toLowerCase();
    const progress = formatJobProgress(data.progress);

    if (progress) onProgress?.(progress);

    // 尝试提取视频 URL（各版本返回位置不同）
    let videoUrl = '';
    if (typeof data.output?.video_url === 'string') videoUrl = data.output.video_url;
    else if (typeof data.video_url === 'string') videoUrl = data.video_url;
    else if (typeof data.result?.video_url === 'string') videoUrl = data.result.video_url;
    else if (Array.isArray(data.output)) {
      for (const item of data.output) {
        if (typeof item?.video_url === 'string') { videoUrl = item.video_url; break; }
        if (typeof item?.url === 'string') { videoUrl = item.url; break; }
      }
    }

    if (isTerminalSuccess(status)) {
      if (videoUrl) {
        onProgress?.('100%');
        return { videoUrl, id, status };
      }
      // 成功但无 URL → 继续等
      await sleep(pollIntervalMs, params.signal);
      continue;
    }

    if (isTerminalFail(status)) {
      throw new Error(jobErrorMessage(data as VideoJob) || `火山引擎任务失败: ${status}`);
    }

    onProgress?.(progress || `生成中（${status}）`);
    await sleep(pollIntervalMs, params.signal);
  }

  throw new Error(`火山引擎任务超时（>${Math.round(timeoutMs / 1000)}s）`);
}
