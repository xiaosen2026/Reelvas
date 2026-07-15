// NewAPI 视频：四协议轮询 + 等结果

import { createLogger } from '../logger';
import { normalizeOpenAIBase } from './openaiChat';
import type { VideoCreateOk, VideoCreateParams } from './videoCreate';
import { formatJobProgress } from './formatJobProgress';
import {
  extractUrl,
  formatVideoApiError,
  getJson,
  isTerminalFail,
  isTerminalSuccess,
  jobErrorMessage,
  jobId,
  normalizeHostRoot,
  pickApiErrorText,
  postJson,
  sleep,
  unwrapJob,
  type VideoJob,
} from './videoJobUtils';
import type { VideoProtocolKind } from './videoProtocolResolve';

const log = createLogger('videoPoll');

export type VideoWaitResult = {
  id: string;
  status: string;
  videoUrl: string;
  raw?: unknown;
  protocol?: VideoProtocolKind;
};

async function retrieveGenerations(
  baseUrl: string,
  apiKey: string,
  id: string,
  signal?: AbortSignal,
): Promise<VideoJob> {
  const base = normalizeOpenAIBase(baseUrl);
  const res = await getJson(
    `${base}/video/generations/${encodeURIComponent(id)}`,
    apiKey,
    signal,
  );
  if (!res.ok || !res.json) {
    throw new Error(
      formatVideoApiError(res.status, pickApiErrorText(res.json, res.text)).replace(
        '视频创建失败',
        '视频查询失败',
      ),
    );
  }
  return unwrapJob(res.json);
}

async function retrieveSora(
  baseUrl: string,
  apiKey: string,
  id: string,
  signal?: AbortSignal,
): Promise<VideoJob> {
  const base = normalizeOpenAIBase(baseUrl);
  const res = await getJson(`${base}/videos/${encodeURIComponent(id)}`, apiKey, signal);
  if (!res.ok || !res.json) {
    throw new Error(
      formatVideoApiError(res.status, pickApiErrorText(res.json, res.text)).replace(
        '视频创建失败',
        '视频查询失败',
      ),
    );
  }
  return unwrapJob(res.json);
}

async function retrieveKling(
  baseUrl: string,
  apiKey: string,
  id: string,
  mode: 'image2video' | 'text2video',
  signal?: AbortSignal,
): Promise<VideoJob> {
  const root = normalizeHostRoot(baseUrl);
  const res = await getJson(
    `${root}/kling/v1/videos/${mode}/${encodeURIComponent(id)}`,
    apiKey,
    signal,
  );
  if (!res.ok || !res.json) {
    throw new Error(
      formatVideoApiError(res.status, pickApiErrorText(res.json, res.text)).replace(
        '视频创建失败',
        '视频查询失败',
      ),
    );
  }
  return unwrapJob(res.json);
}

async function retrieveJimeng(
  baseUrl: string,
  apiKey: string,
  id: string,
  reqKey: string,
  signal?: AbortSignal,
): Promise<VideoJob> {
  const root = normalizeHostRoot(baseUrl);
  const url = `${root}/jimeng/?Action=CVSync2AsyncGetResult&Version=2022-08-31`;
  const res = await postJson(
    url,
    apiKey,
    { req_key: reqKey || 'jimeng_vgfm_t2v_l20', task_id: id },
    signal,
  );
  if (!res.ok || !res.json) {
    throw new Error(
      formatVideoApiError(res.status, pickApiErrorText(res.json, res.text)).replace(
        '视频创建失败',
        '视频查询失败',
      ),
    );
  }
  const job = unwrapJob(res.json);
  if (!job.status && res.json.data && !Array.isArray(res.json.data)) {
    const st = (res.json.data as { status?: string }).status;
    if (st) job.status = st;
  }
  const code = res.json.code;
  if (code != null && Number(code) !== 0 && Number(code) !== 10000) {
    job.status = 'failed';
    job.fail_reason = jobErrorMessage(job) || String(res.json.message || code);
  }
  return job;
}

