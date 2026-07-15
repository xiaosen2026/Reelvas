// Suno 音乐生成（NewAPI）：POST /suno/submit/music + GET /suno/fetch/{task_id}

import { createLogger } from '../logger';

const log = createLogger('sunoMusic');

export function isSunoModel(model?: string): boolean {
  const m = String(model || '').toLowerCase();
  return /suno|music|chirp/.test(m);
}

/** 网关根地址：去掉尾斜杠与末尾 /v1 */
export function normalizeSunoRoot(apiBase: string): string {
  let base = String(apiBase || '').trim().replace(/\/+$/, '');
  base = base.replace(/\/v\d+$/i, '');
  return base;
}

function maskKey(key: string): string {
  if (key.length <= 4) return '***';
  return `${key.slice(0, 2)}***${key.slice(-2)}`;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
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

function pickAudioUrl(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const root = payload as Record<string, unknown>;
  const data = (root.data ?? root) as Record<string, unknown>;
  const candidates: unknown[] = [
    data.audio_url,
    data.audioUrl,
    data.url,
    root.audio_url,
    root.audioUrl,
  ];
  const dataData = data.data;
  if (Array.isArray(dataData) && dataData[0] && typeof dataData[0] === 'object') {
    const first = dataData[0] as Record<string, unknown>;
    candidates.push(first.audio_url, first.audioUrl, first.url);
  }
  if (dataData && typeof dataData === 'object' && !Array.isArray(dataData)) {
    const obj = dataData as Record<string, unknown>;
    candidates.push(obj.audio_url, obj.audioUrl, obj.url);
  }
  for (const c of candidates) {
    if (typeof c === 'string' && /^https?:\/\//i.test(c)) return c;
  }
  return null;
}

function asId(v: unknown): string | null {
  if (v == null) return null;
  // NewAPI Suno 提交成功常见：{ code:"success", data:"task_xxx" } —— data 直接是字符串
  if (typeof v === 'string' || typeof v === 'number') {
    const s = String(v).trim();
    return s ? s : null;
  }
  return null;
}

function pickTaskId(payload: unknown): string | null {
  if (payload == null) return null;
  // 裸字符串 / 数字
  const direct = asId(payload);
  if (direct) return direct;
  if (typeof payload !== 'object') return null;

  const root = payload as Record<string, unknown>;
  // data 可能是 string task_id，也可能是对象
  const fromData = asId(root.data);
  if (fromData) return fromData;

  const data =
    root.data && typeof root.data === 'object' && !Array.isArray(root.data)
      ? (root.data as Record<string, unknown>)
      : null;

  const candidates: unknown[] = [
    data?.task_id,
    data?.taskId,
    data?.id,
    data?.task_ids,
    root.task_id,
    root.taskId,
    root.id,
  ];
  for (const c of candidates) {
    const id = asId(c);
    if (id) return id;
    // task_ids: ["task_xxx"]
    if (Array.isArray(c) && c.length) {
      const first = asId(c[0]);
      if (first) return first;
    }
  }
  return null;
}

function pickStatus(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const root = payload as Record<string, unknown>;
  const data = (root.data ?? root) as Record<string, unknown>;
  return String(data.status ?? root.status ?? '').toUpperCase();
}

export async function createSunoMusic(params: {
  apiKey: string;
  apiBase: string;
  model: string;
  prompt?: string;
  lyrics?: string;
  style?: string;
  title?: string;
  instrumental?: boolean;
  signal?: AbortSignal;
}): Promise<{ url: string; taskId?: string }> {
  const root = normalizeSunoRoot(params.apiBase);
  if (!root) throw new Error('Suno API 地址为空');
  if (!params.apiKey.trim()) throw new Error('Suno API Key 为空');

  const prompt = String(params.prompt || params.lyrics || '').trim();
  const lyrics = String(params.lyrics || '').trim();
  if (!prompt && !lyrics && !params.instrumental) {
    throw new Error('请填写歌词或描述');
  }

  const body: Record<string, unknown> = {
    prompt: prompt || lyrics || 'instrumental',
    mv: params.model || 'suno_music',
    make_instrumental: Boolean(params.instrumental),
  };
  if (lyrics) body.prompt = lyrics;
  if (params.style?.trim()) body.tags = params.style.trim();
  if (params.title?.trim()) body.title = params.title.trim();
  // 自定义歌词模式常见字段
  if (lyrics) {
    body.custom_mode = true;
    body.input = {
      prompt: lyrics,
      tags: params.style?.trim() || '',
      title: params.title?.trim() || '',
      make_instrumental: Boolean(params.instrumental),
    };
  }

  const submitUrl = `${root}/suno/submit/music`;
  log.info('createSunoMusic', 'submit', {
    url: submitUrl,
    model: params.model,
    key: maskKey(params.apiKey),
    instrumental: Boolean(params.instrumental),
  });

  const submitRes = await fetch(submitUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.apiKey.trim()}`,
    },
    body: JSON.stringify(body),
    signal: params.signal,
  });

  const submitText = await submitRes.text();
  let submitJson: unknown = null;
  try {
    submitJson = submitText ? JSON.parse(submitText) : null;
  } catch {
    submitJson = { raw: submitText };
  }
  if (!submitRes.ok) {
    const msg =
      (submitJson as { message?: string; error?: { message?: string } } | null)?.message ||
      (submitJson as { error?: { message?: string } } | null)?.error?.message ||
      submitText.slice(0, 200) ||
      `HTTP ${submitRes.status}`;
    log.error('createSunoMusic', 'submit failed', { status: submitRes.status, msg });
    throw new Error(`Suno 提交失败: ${msg}`);
  }

  // 业务失败：HTTP 200 但 code 非 success（部分网关）
  if (submitJson && typeof submitJson === 'object') {
    const code = String((submitJson as { code?: unknown }).code ?? '').toLowerCase();
    if (code && code !== 'success' && code !== '0' && code !== 'ok') {
      const msg =
        String((submitJson as { message?: unknown }).message || '') ||
        `code=${code}`;
      log.error('createSunoMusic', 'submit business fail', { code, msg });
      throw new Error(`Suno 提交失败: ${msg}`);
    }
  }

  const taskId = pickTaskId(submitJson);
  if (!taskId) {
    const direct = pickAudioUrl(submitJson);
    if (direct) return { url: direct };
    const snip = submitText.slice(0, 240);
    log.error('createSunoMusic', 'no task_id', { snip });
    throw new Error(`Suno 提交成功但未返回 task_id。响应: ${snip}`);
  }

  log.info('createSunoMusic', 'polling', { taskId });
  const maxAttempts = 60;
  for (let i = 0; i < maxAttempts; i++) {
    if (params.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    await sleep(i === 0 ? 2000 : 3000, params.signal);
    const fetchUrl = `${root}/suno/fetch/${encodeURIComponent(taskId)}`;
    const fr = await fetch(fetchUrl, {
      method: 'GET',
      headers: { Authorization: `Bearer ${params.apiKey.trim()}` },
      signal: params.signal,
    });
    const ft = await fr.text();
    let fj: unknown = null;
    try {
      fj = ft ? JSON.parse(ft) : null;
    } catch {
      fj = { raw: ft };
    }
    if (!fr.ok) {
      log.warn('createSunoMusic', 'poll http error', { status: fr.status, attempt: i + 1 });
      continue;
    }
    const status = pickStatus(fj);
    const url = pickAudioUrl(fj);
    log.debug('createSunoMusic', 'poll', { attempt: i + 1, status, hasUrl: Boolean(url) });
    if (url && (status === 'SUCCESS' || status === 'COMPLETE' || status === 'COMPLETED' || !status)) {
      log.info('createSunoMusic', 'done', { taskId, url: url.slice(0, 80) });
      return { url, taskId };
    }
    if (/FAIL|ERROR|CANCEL/.test(status)) {
      throw new Error(`Suno 任务失败: ${status}`);
    }
  }
  throw new Error('Suno 任务超时，请稍后在历史中查看');
}
