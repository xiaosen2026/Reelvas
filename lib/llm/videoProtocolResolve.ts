// 视频渠道 protocol 文案 → 内部协议枚举
//
// 协议分为两类：
//   1. NewAPI（newapi-*）：走网关适配器，同一网关映射不同平台
//   2. 官方直连（*-direct）：直接调用官方 API，不经过网关
//
// 规则：默认通用 generations；Sora / 可灵 / 即梦 / 火山 走特殊路径。

export type VideoProtocolKind =
  | 'newapi-generations'
  | 'newapi-volcengine'
  | 'newapi-sora'
  | 'newapi-kling'
  | 'newapi-jimeng'
  | 'volcengine-direct'
  | 'aliyun-direct';

/** 设置页展示用协议列表 */
export const VIDEO_PROTOCOL_OPTIONS = [
  'NewAPI（通用视频）',
  'NewAPI（火山引擎）',
  'NewAPI（Sora）',
  'NewAPI（可灵）',
  'NewAPI（即梦）',
  '火山引擎（官方直连）',
  '阿里云（通义万相）',
] as const;

const KIND_TO_LABEL: Record<VideoProtocolKind, (typeof VIDEO_PROTOCOL_OPTIONS)[number]> = {
  'newapi-generations': 'NewAPI（通用视频）',
  'newapi-volcengine': 'NewAPI（火山引擎）',
  'newapi-sora': 'NewAPI（Sora）',
  'newapi-kling': 'NewAPI（可灵）',
  'newapi-jimeng': 'NewAPI（即梦）',
  'volcengine-direct': '火山引擎（官方直连）',
  'aliyun-direct': '阿里云（通义万相）',
};

/**
 * 将历史/错误落盘的官网品牌文案规范为 NewAPI 协议名。
 * 例：OpenAI (Sora) → NewAPI（Sora）；快手 (Kling) → NewAPI（可灵）
 */
export const DIRECT_PROTOCOLS: ReadonlySet<VideoProtocolKind> = new Set([
  'volcengine-direct',
  'aliyun-direct',
]);

export function isDirectProtocol(kind: VideoProtocolKind): boolean {
  return DIRECT_PROTOCOLS.has(kind);
}

/** 协议切换时自动填入的默认 API 地址（开源默认不绑第三方网关） */
export const VIDEO_PROTOCOL_DEFAULT_API: Record<string, string> = {
  'NewAPI（通用视频）': '',
  'NewAPI（火山引擎）': '',
  'NewAPI（Sora）': '',
  'NewAPI（可灵）': '',
  'NewAPI（即梦）': '',
  // Seedance 2.0 走方舟 Ark；1.x 用 operator.las.cn-beijing.volces.com
  '火山引擎（官方直连）': 'https://ark.cn-beijing.volces.com/api/v3',
  '阿里云（通义万相）': 'https://dashscope.aliyuncs.com',
};

/** 按协议文案取默认 API；未知协议返回空串 */
export function defaultApiForVideoProtocol(protocol: string, fallback = ''): string {
  const key = String(protocol || '').trim();
  if (VIDEO_PROTOCOL_DEFAULT_API[key]) return VIDEO_PROTOCOL_DEFAULT_API[key];
  const kind = resolveVideoProtocol(key);
  if (kind === 'volcengine-direct') return VIDEO_PROTOCOL_DEFAULT_API['火山引擎（官方直连）'];
  if (kind === 'aliyun-direct') return VIDEO_PROTOCOL_DEFAULT_API['阿里云（通义万相）'];
  return fallback;
}

export function normalizeVideoProtocolLabel(protocol?: string): string {
  const raw = String(protocol || '').trim();
  if (!raw) return KIND_TO_LABEL['newapi-generations'];
  if ((VIDEO_PROTOCOL_OPTIONS as readonly string[]).includes(raw)) return raw;
  return KIND_TO_LABEL[resolveVideoProtocol(raw)];
}

/**
 * 将设置里的 protocol 字符串解析为客户端协议。
 * 默认 / 未识别 / 旧 NewAPI Video → 通用视频（generations）。
 * 火山/豆包 Seedance：seconds 字符串 + metadata.resolution/ratio（+ content 图生）。
 */
export function resolveVideoProtocol(protocol?: string): VideoProtocolKind {
  const p = String(protocol || '').trim().toLowerCase();
  if (!p) return 'newapi-generations';

  // !!! ⚠️ 官方直连必须先于 NewAPI 同名关键词匹配 !!!
  // 「火山引擎（官方直连）」含「火山」二字，若先匹配「火山」会误判为 newapi-volcengine
  if (p.includes('官方直连') || p.includes('volcengine-direct')) {
    if (p.includes('阿里') || p.includes('通义') || p.includes('aliyun') || p.includes('dashscope')) {
      return 'aliyun-direct';
    }
    return 'volcengine-direct';
  }
  if (p.includes('阿里云') || p.includes('通义万相') || p.includes('aliyun-direct') || p.includes('dashscope')) {
    return 'aliyun-direct';
  }

  // NewAPI 标准文案
  if (p.includes('通用')) return 'newapi-generations';
  // NewAPI（火山引擎）—— 注意已排除「官方直连」
  if (p.includes('火山') || p.includes('newapi-volcengine')) return 'newapi-volcengine';
  if (p.includes('即梦') || /jimeng/.test(p)) return 'newapi-jimeng';
  if (p.includes('可灵') || /kling|快手/.test(p)) return 'newapi-kling';
  if (/sora/.test(p) || p.includes('openai (sora)')) return 'newapi-sora';

  // 历史误用的官网品牌 → 仍映射到 NewAPI 接口形态
  if (/alibaba|阿里|vidu|生数|minimax|hailuo|海螺/.test(p)) {
    return 'newapi-generations';
  }
  // 火山引擎 / Seedance（勿把纯「豆包」文本模型误判；仅视频相关）
  if (/volc|volcano|seedance|豆包\s*\(|doubao\s*\(/.test(p)) {
    return 'newapi-volcengine';
  }

  // 其余一律通用
  return 'newapi-generations';
}
