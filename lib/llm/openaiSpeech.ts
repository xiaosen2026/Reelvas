// OpenAI 兼容 TTS（NewAPI /v1/audio/speech）
// 音色随模型家族切换：OpenAI alloy… / Qwen Cherry… / CosyVoice long* / 浏览器免费

import { createLogger } from '../logger';
import { normalizeOpenAIBase } from './openaiChat';
import {
  BROWSER_TTS_MODEL,
  defaultBrowserVoice,
  isBrowserTtsModel,
  listBrowserVoices,
} from './browserTts';

const log = createLogger('openaiSpeech');

export type SpeechVoiceOption = { value: string; label: string };

/** OpenAI /v1/audio/speech 标准音色 */
export const OPENAI_SPEECH_VOICES: SpeechVoiceOption[] = [
  { value: 'alloy', label: 'alloy' },
  { value: 'echo', label: 'echo' },
  { value: 'fable', label: 'fable' },
  { value: 'onyx', label: 'onyx' },
  { value: 'nova', label: 'nova' },
  { value: 'shimmer', label: 'shimmer' },
];

/** Qwen-TTS 常用系统音色 */
export const QWEN_SPEECH_VOICES: SpeechVoiceOption[] = [
  { value: 'Cherry', label: 'Cherry · 芊悦' },
  { value: 'Serena', label: 'Serena · 苏瑶' },
  { value: 'Ethan', label: 'Ethan · 晨煦' },
  { value: 'Chelsie', label: 'Chelsie · 千雪' },
  { value: 'Momo', label: 'Momo · 茉兔' },
  { value: 'Vivian', label: 'Vivian · 十三' },
  { value: 'Moon', label: 'Moon · 月白' },
  { value: 'Maia', label: 'Maia · 四月' },
  { value: 'Kai', label: 'Kai · 凯' },
  { value: 'Nofish', label: 'Nofish · 不吃鱼' },
  { value: 'Bella', label: 'Bella · 萌宝' },
  { value: 'Jennifer', label: 'Jennifer · 詹妮弗' },
  { value: 'Ryan', label: 'Ryan · 甜茶' },
  { value: 'Katerina', label: 'Katerina · 卡捷琳娜' },
];

/** CosyVoice 常用音色示例 */
export const COSY_SPEECH_VOICES: SpeechVoiceOption[] = [
  { value: 'longanyang', label: 'longanyang' },
  { value: 'longanhuan_v3', label: 'longanhuan_v3' },
  { value: 'longxiaochun_v3', label: 'longxiaochun_v3' },
];

/** @deprecated 使用 listSpeechVoices(model) */
export const SPEECH_VOICES = OPENAI_SPEECH_VOICES;

export { BROWSER_TTS_MODEL, isBrowserTtsModel };

export function isQwenTtsModel(model?: string): boolean {
  return /qwen.*tts|qwen3-tts|qwen-tts/i.test(String(model || ''));
}

export function isCosyVoiceModel(model?: string): boolean {
  return /cosyvoice/i.test(String(model || ''));
}

/** 按模型返回音色列表 */
export function listSpeechVoices(model?: string): SpeechVoiceOption[] {
  if (isBrowserTtsModel(model)) return listBrowserVoices();
  if (isQwenTtsModel(model)) return QWEN_SPEECH_VOICES;
  if (isCosyVoiceModel(model)) return COSY_SPEECH_VOICES;
  return OPENAI_SPEECH_VOICES;
}

export function defaultSpeechVoice(model?: string): string {
  if (isBrowserTtsModel(model)) return defaultBrowserVoice();
  if (isQwenTtsModel(model)) return 'Cherry';
  if (isCosyVoiceModel(model)) return 'longanyang';
  return 'alloy';
}

export function isTtsModel(model?: string): boolean {
  const m = String(model || '').toLowerCase();
  if (!m) return false;
  if (/suno|music|chirp|voice-enrollment/.test(m)) return false;
  if (isBrowserTtsModel(m)) return true;
  return /tts|speech|gpt-4o-mini-tts|openai-audio|cosyvoice|voice/.test(m);
}

function maskKey(key: string): string {
  if (key.length <= 4) return '***';
  return `${key.slice(0, 2)}***${key.slice(-2)}`;
}

export async function createSpeech(params: {
  apiKey: string;
  apiBase: string;
  model: string;
  input: string;
  voice?: string;
  responseFormat?: 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm';
  signal?: AbortSignal;
}): Promise<{ url: string; localSpoken?: boolean; persisted?: boolean }> {
  const input = String(params.input || '').trim();
  if (!input) throw new Error('请输入要朗读的文本');

  // 免费：Edge 神经语音 → mp3 blob（可落盘）；失败再系统朗读
  if (isBrowserTtsModel(params.model)) {
    const { createBrowserSpeech } = await import('./browserTts');
    const r = await createBrowserSpeech({
      input,
      voice: params.voice,
      signal: params.signal,
    });
    return { url: r.url, localSpoken: r.spoken, persisted: r.persisted };
  }

  const base = normalizeOpenAIBase(params.apiBase);
  if (!base) throw new Error('TTS API 地址为空');
  if (!params.apiKey.trim()) throw new Error('TTS API Key 为空');

  const url = `${base}/audio/speech`;
  const voice = params.voice || defaultSpeechVoice(params.model);
  const responseFormat = params.responseFormat || 'mp3';
  log.info('createSpeech', 'request', {
    url,
    model: params.model,
    voice,
    response_format: responseFormat,
    key: maskKey(params.apiKey),
    chars: input.length,
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.apiKey.trim()}`,
    },
    body: JSON.stringify({
      model: params.model,
      input,
      voice,
      response_format: responseFormat,
    }),
    signal: params.signal,
  });

  const contentType = res.headers.get('content-type') || '';
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let msg = text.slice(0, 240) || `HTTP ${res.status}`;
    let code = '';
    try {
      const j = JSON.parse(text) as {
        error?: { message?: string; code?: string; type?: string };
        message?: string;
      };
      msg = j.error?.message || j.message || msg;
      code = String(j.error?.code || '');
    } catch {
      /* raw */
    }
    log.error('createSpeech', 'failed', { status: res.status, msg, code });
    if (/not implemented|convert_request_failed/i.test(`${msg} ${code}`)) {
      const qwenHint =
        isQwenTtsModel(params.model) || isCosyVoiceModel(params.model)
          ? '模型名正确，但网关未把 Qwen/Cosy 转到专业 TTS 渠道。可改用免费 browser-tts 测节点。'
          : '';
      throw new Error(
        `TTS 网关未实现语音合成（${params.model}）。${qwenHint}` +
          `原始: ${msg}`,
      );
    }
    if (/model_not_found|无可用渠道|无渠道/i.test(msg)) {
      throw new Error(
        `TTS 模型不可用（${params.model}）：${msg}。可改用 browser-tts（免费本地）。`,
      );
    }
    throw new Error(`TTS 失败: ${msg}`);
  }

  if (contentType.includes('application/json')) {
    const j = (await res.json()) as Record<string, unknown>;
    const data = (j.data ?? j) as Record<string, unknown>;
    const u = String(data.url || data.audio_url || j.url || '');
    if (u.startsWith('http')) return { url: u };
    throw new Error('TTS 返回 JSON 但无音频 URL');
  }

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  log.info('createSpeech', 'ok blob', { type: blob.type, size: blob.size });
  return { url: objectUrl };
}
