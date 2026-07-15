// 图像渠道 protocol 文案 → 内部协议枚举
// 平台是 NewAPI；列表项是网关上的接口形态，不是 OpenAI/阿里等官网品牌。

export type ImageProtocolKind =
  | 'newapi-openai'
  | 'newapi-volcengine'
  | 'newapi-alibaba'
  | 'newapi-jimeng'
  | 'newapi-midjourney';

/** 设置页展示用协议列表（同一 NewAPI 平台的接口形态） */
export const IMAGE_PROTOCOL_OPTIONS = [
  'NewAPI（OpenAI 兼容）',
  'NewAPI（火山）',
  'NewAPI（阿里）',
  'NewAPI（即梦）',
  'NewAPI（Midjourney）',
] as const;

const KIND_TO_LABEL: Record<ImageProtocolKind, (typeof IMAGE_PROTOCOL_OPTIONS)[number]> = {
  'newapi-openai': 'NewAPI（OpenAI 兼容）',
  'newapi-volcengine': 'NewAPI（火山）',
  'newapi-alibaba': 'NewAPI（阿里）',
  'newapi-jimeng': 'NewAPI（即梦）',
  'newapi-midjourney': 'NewAPI（Midjourney）',
};

/**
 * 将历史/错误落盘的官网品牌文案规范为 NewAPI 协议名。
 * 例：OpenAI → NewAPI（OpenAI 兼容）；豆包 (Doubao) → NewAPI（火山）
 */
export function normalizeImageProtocolLabel(protocol?: string): string {
  const raw = String(protocol || '').trim();
  if (!raw) return KIND_TO_LABEL['newapi-openai'];
  if ((IMAGE_PROTOCOL_OPTIONS as readonly string[]).includes(raw)) return raw;
  return KIND_TO_LABEL[resolveImageProtocol(raw)];
}

/**
 * 将设置里的 protocol 字符串解析为客户端协议。
 * 默认 / 未识别 → OpenAI 兼容（generations + multipart edits）。
 * 火山 / Seedream / 豆包图：JSON /images/generations + image 数组图生图。
 */
export function resolveImageProtocol(protocol?: string): ImageProtocolKind {
  const p = String(protocol || '').trim().toLowerCase();
  if (!p) return 'newapi-openai';

  // 已是 NewAPI 标准文案
  if (p.includes('火山') || /volc|seedream|doubao|豆包/.test(p)) {
    return 'newapi-volcengine';
  }
  if (p.includes('即梦') || /jimeng/.test(p)) return 'newapi-jimeng';
  if (p.includes('阿里') || /alibaba|wanx|通义|qwen-image/.test(p)) {
    return 'newapi-alibaba';
  }
  if (/midjourney|\bmj\b/.test(p)) return 'newapi-midjourney';
  if (p.includes('openai') || p.includes('兼容') || p.includes('通用')) {
    return 'newapi-openai';
  }

  return 'newapi-openai';
}

/**
 * 是否走 JSON 图生图（/images/generations + image URL/数组）。
 * 协议优先；协议未标明时回退模型名启发式。
 */
export function prefersJsonImage2ImageByProtocol(
  protocol?: string,
  model?: string,
): boolean {
  const kind = resolveImageProtocol(protocol);
  if (
    kind === 'newapi-volcengine' ||
    kind === 'newapi-alibaba' ||
    kind === 'newapi-jimeng'
  ) {
    return true;
  }
  if (kind === 'newapi-midjourney') return false;

  // OpenAI 兼容：再按模型名（Seedream 等常挂在通用渠道上）
  const m = (model || '').toLowerCase();
  return (
    m.includes('seedream') ||
    m.includes('doubao') ||
    m.includes('jimeng') ||
    m.includes('volc') ||
    m.includes('wanx') ||
    m.includes('qwen-image')
  );
}