async function fetchVideoContentUrl(
  baseUrl: string,
  apiKey: string,
  id: string,
  signal?: AbortSignal,
): Promise<string> {
  const base = normalizeOpenAIBase(baseUrl);
  const res = await fetch(`${base}/videos/${encodeURIComponent(id)}/content`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${apiKey}` },
    signal,
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`content 失败 ${res.status}`);
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    return extractUrl(unwrapJob((await res.json()) as VideoJob));
  }
  if (ct.startsWith('video/') || ct === 'application/octet-stream') {
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  }
  if (res.url && !res.url.includes('/content')) return res.url;
  return res.url || '';
}

async function retrieveByStyle(
  params: VideoCreateParams,
  created: VideoCreateOk,
  id: string,
): Promise<VideoJob> {
  switch (created.style) {
    case 'newapi-generations':
    case 'newapi-volcengine':
      // 火山与通用同查询端点 GET /v1/video/generations/{id}
      return retrieveGenerations(params.baseUrl, params.apiKey, id, params.signal);
    case 'newapi-sora':
      return retrieveSora(params.baseUrl, params.apiKey, id, params.signal);
    case 'newapi-kling':
      return retrieveKling(
        params.baseUrl,
        params.apiKey,
        id,
        created.klingMode || 'text2video',
        params.signal,
      );
    case 'newapi-jimeng':
      return retrieveJimeng(
        params.baseUrl,
        params.apiKey,
        id,
        created.jimengReqKey || params.model || 'jimeng_vgfm_t2v_l20',
        params.signal,
      );
    default:
      return retrieveGenerations(params.baseUrl, params.apiKey, id, params.signal);
  }
}

export type WaitVideoOptions = {
  pollIntervalMs?: number;
  timeoutMs?: number;
  /** 轮询进度，如 42% */
  onProgress?: (label: string) => void;
};

export async function waitVideoResult(
  params: VideoCreateParams & WaitVideoOptions,
  created: VideoCreateOk,
): Promise<VideoWaitResult> {
  const pollIntervalMs = params.pollIntervalMs ?? 2500;
  const timeoutMs = params.timeoutMs ?? 10 * 60 * 1000;
  const started = Date.now();
  let job = created.job;
  const style = created.style;
  let url = extractUrl(job);
  const id = jobId(job);

  const emitProgress = (j: VideoJob, phase?: string) => {
    const pct = formatJobProgress(j.progress);
    const label = pct || phase || '';
    if (label) params.onProgress?.(label);
  };

  if (url) {
    log.info('waitVideoResult', 'sync url', { id, style });
    params.onProgress?.('100%');
    return { id, status: job.status || 'completed', videoUrl: url, raw: job, protocol: style };
  }
  if (!id) throw new Error('视频任务未返回 id，且无直接 URL');

  emitProgress(job, '排队中…');

  while (Date.now() - started < timeoutMs) {
    if (params.signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    const status = job.status || '';
    if (isTerminalFail(status)) {
      throw new Error(jobErrorMessage(job) || `视频生成失败: ${status}`);
    }
    url = extractUrl(job);
    if (url && (isTerminalSuccess(status) || !status)) {
      log.info('waitVideoResult', 'completed', {
        id,
        style,
        status,
        elapsedMs: Date.now() - started,
      });
      params.onProgress?.('100%');
      return { id, status: status || 'completed', videoUrl: url, raw: job, protocol: style };
    }
    if (isTerminalSuccess(status)) {
      if (style === 'newapi-sora') {
        try {
          const contentUrl = await fetchVideoContentUrl(
            params.baseUrl,
            params.apiKey,
            id,
            params.signal,
          );
          if (contentUrl) {
            params.onProgress?.('100%');
            return { id, status, videoUrl: contentUrl, raw: job, protocol: style };
          }
        } catch (e) {
          log.warn('waitVideoResult', 'content fallback failed', {
            err: e instanceof Error ? e.message : String(e),
          });
        }
      }
      throw new Error('视频已完成但未返回可播放地址');
    }

    await sleep(pollIntervalMs, params.signal);
    job = await retrieveByStyle(params, created, id);
    emitProgress(job, status ? `生成中（${status}）` : '生成中…');
    log.debug('waitVideoResult', 'poll', {
      id,
      style,
      status: job.status,
      progress: job.progress,
      hasUrl: Boolean(extractUrl(job)),
    });
  }

  throw new Error(`视频生成超时（>${Math.round(timeoutMs / 1000)}s）`);
}
