// 视频任务：解包 / 取 URL / 终态判断（各协议共用）

export type VideoJob = {
  id?: string | number;
  task_id?: string;
  status?: string;
  error?: { message?: string; code?: string | number } | string | null;
  message?: string;
  code?: string | number;
  fail_reason?: string;
  video_url?: string;
  result_url?: string;
  url?: string;
  format?: string;
  progress?: string | number;
  metadata?: { url?: string; video_url?: string } | null;
  content?: { video_url?: string; url?: string } | null;
  output?: { url?: string } | Array<{ url?: string }>;
  result?: { url?: string; video_url?: string };
  data?:
    | Array<{ url?: string; b64_json?: string }>
    | {
        result_url?: string;
        url?: string;
        video_url?: string;
        status?: string;
        content?: { video_url?: string; url?: string };
        task_id?: string;
        fail_reason?: string;
        BinaryDataBase64?: unknown;
        videoUrl?: string;
      };
};

export function authHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const t = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/** 主机根路径：去掉尾斜杠与末尾 /v1，供 /kling /jimeng 使用 */
export function normalizeHostRoot(baseUrl: string): string {
  let base = baseUrl.trim().replace(/\/+$/, '');
  base = base.replace(/\/v\d+$/i, '');
  return base.replace(/\/+$/, '');
}

export function extractUrl(job: VideoJob): string {
  if (job.video_url) return job.video_url;
  if (job.result_url) return job.result_url;
  if (job.content?.video_url) return job.content.video_url;
  if (job.content?.url) return job.content.url;
  if (job.metadata?.video_url) return job.metadata.video_url;
  if (job.metadata?.url) return job.metadata.url;
  if (job.url) return job.url;
  if (job.result?.video_url) return job.result.video_url;
  if (job.result?.url) return job.result.url;
  if (Array.isArray(job.output) && job.output[0]?.url) return job.output[0].url;
  if (job.output && !Array.isArray(job.output) && job.output.url) return job.output.url;
  if (job.data && !Array.isArray(job.data)) {
    const d = job.data as Record<string, unknown>;
    if (typeof d.result_url === 'string') return d.result_url;
    if (typeof d.video_url === 'string') return d.video_url;
    if (typeof d.videoUrl === 'string') return d.videoUrl;
    if (typeof d.url === 'string') return d.url;
    const content = d.content as { video_url?: string; url?: string } | undefined;
    if (content?.video_url) return content.video_url;
    if (content?.url) return content.url;
  }
  if (Array.isArray(job.data) && job.data[0]?.url) return job.data[0].url;
  if (Array.isArray(job.data) && job.data[0]?.b64_json) {
    return `data:video/mp4;base64,${job.data[0].b64_json}`;
  }
  return '';
}

/** 兼容 NewAPI 包装 { code, data: { task_id, status, result_url } } 与即梦 data.video_url */
export function unwrapJob(raw: VideoJob | null | undefined): VideoJob {
  if (!raw || typeof raw !== 'object') return {};
  let job: VideoJob = raw;

  const outerData = raw.data;
  const looksLikeTaskRecord =
    outerData &&
    typeof outerData === 'object' &&
    !Array.isArray(outerData) &&
    ((outerData as { task_id?: unknown }).task_id != null ||
      (outerData as { result_url?: unknown }).result_url != null ||
      (outerData as { fail_reason?: unknown }).fail_reason != null ||
      (outerData as { status?: unknown }).status != null ||
      (outerData as { video_url?: unknown }).video_url != null ||
      typeof (outerData as { id?: unknown }).id === 'number');

  if (looksLikeTaskRecord && (raw.code != null || raw.message != null || !raw.status)) {
    job = { ...(outerData as VideoJob), code: raw.code, message: raw.message };
  }

  const inner =
    job.data && typeof job.data === 'object' && !Array.isArray(job.data) ? job.data : null;
  if (inner) {
    if (!job.status && inner.status) job = { ...job, status: inner.status };
    const innerProgress = (inner as { progress?: string | number }).progress;
    if (job.progress == null && innerProgress != null) {
      job = { ...job, progress: innerProgress };
    }
    const innerUrl =
      inner.content?.video_url ||
      inner.content?.url ||
      inner.video_url ||
      (inner as { videoUrl?: string }).videoUrl ||
      inner.url ||
      inner.result_url;
    if (innerUrl) {
      job = {
        ...job,
        video_url: job.video_url || innerUrl,
        result_url: job.result_url || inner.result_url || innerUrl,
        url: job.url || innerUrl,
      };
    }
    if (!job.fail_reason && inner.fail_reason) {
      job = { ...job, fail_reason: inner.fail_reason };
    }
    if (!job.task_id && inner.task_id) {
      job = { ...job, task_id: inner.task_id };
    }
  }

  const taskId = job.task_id || (typeof job.id === 'string' ? job.id : '');
  if (taskId && (typeof job.id !== 'string' || !String(job.id).startsWith('task_'))) {
    job = { ...job, id: taskId, task_id: taskId };
  } else if (!job.id && job.task_id) {
    job = { ...job, id: job.task_id };
  }

  return job;
}

