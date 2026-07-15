// 免费 TTS：优先本地代理 / Electron IPC → 真实 mp3
// 浏览器直连 Edge 会因 Origin 403，故默认不直连

import { createLogger } from '../logger';

const log = createLogger('browserTts');

export const BROWSER_TTS_MODEL = 'browser-tts';

export type BrowserVoiceOption = { value: string; label: string };

/** 免费可落盘音色（Edge 神经） */
export const EDGE_FREE_VOICES: BrowserVoiceOption[] = [
  { value: 'zh-CN-XiaoxiaoNeural', label: '晓晓 · 女（可落盘）' },
  { value: 'zh-CN-YunxiNeural', label: '云希 · 男（可落盘）' },
  { value: 'zh-CN-YunyangNeural', label: '云扬 · 男播报（可落盘）' },
  { value: 'zh-CN-XiaoyiNeural', label: '晓伊 · 女（可落盘）' },
  { value: 'zh-CN-YunjianNeural', label: '云健 · 男（可落盘）' },
  { value: 'zh-CN-XiaochenNeural', label: '晓辰 · 女（可落盘）' },
  { value: 'zh-CN-XiaohanNeural', label: '晓涵 · 女（可落盘）' },
  { value: 'zh-CN-XiaomengNeural', label: '晓梦 · 女（可落盘）' },
  { value: 'zh-CN-XiaomoNeural', label: '晓墨 · 女（可落盘）' },
  { value: 'zh-CN-XiaoqiuNeural', label: '晓秋 · 女（可落盘）' },
  { value: 'zh-CN-XiaoruiNeural', label: '晓睿 · 女（可落盘）' },
  { value: 'zh-CN-XiaoshuangNeural', label: '晓双 · 女童（可落盘）' },
  { value: 'zh-CN-XiaoxuanNeural', label: '晓萱 · 女（可落盘）' },
  { value: 'zh-CN-XiaoyanNeural', label: '晓颜 · 女（可落盘）' },
  { value: 'zh-CN-XiaoyouNeural', label: '晓悠 · 女童（可落盘）' },
  { value: 'zh-CN-XiaozhenNeural', label: '晓甄 · 女（可落盘）' },
  { value: 'zh-CN-YunfengNeural', label: '云枫 · 男（可落盘）' },
  { value: 'zh-CN-YunhaoNeural', label: '云皓 · 男（可落盘）' },
  { value: 'zh-CN-YunxiaNeural', label: '云夏 · 男童（可落盘）' },
  { value: 'zh-CN-YunyeNeural', label: '云野 · 男（可落盘）' },
  { value: 'zh-CN-YunzeNeural', label: '云泽 · 男（可落盘）' },
  { value: 'en-US-JennyNeural', label: 'Jenny · EN（可落盘）' },
  { value: 'en-US-GuyNeural', label: 'Guy · EN（可落盘）' },
];

type DesktopTtsApi = {
  isDesktop?: boolean;
  freeTts?: (payload: {
    text: string;
    voice?: string;
  }) => Promise<{ ok: boolean; base64?: string; error?: string; bytes?: number }>;
};

function desktopApi(): DesktopTtsApi | null {
  if (typeof window === 'undefined') return null;
  return (window as unknown as { reelvasDesktop?: DesktopTtsApi }).reelvasDesktop || null;
}

export function isBrowserTtsModel(model?: string): boolean {
  const m = String(model || '').toLowerCase();
  return m === BROWSER_TTS_MODEL || m === 'browser' || m === 'local-tts' || m === 'free-tts';
}

export function listBrowserVoices(): BrowserVoiceOption[] {
  return EDGE_FREE_VOICES;
}

export function defaultBrowserVoice(): string {
  return 'zh-CN-XiaoxiaoNeural';
}

function resolveEdgeVoice(voice?: string): string {
  const v = String(voice || '').trim();
  if (EDGE_FREE_VOICES.some((x) => x.value === v)) return v;
  if (/zh|chinese|中文|huihui|yaoyao|xiaoxiao/i.test(v)) return 'zh-CN-XiaoxiaoNeural';
  if (/en|english|jenny|guy/i.test(v)) return 'en-US-JennyNeural';
  return defaultBrowserVoice();
}

