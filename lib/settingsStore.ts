// 设置持久化 —— 文本/图像/视频/音频(音乐)/TTS 渠道落盘 localStorage
// 默认注入本地调试渠道（localhost:8317 / grok-4.5），避免误连云端计费 API

import type { ModelItem } from './settingsData';
import { createLogger } from './logger';
import { normalizeVideoProtocolLabel } from './llm/videoProtocolResolve';
import { normalizeImageProtocolLabel } from './llm/imageProtocolResolve';

const log = createLogger('settingsStore');

export type ChannelKind = 'text' | 'image' | 'video' | 'audio' | 'tts';

export interface ApiChannel {
  id: number;
  apiKey: string;
  protocol: string;
  apiAddr: string;
  models: ModelItem[];
}

const KEYS: Record<ChannelKind, string> = {
  text: 'reelvas_text_channels',
  image: 'reelvas_image_channels',
  video: 'reelvas_video_channels',
  audio: 'reelvas_audio_channels',
  tts: 'reelvas_tts_channels',
};

/** 同页内渠道变更订阅（localStorage 同页不触发 storage 事件） */
type ChannelChangeListener = (kind: ChannelKind) => void;
const channelListeners = new Set<ChannelChangeListener>();

function notifyChannelsChanged(kind: ChannelKind): void {
  for (const fn of channelListeners) {
    try {
      fn(kind);
    } catch (err) {
      log.warn('notifyChannelsChanged', 'listener error', { kind, err: String(err) });
    }
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('reelvas:channels-changed', { detail: { kind } }));
  }
}

/** 订阅文本/图像/视频/音频/TTS 渠道落盘变更（设置页改模型列表 → 节点下拉联动） */
export function subscribeChannels(listener: ChannelChangeListener): () => void {
  channelListeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (!e.key) return;
    const entry = (Object.entries(KEYS) as [ChannelKind, string][]).find(([, k]) => k === e.key);
    if (entry) listener(entry[0]);
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', onStorage);
  }
  return () => {
    channelListeners.delete(listener);
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', onStorage);
    }
  };
}

/** 本地调试默认渠道（OpenAI Chat 兼容）— 开源默认不带密钥，请在设置中自行填写 */
export const LOCAL_DEBUG_CHANNEL: ApiChannel = {
  id: 1,
  apiKey: '',
  protocol: 'OpenAI (Chat)',
  apiAddr: 'http://localhost:8317',
  models: [{ name: 'grok-4.5', icon: '🌀', desc: '本地调试 · OpenAI 兼容' }],
};

/** 默认图像渠道（OpenAI Images 兼容 / 网关）— apiKey 留空 */
export const LOCAL_IMAGE_DEBUG_CHANNEL: ApiChannel = {
  id: 1,
  apiKey: '',
  protocol: 'OpenAI (Images)',
  apiAddr: 'https://api.openai.com',
  models: [
    { name: 'gpt-image-1', icon: '🤖', desc: 'OpenAI 图像 · 需自备 Key' },
  ],
};

/** 默认视频渠道 — apiKey 留空 */
export const LOCAL_VIDEO_DEBUG_CHANNEL: ApiChannel = {
  id: 1,
  apiKey: '',
  protocol: 'OpenAI 兼容视频',
  apiAddr: '',
  models: [
    { name: 'seedance-placeholder', icon: '🎬', desc: '在设置中填写网关与模型 id' },
  ],
};

/** 默认音频/音乐渠道 — apiKey 留空 */
export const LOCAL_AUDIO_DEBUG_CHANNEL: ApiChannel = {
  id: 1,
  apiKey: '',
  protocol: 'Suno 兼容',
  apiAddr: '',
  models: [
    { name: 'suno_music', icon: '🎵', desc: '音乐生成 · 需自备网关' },
  ],
};

/** 默认 TTS 渠道 — 免费 browser-tts 无需 Key；其它模型需自备 */
export const LOCAL_TTS_DEBUG_CHANNEL: ApiChannel = {
  id: 1,
  apiKey: '',
  protocol: 'TTS',
  apiAddr: '',
  models: [
    { name: 'browser-tts', icon: '🆓', desc: '免费 · Edge 神经语音（可落盘 mp3）' },
    { name: 'tts-1', icon: '🔊', desc: 'OpenAI TTS · 需 OpenAI 渠道' },
  ],
};

function emptyChannel(protocol: string, apiAddr: string): ApiChannel {
  return { id: 1, apiKey: '', protocol, apiAddr, models: [] };
}

