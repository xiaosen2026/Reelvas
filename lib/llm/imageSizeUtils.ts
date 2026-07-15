// 图像 size / quality / n 解析（从 openaiImages 拆出）

export type ImageAspect =
  | 'auto' | '1:1' | '2:1' | '2:3' | '3:2' | '3:4' | '4:3' | '4:5' | '5:4' | '9:16' | '16:9' | '21:9';
export type ImageQuality = 'low' | 'medium' | 'high';
export type ImageRes = '1K' | '2K' | '4K';

export interface ImageSizeSpec {
  aspect?: ImageAspect | string;
  quality?: ImageQuality | string;
  res?: ImageRes | string;
}

/** 长边：1K=1024 · 2K=2560 · 4K=3200（seedream 像素下限） */
function longEdgeForRes(res?: string): number {
  const t = (res || '1K').toUpperCase();
  if (t.includes('4K') || t === '4') return 3200;
  if (t.includes('2K') || t === '2') return 2560;
  return 1024;
}

function aspectRatio(aspect?: string): number | null {
  const a = (aspect || 'auto').trim().toLowerCase();
  if (!a || a === 'auto') return null;
  const m = a.match(/^(\d+(?:\.\d+)?)\s*[:/]\s*(\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const w = parseFloat(m[1]);
  const h = parseFloat(m[2]);
  if (!w || !h) return null;
  return w / h;
}

function roundToMultiple(n: number, mult = 64): number {
  return Math.max(mult, Math.round(n / mult) * mult);
}

/** 组合 size：自适应+1K 省略；其余按长边×比例 */
export function resolveImageSizeFromSpec(spec: ImageSizeSpec = {}): string | undefined {
  const res = (spec.res || '1K').toString();
  const aspect = (spec.aspect || 'auto').toString();
  const ratio = aspectRatio(aspect);
  const longEdge = longEdgeForRes(res);
  if (ratio == null && longEdge === 1024) return undefined;
  if (ratio == null) return `${longEdge}x${longEdge}`;
  if (ratio >= 1) {
    return `${longEdge}x${roundToMultiple(longEdge / ratio)}`;
  }
  return `${roundToMultiple(longEdge * ratio)}x${longEdge}`;
}

export function resolveImageSize(resLabel: string): string | undefined {
  return resolveImageSizeFromSpec({ aspect: 'auto', res: resLabel });
}

export function resolveImageQuality(quality?: string): string | undefined {
  const q = (quality || '').toLowerCase();
  if (q === 'high' || q === 'hd' || q === '高') return 'high';
  if (q === 'medium' || q === 'standard' || q === '中') return 'medium';
  if (q === 'low' || q === '低') return 'low';
  return undefined;
}

export function resolveImageCount(qtyLabel: string): number {
  const m = String(qtyLabel || '1').match(/(\d+)/);
  const n = m ? parseInt(m[1], 10) : 1;
  return Math.min(4, Math.max(1, Number.isFinite(n) ? n : 1));
}
