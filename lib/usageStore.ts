// 本地调用统计：文本 token + 图片/视频/音频次数（不计费、无余额）

import { createLogger } from './logger';

const log = createLogger('usageStore');
const STORAGE_KEY = 'reelvas.usage.v1';

export interface UsageStats {
  textTokens: number;
  textCalls: number;
  imageCalls: number;
  videoCalls: number;
  audioCalls: number;
  updatedAt: number;
}

const EMPTY: UsageStats = {
  textTokens: 0,
  textCalls: 0,
  imageCalls: 0,
  videoCalls: 0,
  audioCalls: 0,
  updatedAt: 0,
};

type Listener = (s: UsageStats) => void;
const listeners = new Set<Listener>();

function read(): UsageStats {
  if (typeof window === 'undefined') return { ...EMPTY };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY };
    const p = JSON.parse(raw) as Partial<UsageStats>;
    return {
      textTokens: Math.max(0, Number(p.textTokens) || 0),
      textCalls: Math.max(0, Number(p.textCalls) || 0),
      imageCalls: Math.max(0, Number(p.imageCalls) || 0),
      videoCalls: Math.max(0, Number(p.videoCalls) || 0),
      audioCalls: Math.max(0, Number(p.audioCalls) || 0),
      updatedAt: Number(p.updatedAt) || 0,
    };
  } catch (err) {
    log.warn('read', 'parse failed', { err: err instanceof Error ? err.message : String(err) });
    return { ...EMPTY };
  }
}

function write(next: UsageStats): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (err) {
    log.warn('write', 'save failed', { err: err instanceof Error ? err.message : String(err) });
  }
  listeners.forEach((fn) => fn(next));
}

export function getUsage(): UsageStats {
  return read();
}

export function subscribeUsage(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** 文本成功调用：累计 token（优先 API usage.total_tokens） */
export function recordTextUsage(tokens: number): UsageStats {
  const n = Math.max(0, Math.floor(tokens) || 0);
  const cur = read();
  const next: UsageStats = {
    ...cur,
    textTokens: cur.textTokens + n,
    textCalls: cur.textCalls + 1,
    updatedAt: Date.now(),
  };
  write(next);
  log.info('recordTextUsage', 'ok', { tokens: n, total: next.textTokens, calls: next.textCalls });
  return next;
}

export function recordImageCall(count = 1): UsageStats {
  const n = Math.max(1, Math.floor(count) || 1);
  const cur = read();
  const next: UsageStats = { ...cur, imageCalls: cur.imageCalls + n, updatedAt: Date.now() };
  write(next);
  log.info('recordImageCall', 'ok', { n, total: next.imageCalls });
  return next;
}

export function recordVideoCall(count = 1): UsageStats {
  const n = Math.max(1, Math.floor(count) || 1);
  const cur = read();
  const next: UsageStats = { ...cur, videoCalls: cur.videoCalls + n, updatedAt: Date.now() };
  write(next);
  log.info('recordVideoCall', 'ok', { n, total: next.videoCalls });
  return next;
}

export function recordAudioCall(count = 1): UsageStats {
  const n = Math.max(1, Math.floor(count) || 1);
  const cur = read();
  const next: UsageStats = { ...cur, audioCalls: cur.audioCalls + n, updatedAt: Date.now() };
  write(next);
  log.info('recordAudioCall', 'ok', { n, total: next.audioCalls });
  return next;
}

export function resetUsage(): UsageStats {
  const next = { ...EMPTY, updatedAt: Date.now() };
  write(next);
  log.info('resetUsage', 'cleared');
  return next;
}

/** 顶栏紧凑文案 */
export function formatUsageSummary(s: UsageStats): string {
  const tok =
    s.textTokens >= 10000
      ? `${(s.textTokens / 1000).toFixed(1)}k`
      : s.textTokens >= 1000
        ? `${(s.textTokens / 1000).toFixed(2)}k`.replace(/\.?0+k$/, 'k')
        : String(s.textTokens);
  return `文本 ${tok} tok · 图 ${s.imageCalls} · 视频 ${s.videoCalls} · 音 ${s.audioCalls}`;
}