function seedChannelFor(kind: ChannelKind): ApiChannel {
  if (kind === 'image') return { ...LOCAL_IMAGE_DEBUG_CHANNEL, models: [...LOCAL_IMAGE_DEBUG_CHANNEL.models] };
  if (kind === 'video') return { ...LOCAL_VIDEO_DEBUG_CHANNEL, models: [...LOCAL_VIDEO_DEBUG_CHANNEL.models] };
  if (kind === 'audio') return { ...LOCAL_AUDIO_DEBUG_CHANNEL, models: [...LOCAL_AUDIO_DEBUG_CHANNEL.models] };
  if (kind === 'tts') return { ...LOCAL_TTS_DEBUG_CHANNEL, models: [...LOCAL_TTS_DEBUG_CHANNEL.models] };
  return { ...LOCAL_DEBUG_CHANNEL, models: [...LOCAL_DEBUG_CHANNEL.models] };
}

/** 未填 key 且无模型：旧版默认空渠道 / 占位，应被本地 seed 替换 */
function isUnconfiguredPlaceholder(c: ApiChannel): boolean {
  const noKey = !String(c.apiKey || '').trim();
  const noModels = !Array.isArray(c.models) || c.models.length === 0;
  return noKey && noModels;
}

/** 历史默认云端计费地址（空配置时禁止继续沿用） */
function isOpenAICloudAddr(addr?: string): boolean {
  if (!addr) return false;
  try {
    const h = new URL(addr).hostname.toLowerCase();
    return h === 'api.openai.com' || h.endsWith('.openai.com');
  } catch {
    return /api\.openai\.com/i.test(addr);
  }
}

/** 是否为历史图像网关 8800（视频已改连 8317，旧落盘需迁移） */
function isLegacyVideo8800Addr(addr?: string): boolean {
  if (!addr) return false;
  try {
    const u = new URL(addr);
    const host = u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '::1';
    return host && (u.port === '8800' || addr.includes(':8800'));
  } catch {
    return /localhost:8800|127\.0\.0\.1:8800/i.test(addr);
  }
}

/** 是否为本地调试端点 */
export function isLocalApiAddr(addr?: string | null): boolean {
  if (!addr) return false;
  try {
    const u = new URL(addr);
    return u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '::1';
  } catch {
    return /localhost|127\.0\.0\.1/i.test(addr);
  }
}

/** 是否应用本地 seed 覆盖磁盘上的无效/危险默认配置 */
function shouldReplaceWithLocalSeed(
  kind: ChannelKind,
  channels: ApiChannel[],
  seedLocalDebug?: boolean,
): boolean {
  if (!seedLocalDebug) return false;
  if (channels.length === 0) return true;
  if (channels.every(isUnconfiguredPlaceholder)) return true;
  // 视频：旧 8800 / 本地 8317 / sora 占位 → 统一迁到 nxfl + 视频 seed
  if (kind === 'video') {
    if (channels.every((c) => isLegacyVideo8800Addr(c.apiAddr))) return true;
    if (channels.every((c) => isLocalApiAddr(c.apiAddr))) return true;
    if (
      channels.every((c) => {
        const names = (c.models || []).map((m) => m.name);
        return names.length > 0 && names.every((n) => /^sora/i.test(n) || n === 'gpt-image-2');
      })
    ) {
      return true;
    }
  }
  // 音频：旧版混入 TTS 模型或 TTS 协议 → 迁到纯 Suno 音乐 seed
  if (kind === 'audio') {
    const mixedTts = channels.some((c) => {
      const proto = String(c.protocol || '');
      if (/TTS|语音/.test(proto) && !/Suno|音乐/.test(proto)) return true;
      return (c.models || []).some((m) => /tts|gpt-4o-mini-tts|speech/i.test(m.name));
    });
    if (mixedTts) return true;
  }
  // TTS：仅 OpenAI 名 / 无 qwen·cosy → 迁到 nxfl Qwen 列表 seed
  if (kind === 'tts') {
    const onlyOpenAiNames = channels.every((c) => {
      const names = (c.models || []).map((m) => m.name);
      if (!names.length) return true;
      const hasQwen = names.some((n) => /qwen|cosyvoice/i.test(n));
      const allOpenAi = names.every((n) => /^(tts-1|tts-1-hd|gpt-4o-mini-tts)$/i.test(n));
      return !hasQwen && allOpenAi;
    });
    if (onlyOpenAiNames) return true;
  }
  // 视频/图像/音频/TTS 曾默认 api.openai.com，空 key 时强制 seed
  if (kind === 'video' || kind === 'image' || kind === 'audio' || kind === 'tts') {
    return channels.every((c) => !String(c.apiKey || '').trim() && isOpenAICloudAddr(c.apiAddr));
  }
  return false;
}

