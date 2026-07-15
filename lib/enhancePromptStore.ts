// 增强提示词配置：按节点类型自定义 system prompt，localStorage 持久化

import { createLogger } from './logger';

const log = createLogger('enhancePromptStore');
const STORAGE_KEY = 'reelvas.enhancePrompt.v1';

export type EnhanceNodeKind = 'text' | 'image' | 'video' | 'audio' | 'tts';

export interface EnhancePromptConfig {
  enabled: boolean;
  systemPrompt: string;
}

export type EnhancePromptMap = Record<EnhanceNodeKind, EnhancePromptConfig>;

const DEFAULTS: EnhancePromptMap = {
  text: {
    enabled: true,
    systemPrompt:
      '你是专业的文本提示词增强助手。请将用户输入扩展为更清晰、具体、可执行的中文提示词，保留原意，补充结构与细节。只输出增强后的提示词正文，不要解释、不要加引号或标题。',
  },
  image: {
    enabled: true,
    systemPrompt:
      '你是专业的图像生成提示词增强助手。请将用户输入扩展为适合文生图的中文提示词：主体、构图、光影、材质、风格、氛围。保留用户核心意图，不要无关扩写。只输出增强后的提示词正文，不要解释。',
  },
  video: {
    enabled: true,
    systemPrompt:
      '你是专业的视频生成提示词增强助手。请将用户输入扩展为适合文生视频的中文提示词：镜头运动、主体动作、场景、光影、节奏与时长感。保留原意。只输出增强后的提示词正文，不要解释。',
  },
  audio: {
    enabled: true,
    systemPrompt:
      '你是专业的音乐/歌曲提示词增强助手。请将用户输入扩展为适合 Suno 等音乐生成的中文描述：风格、情绪、节奏、乐器与场景。保留原意。只输出增强后的提示词正文，不要解释。',
  },
  tts: {
    enabled: true,
    systemPrompt:
      '你是专业的配音/TTS 文本润色助手。请将用户输入整理为适合朗读的中文：语句通顺、停顿自然、情绪明确。保留原意。只输出润色后的正文，不要解释。',
  },
};

/** 节点管理侧栏名称 → kind */
export const NODE_NAME_TO_ENHANCE_KIND: Record<string, EnhanceNodeKind> = {
  文本节点: 'text',
  图片节点: 'image',
  视频节点: 'video',
  音频节点: 'audio',
  TTS节点: 'tts',
};

type Listener = (map: EnhancePromptMap) => void;
const listeners = new Set<Listener>();

function cloneDefaults(): EnhancePromptMap {
  return {
    text: { ...DEFAULTS.text },
    image: { ...DEFAULTS.image },
    video: { ...DEFAULTS.video },
    audio: { ...DEFAULTS.audio },
    tts: { ...DEFAULTS.tts },
  };
}

function normalize(raw: unknown): EnhancePromptMap {
  const base = cloneDefaults();
  if (!raw || typeof raw !== 'object') return base;
  const o = raw as Partial<Record<EnhanceNodeKind, Partial<EnhancePromptConfig>>>;
  (Object.keys(base) as EnhanceNodeKind[]).forEach((k) => {
    const item = o[k];
    if (!item || typeof item !== 'object') return;
    if (typeof item.enabled === 'boolean') base[k].enabled = item.enabled;
    if (typeof item.systemPrompt === 'string' && item.systemPrompt.trim()) {
      base[k].systemPrompt = item.systemPrompt;
    }
  });
  return base;
}

function read(): EnhancePromptMap {
  if (typeof window === 'undefined') return cloneDefaults();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return cloneDefaults();
    return normalize(JSON.parse(raw));
  } catch (err) {
    log.warn('read', 'parse failed', { err: err instanceof Error ? err.message : String(err) });
    return cloneDefaults();
  }
}

function write(map: EnhancePromptMap): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch (err) {
    log.warn('write', 'save failed', { err: err instanceof Error ? err.message : String(err) });
  }
  listeners.forEach((fn) => fn(map));
}

export function getEnhancePromptMap(): EnhancePromptMap {
  return read();
}

export function getEnhancePromptConfig(kind: EnhanceNodeKind): EnhancePromptConfig {
  return read()[kind];
}

export function setEnhancePromptConfig(
  kind: EnhanceNodeKind,
  patch: Partial<EnhancePromptConfig>,
): EnhancePromptMap {
  const cur = read();
  const next: EnhancePromptMap = {
    ...cur,
    [kind]: {
      enabled: patch.enabled ?? cur[kind].enabled,
      systemPrompt: (patch.systemPrompt ?? cur[kind].systemPrompt).trim() || DEFAULTS[kind].systemPrompt,
    },
  };
  write(next);
  log.info('setEnhancePromptConfig', 'saved', { kind, enabled: next[kind].enabled });
  return next;
}

export function resetEnhancePromptConfig(kind: EnhanceNodeKind): EnhancePromptMap {
  const cur = read();
  const next: EnhancePromptMap = { ...cur, [kind]: { ...DEFAULTS[kind] } };
  write(next);
  log.info('resetEnhancePromptConfig', 'reset', { kind });
  return next;
}

export function subscribeEnhancePrompt(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getDefaultEnhancePrompt(kind: EnhanceNodeKind): string {
  return DEFAULTS[kind].systemPrompt;
}