function base64ToBlob(base64: string, type: string): Blob {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

async function viaDesktop(params: {
  input: string;
  voice: string;
  signal?: AbortSignal;
}): Promise<Blob | null> {
  const api = desktopApi();
  if (!api?.freeTts) return null;
  if (params.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  log.info('viaDesktop', 'start', { voice: params.voice });
  const r = await api.freeTts({ text: params.input, voice: params.voice });
  if (!r?.ok || !r.base64) {
    throw new Error(r?.error || 'Electron 免费 TTS 失败');
  }
  return base64ToBlob(r.base64, 'audio/mpeg');
}

async function viaLocalProxy(params: {
  input: string;
  voice: string;
  signal?: AbortSignal;
}): Promise<Blob | null> {
  if (typeof window === 'undefined') return null;
  // 同源 /api/free-tts（scripts/serve-with-tts.js 或 Electron 自定义协议旁路）
  const urls = ['/api/free-tts'];
  // 部分静态托管下相对路径异常时再试绝对同源
  if (typeof window !== 'undefined' && window.location?.origin) {
    urls.push(`${window.location.origin}/api/free-tts`);
  }
  let lastMsg = '';
  for (const url of urls) {
    log.info('viaLocalProxy', 'start', { url, voice: params.voice });
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: params.input, voice: params.voice }),
        signal: params.signal,
      });
      if (res.status === 404) {
        lastMsg = '404 无 /api/free-tts';
        continue;
      }
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const j = (await res.json()) as { error?: string };
          if (j?.error) msg = j.error;
        } catch {
          /* ignore */
        }
        // 服务端 Edge 失败：直接抛出，便于上层展示真实原因
        throw new Error(msg);
      }
      const buf = await res.arrayBuffer();
      if (!buf.byteLength) throw new Error('代理返回空音频');
      return new Blob([buf], { type: 'audio/mpeg' });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') throw err;
      lastMsg = err instanceof Error ? err.message : String(err);
      // 非网络/404：透传（含 Edge 错误文案）
      if (!/404|Failed to fetch|NetworkError|fetch/i.test(lastMsg)) {
        throw err instanceof Error ? err : new Error(lastMsg);
      }
      log.warn('viaLocalProxy', 'fail', { msg: lastMsg, url });
    }
  }
  log.warn('viaLocalProxy', 'all fail', { msg: lastMsg });
  return null;
}

/**
 * 免费 TTS → mp3 Blob URL（可 audio 播放 / 下载落盘）
 * 路径：Electron IPC → 本地 /api/free-tts 代理
 */
export async function createBrowserSpeech(params: {
  input: string;
  voice?: string;
  signal?: AbortSignal;
}): Promise<{ url: string; spoken: boolean; persisted: boolean }> {
  const input = String(params.input || '').trim();
  if (!input) throw new Error('请输入要朗读的文本');
  if (params.signal?.aborted) throw new DOMException('Aborted', 'AbortError');

  const voice = resolveEdgeVoice(params.voice);
  log.info('createBrowserSpeech', 'start', { chars: input.length, voice });

  try {
    let blob: Blob | null = await viaDesktop({
      input,
      voice,
      signal: params.signal,
    });
    if (!blob) {
      blob = await viaLocalProxy({
        input,
        voice,
        signal: params.signal,
      });
    }
    if (!blob) {
      throw new Error(
        '未找到免费 TTS 落盘通道。请用 node scripts/serve-with-tts.js 启动（含 /api/free-tts），或使用 Electron 桌面壳。',
      );
    }
    const url = URL.createObjectURL(blob);
    log.info('createBrowserSpeech', 'ok', { size: blob.size, type: blob.type });
    return { url, spoken: false, persisted: true };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    const msg = err instanceof Error ? err.message : String(err);
    log.warn('createBrowserSpeech', 'failed, fallback speak', { msg });
    await speakSystemOnly({ input, signal: params.signal });
    throw new Error(
      '免费 TTS 未能生成音频文件（' +
        msg +
        '）。已尝试系统朗读。请用 `node scripts/serve-with-tts.js` 或 Electron 以落盘 mp3。',
    );
  }
}

async function speakSystemOnly(params: {
  input: string;
  signal?: AbortSignal;
}): Promise<void> {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const utter = new SpeechSynthesisUtterance(params.input);
  utter.lang = 'zh-CN';
  await new Promise<void>((resolve) => {
    const onAbort = () => {
      synth.cancel();
      resolve();
    };
    params.signal?.addEventListener('abort', onAbort, { once: true });
    utter.onend = () => {
      params.signal?.removeEventListener('abort', onAbort);
      resolve();
    };
    utter.onerror = () => {
      params.signal?.removeEventListener('abort', onAbort);
      resolve();
    };
    try {
      synth.speak(utter);
    } catch {
      params.signal?.removeEventListener('abort', onAbort);
      resolve();
    }
  });
}