/** 将 seed 中缺失的模型合并进已有渠道（视频/TTS） */
function mergeSeedModelsIntoChannels(
  kind: ChannelKind,
  channels: ApiChannel[],
): { channels: ApiChannel[]; changed: boolean } {
  if ((kind !== 'video' && kind !== 'tts') || channels.length === 0) {
    return { channels, changed: false };
  }
  const seedModels =
    kind === 'tts'
      ? LOCAL_TTS_DEBUG_CHANNEL.models || []
      : LOCAL_VIDEO_DEBUG_CHANNEL.models || [];
  if (!seedModels.length) return { channels, changed: false };

  let changed = false;
  const next = channels.map((c) => {
    const existing = Array.isArray(c.models) ? c.models : [];
    const names = new Set(existing.map((m) => m.name));
    const missing = seedModels.filter((m) => m.name && !names.has(m.name));
    if (!missing.length) return c;
    changed = true;
    // TTS：seed 新模型置前，便于默认选到 browser-tts / qwen
    const models = kind === 'tts' ? [...missing, ...existing] : [...missing, ...existing];
    return { ...c, models };
  });
  return { channels: next, changed };
}

/** 视频渠道：把误写的官网品牌协议名改回 NewAPI 接口形态文案 */
function normalizeVideoChannelProtocols(channels: ApiChannel[]): {
  channels: ApiChannel[];
  changed: boolean;
} {
  let changed = false;
  const next = channels.map((c) => {
    const protocol = normalizeVideoProtocolLabel(c.protocol);
    if (protocol === c.protocol) return c;
    changed = true;
    return { ...c, protocol };
  });
  return { channels: next, changed };
}

/** 图像渠道：OpenAI / 豆包 等官网名 → NewAPI（火山）等 */
function normalizeImageChannelProtocols(channels: ApiChannel[]): {
  channels: ApiChannel[];
  changed: boolean;
} {
  let changed = false;
  const next = channels.map((c) => {
    const protocol = normalizeImageProtocolLabel(c.protocol);
    if (protocol === c.protocol) return c;
    changed = true;
    return { ...c, protocol };
  });
  return { channels: next, changed };
}

export function loadChannels(
  kind: ChannelKind,
  defaults: { protocol: string; apiAddr: string; seedLocalDebug?: boolean },
): ApiChannel[] {
  if (typeof window === 'undefined') {
    return defaults.seedLocalDebug
      ? [seedChannelFor(kind)]
      : [emptyChannel(defaults.protocol, defaults.apiAddr)];
  }
  try {
    const raw = localStorage.getItem(KEYS[kind]);
    if (raw) {
      const parsed = JSON.parse(raw) as ApiChannel[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        if (shouldReplaceWithLocalSeed(kind, parsed, defaults.seedLocalDebug)) {
          const seeded = [seedChannelFor(kind)];
          log.info('loadChannels', 'replace placeholder with local seed', {
            kind,
            prevAddr: parsed[0]?.apiAddr,
            nextAddr: seeded[0]?.apiAddr,
          });
          try {
            localStorage.setItem(KEYS[kind], JSON.stringify(seeded));
            notifyChannelsChanged(kind);
          } catch (e) {
            log.warn('loadChannels', 'reseed write failed', { kind, err: String(e) });
          }
          return seeded;
        }
        let working = parsed;
        let dirty = false;
        const merged = mergeSeedModelsIntoChannels(kind, working);
        if (merged.changed) {
          working = merged.channels;
          dirty = true;
         
        if (kind === 'image') {
          const norm = normalizeImageChannelProtocols(working);
          if (norm.changed) {
            working = norm.channels;
            dirty = true;
            log.info('loadChannels', 'normalize image protocol labels', {
              kind,
              protocol: working[0]?.protocol,
            });
          }
        } log.info('loadChannels', 'merge seed models', {
            kind,
            count: working[0]?.models?.length,
          });
        }
        if (kind === 'video') {
          const norm = normalizeVideoChannelProtocols(working);
          if (norm.changed) {
            working = norm.channels;
            dirty = true;
            log.info('loadChannels', 'normalize video protocol labels', {
              kind,
              protocol: working[0]?.protocol,
            });
          }
        }
        if (dirty) {
          try {
            localStorage.setItem(KEYS[kind], JSON.stringify(working));
            notifyChannelsChanged(kind);
          } catch (e) {
            log.warn('loadChannels', 'normalize/merge write failed', { kind, err: String(e) });
          }
          return working;
        }
        log.debug('loadChannels', 'loaded', { kind, count: parsed.length });
        return parsed;
      }
    }
  } catch (err) {
    log.warn('loadChannels', 'parse failed, using defaults', { kind, err: String(err) });
  }
  if (defaults.seedLocalDebug) {
    const seeded = [seedChannelFor(kind)];
    log.info('loadChannels', 'seed local debug channel', { kind });
    try {
      localStorage.setItem(KEYS[kind], JSON.stringify(seeded));
      notifyChannelsChanged(kind);
    } catch (e) {
      log.warn('loadChannels', 'seed write failed', { kind, err: String(e) });
    }
    return seeded;
  }
  return [emptyChannel(defaults.protocol, defaults.apiAddr)];
}