export function jobId(job: VideoJob): string {
  if (typeof job.task_id === 'string' && job.task_id) return job.task_id;
  if (typeof job.id === 'string' && job.id) return job.id;
  if (job.id != null) return String(job.id);
  return '';
}

export function jobErrorMessage(job: VideoJob): string {
  if (job.fail_reason && String(job.fail_reason).trim()) return String(job.fail_reason);
  if (!job.error) {
    if (job.message && job.code != null && Number(job.code) !== 0 && Number(job.code) !== 10000) {
      return `${job.code}: ${job.message}`;
    }
    return '';
  }
  if (typeof job.error === 'string') return job.error;
  return String(job.error.message || JSON.stringify(job.error));
}

export function isTerminalSuccess(status: string): boolean {
  const s = status.toLowerCase();
  // OpenAI completed；NewAPI SUCCESS；可灵/文档 completed；即梦 done
  return (
    s === 'completed' ||
    s === 'succeeded' ||
    s === 'success' ||
    s === 'done' ||
    s === 'successful'
  );
}

export function isTerminalFail(status: string): boolean {
  const s = status.toLowerCase();
  return (
    s === 'failed' ||
    s === 'failure' ||
    s === 'error' ||
    s === 'cancelled' ||
    s === 'canceled' ||
    s === 'not_found'
  );
}

export function pickApiErrorText(
  json: {
    error?: { message?: string; code?: string | number } | string | null;
    message?: string;
    code?: string | number;
  } | null,
  text: string,
): string {
  if (!json) return text.slice(0, 300);
  if (typeof json.error === 'string' && json.error.trim()) return json.error;
  if (json.error && typeof json.error === 'object') {
    const em = [json.error.code, json.error.message].filter(Boolean).join(': ');
    if (em) return em;
  }
  if (json.message || json.code != null) {
    return [json.code, json.message].filter((x) => x != null && x !== '').join(': ');
  }
  return text.slice(0, 300);
}

export function formatVideoApiError(status: number, raw: string, model?: string): string {
  const msg = (raw || '').trim();
  const lower = msg.toLowerCase();
  const modelHint = model?.trim() ? `当前请求模型：${model.trim()}。` : '';
  if (lower.includes('auth_unavailable') || lower.includes('no auth available')) {
    return `网关已收到请求，但上游鉴权不可用（${status}）。${modelHint}请检查视频渠道 API Key / 上游账号。`;
  }
  if (lower.includes('model_not_found') || lower.includes('no available channel for model')) {
    return `当前渠道未开通该视频模型（${status}）。${modelHint}${msg.slice(0, 160)}。请在网关后台绑定渠道或换模型。`;
  }
  if (lower.includes('invalid_api_platform')) {
    return (
      `网关渠道「平台类型」无效（${status}）。${modelHint}` +
      `${msg.slice(0, 140)}。客户端已按通用生视频协议提交；请到 NewAPI 后台打开该模型渠道，` +
      `把平台类型改成与通用视频一致（Seedance 可用渠道为 platform=45 一类），不要用未实现的类型号（如 14）。`
    );
  }
  if (/spending|quota|insufficient|credit|billing/.test(lower)) {
    return `上游视频额度/消费限制（${status}）。${modelHint}${msg.slice(0, 160) || '请检查额度'}。`;
  }
  if (lower.includes('not supported') || lower.includes('unsupported_endpoint')) {
    return `当前渠道视频模型/接口不可用（${status}）。${modelHint}${msg.slice(0, 200)}`;
  }
  return `视频创建失败 ${status}${model?.trim() ? ` [${model.trim()}]` : ''}: ${msg.slice(0, 300) || '未知错误'}`;
}

export async function postJson(
  url: string,
  apiKey: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<{ ok: boolean; status: number; text: string; json: VideoJob | null }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders(apiKey),
    body: JSON.stringify(body),
    signal,
  });
  const text = await res.text();
  let json: VideoJob | null = null;
  try {
    json = JSON.parse(text) as VideoJob;
  } catch {
    /* non-json */
  }
  return { ok: res.ok, status: res.status, text, json };
}

export async function getJson(
  url: string,
  apiKey: string,
  signal?: AbortSignal,
): Promise<{ ok: boolean; status: number; text: string; json: VideoJob | null }> {
  const res = await fetch(url, {
    method: 'GET',
    headers: authHeaders(apiKey),
    signal,
  });
  const text = await res.text();
  let json: VideoJob | null = null;
  try {
    json = JSON.parse(text) as VideoJob;
  } catch {
    /* non-json */
  }
  return { ok: res.ok, status: res.status, text, json };
}

/** dataURL → 纯 base64（去掉 data:image/...;base64, 前缀） */
export function stripDataUrlBase64(src: string): string {
  const m = src.match(/^data:[^;]+;base64,(.+)$/i);
  return m ? m[1] : src;
}

export function isHttpUrl(src: string): boolean {
  return /^https?:\/\//i.test(src.trim());
}