export function saveChannels(kind: ChannelKind, channels: ApiChannel[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEYS[kind], JSON.stringify(channels));
    notifyChannelsChanged(kind);
    log.info('saveChannels', 'saved', { kind, count: channels.length });
  } catch (err) {
    log.error('saveChannels', 'write failed', { kind, err: String(err) });
  }
}

/** 取第一个可用文本渠道（有 apiKey + apiAddr） */
export function getPrimaryTextChannel(): ApiChannel | null {
  const list = loadChannels('text', {
    protocol: 'OpenAI (Chat)',
    apiAddr: '',
    seedLocalDebug: true,
  });
  const ready = list.find((c) => c.apiKey.trim() && c.apiAddr.trim());
  return ready ?? list[0] ?? null;
}

/** 取第一个可用图像渠道（有 apiKey + apiAddr） */
export function getPrimaryImageChannel(): ApiChannel | null {
  const list = loadChannels('image', {
    protocol: 'OpenAI (Images)',
    apiAddr: '',
    seedLocalDebug: true,
  });
  const ready = list.find((c) => c.apiKey.trim() && c.apiAddr.trim());
  return ready ?? list[0] ?? null;
}

/** 取第一个可用视频渠道（有 apiKey + apiAddr） */
export function getPrimaryVideoChannel(): ApiChannel | null {
  const list = loadChannels('video', {
    protocol: 'OpenAI 兼容视频',
    apiAddr: '',
    seedLocalDebug: true,
  });
  const ready = list.find((c) => c.apiKey.trim() && c.apiAddr.trim());
  return ready ?? list[0] ?? null;
}

/** 取第一个可用音频/音乐渠道（有 apiKey + apiAddr） */
export function getPrimaryAudioChannel(): ApiChannel | null {
  const list = loadChannels('audio', {
    protocol: 'Suno 兼容',
    apiAddr: '',
    seedLocalDebug: true,
  });
  const ready = list.find((c) => c.apiKey.trim() && c.apiAddr.trim());
  return ready ?? list[0] ?? null;
}

/** 取第一个可用 TTS 渠道（有 apiKey + apiAddr） */
export function getPrimaryTtsChannel(): ApiChannel | null {
  const list = loadChannels('tts', {
    protocol: 'TTS',
    apiAddr: '',
    seedLocalDebug: true,
  });
  const ready = list.find((c) => c.apiKey.trim() && c.apiAddr.trim());
  return ready ?? list[0] ?? null;
}

export interface TextModelOption {
  value: string;
  label: string;
  /** emoji / 简写图标，供 ModelIcon fallback */
  icon?: string;
  /** 简短说明（本地/能力等，非余额） */
  desc?: string;
}

/** 规范化模型副文案：过滤旧占位/余额文案 */
export function formatModelDesc(raw?: string | null, opts?: { local?: boolean }): string {
  let t = (raw || '').trim();
  t = t
    .replace(/余额\s*∞\s*[·•]?\s*本地不计费/g, '')
    .replace(/本地不计费/g, '')
    .replace(/未标注定价/g, '')
    .replace(/^[·•\s]+|[·•\s]+$/g, '')
    .trim();
  const stale =
    !t ||
    t === '来自服务端 /models' ||
    t === '◉' ||
    t === '本地调试 · OpenAI 兼容' ||
    /余额|不计费|定价|￥|¥/.test(t);
  if (opts?.local) {
    if (stale) return '本地 · OpenAI 兼容';
    if (!/本地/.test(t)) return `${t} · 本地`;
    return t;
  }
  if (stale) return '';
  return t;
}

/** 文本节点可选模型列表（渠道模型优先，否则默认 grok-4.5） */
export function listTextModelOptions(): TextModelOption[] {
  const ch = getPrimaryTextChannel();
  const local = isLocalApiAddr(ch?.apiAddr);
  const models = ch?.models ?? [];
  if (models.length === 0) {
    return [{ value: 'grok-4.5', label: 'grok-4.5', icon: '🌀', desc: formatModelDesc('', { local: true }) }];
  }
  return models.map((m) => ({
    value: m.name,
    label: m.name,
    icon: m.icon || '🌀',
    desc: formatModelDesc(m.desc, { local }),
  }));
}

/** 图像节点可选模型列表（渠道模型优先，否则默认 gpt-image-2） */
export function listImageModelOptions(): TextModelOption[] {
  const ch = getPrimaryImageChannel();
  const local = isLocalApiAddr(ch?.apiAddr);
  const models = ch?.models ?? [];
  if (models.length === 0) {
    return [{ value: 'gpt-image-2', label: 'gpt-image-2', icon: '🤖', desc: formatModelDesc('', { local: true }) }];
  }
  return models.map((m) => ({
    value: m.name,
    label: m.name,
    icon: m.icon || '🤖',
    desc: formatModelDesc(m.desc, { local }),
  }));
}

/** 视频节点可选模型列表（渠道模型优先，否则默认 grok-video-1.5-preview） */
export function listVideoModelOptions(): TextModelOption[] {
  const ch = getPrimaryVideoChannel();
  const local = isLocalApiAddr(ch?.apiAddr);
  const models = ch?.models ?? [];
  if (models.length === 0) {
    return [
      {
        value: 'grok-video-1.5-preview',
        label: 'grok-video-1.5-preview',
        icon: '🌀',
        desc: formatModelDesc('', { local: true }),
      },
    ];
  }
  return models.map((m) => ({
    value: m.name,
    label: m.name,
    icon: m.icon || '🎬',
    desc: formatModelDesc(m.desc, { local }),
  }));
}

/** 音频/音乐节点可选模型列表（设置 → 音频模型渠道） */
export function listAudioModelOptions(): TextModelOption[] {
  const ch = getPrimaryAudioChannel();
  const local = isLocalApiAddr(ch?.apiAddr);
  const models = ch?.models ?? [];
  if (models.length === 0) {
    return [
      {
        value: 'suno_music',
        label: 'suno_music',
        icon: '🎵',
        desc: formatModelDesc('Suno 音乐', { local }),
      },
    ];
  }
  return models.map((m) => ({
    value: m.name,
    label: m.name,
    icon: m.icon || '🎵',
    desc: formatModelDesc(m.desc, { local }),
  }));
}

/** TTS 节点可选模型列表（设置 → TTS 模型渠道）
 *  始终把 browser-tts 置顶，避免旧 localStorage 渠道列表看不到免费模型
 */
export function listTtsModelOptions(): TextModelOption[] {
  const ch = getPrimaryTtsChannel();
  const local = isLocalApiAddr(ch?.apiAddr);
  const models = ch?.models ?? [];
  const free: TextModelOption = {
    value: 'browser-tts',
    label: 'browser-tts',
    icon: '🆓',
    desc: '免费 · Edge 神经语音（可落盘 mp3，不扣费）',
  };
  if (models.length === 0) {
    return [
      free,
      {
        value: 'tts-1',
        label: 'tts-1',
        icon: '🔊',
        desc: formatModelDesc('OpenAI TTS · 需 OpenAI 渠道', { local }),
      },
    ];
  }
  const mapped = models
    .filter((m) => m.name && m.name !== 'browser-tts')
    .map((m) => ({
      value: m.name,
      label: m.name,
      icon: m.icon || '🔊',
      desc: formatModelDesc(m.desc, { local }),
    }));
  return [free, ...mapped];
}

/* ── ComfyUI 工作流服务地址 ── */

const COMFY_URL_KEY = 'reelvas_comfy_server_url';

export function getComfyServerUrl(): string {
  if (typeof window === 'undefined') return 'http://127.0.0.1:8188';
  return localStorage.getItem(COMFY_URL_KEY) || 'http://127.0.0.1:8188';
}

export function setComfyServerUrl(url: string): void {
  localStorage.setItem(COMFY_URL_KEY, url);
}
