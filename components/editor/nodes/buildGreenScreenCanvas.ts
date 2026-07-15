// 扩图预处理：源图按边距叠在绿幕底上，供 AI 填充绿幕区域

import { srcToBlob } from './imageBlobUtils';
import { createLogger } from '../../../lib/logger';

const log = createLogger('buildGreenScreenCanvas');

/** 标准绿幕色（#00FF00），便于模型识别待填区域 */
export const GREEN_SCREEN_HEX = '#00FF00';

/** 相对源图宽高的外扩边距（0=不扩，1=该方向再扩一整张源图宽/高） */
export type ExpandPads = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

export const DEFAULT_EXPAND_PADS: ExpandPads = {
  left: 0.25,
  right: 0.25,
  top: 0.25,
  bottom: 0.25,
};

export type GreenScreenCanvasResult = {
  dataUrl: string;
  width: number;
  height: number;
  placed: { x: number; y: number; w: number; h: number };
  greenHex: string;
  pads: ExpandPads;
};

function loadFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('image decode failed'));
    };
    img.src = url;
  });
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/** 规范化边距：单边 0–2，至少一侧有扩展 */
export function clampPads(p: Partial<ExpandPads> | null | undefined): ExpandPads {
  const left = clamp(Number(p?.left) || 0, 0, 2);
  const right = clamp(Number(p?.right) || 0, 0, 2);
  const top = clamp(Number(p?.top) || 0, 0, 2);
  const bottom = clamp(Number(p?.bottom) || 0, 0, 2);
  if (left + right + top + bottom < 0.02) {
    return { ...DEFAULT_EXPAND_PADS };
  }
  return { left, right, top, bottom };
}

/** 可读摘要，如 ←25% →25% ↑25% ↓25% */
export function formatPadsLabel(pads: ExpandPads): string {
  const p = clampPads(pads);
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  return `←${pct(p.left)} →${pct(p.right)} ↑${pct(p.top)} ↓${pct(p.bottom)}`;
}

/** Seedream 5.0 网关：输出总像素下限（约 1920²） */
export const SEEDREAM_MIN_PIXELS = 3_686_400;

/** 仅内存安全上限；默认不压小 2K 源图 */
const DEFAULT_MAX_EDGE = 8192;

function scaleLayout(
  outW: number,
  outH: number,
  placeX: number,
  placeY: number,
  placeW: number,
  placeH: number,
  k: number,
) {
  return {
    outW: Math.max(1, Math.round(outW * k)),
    outH: Math.max(1, Math.round(outH * k)),
    placeX: Math.round(placeX * k),
    placeY: Math.round(placeY * k),
    placeW: Math.max(1, Math.round(placeW * k)),
    placeH: Math.max(1, Math.round(placeH * k)),
  };
}

/**
 * 按四边相对边距合成绿幕画布。
 * left=0.25 → 左侧再扩 0.25×源图宽 的绿幕。
 * 默认按源图像素 1:1 外扩，禁止默认压到 2048 导致 2K 变小。
 */
export async function buildGreenScreenCanvas(
  src: string,
  opts?: {
    pads?: Partial<ExpandPads>;
    greenHex?: string;
    /** 长边硬上限（默认 8192，仅防爆内存） */
    maxEdge?: number;
    /** 总像素下限（Seedream 默认 3686400；0=不抬升） */
    minPixels?: number;
  },
): Promise<GreenScreenCanvasResult> {
  const pads = clampPads(opts?.pads);
  const greenHex = opts?.greenHex || GREEN_SCREEN_HEX;
  const maxEdge = opts?.maxEdge ?? DEFAULT_MAX_EDGE;
  const minPixels = Math.max(0, opts?.minPixels ?? 0);

  const blob = await srcToBlob(src);
  const img = await loadFromBlob(blob);
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) throw new Error('无效图片尺寸');

  // 1) 源图 1:1 贴入，外扩绿幕（先不缩小）
  let outW = Math.round(iw * (1 + pads.left + pads.right));
  let outH = Math.round(ih * (1 + pads.top + pads.bottom));
  let placeX = Math.round(iw * pads.left);
  let placeY = Math.round(ih * pads.top);
  let placeW = iw;
  let placeH = ih;

  // 2) Seedream 等：总像素不足则等比放大（可大于源图，不可默认缩小）
  let pixels = outW * outH;
  if (minPixels > 0 && pixels > 0 && pixels < minPixels) {
    // 略抬 k，避免 round 后仍 < 下限
    let k = Math.sqrt(minPixels / pixels) * 1.002;
    ({ outW, outH, placeX, placeY, placeW, placeH } = scaleLayout(
      outW, outH, placeX, placeY, placeW, placeH, k,
    ));
    pixels = outW * outH;
    if (pixels < minPixels) {
      k = Math.sqrt(minPixels / pixels) * 1.002;
      ({ outW, outH, placeX, placeY, placeW, placeH } = scaleLayout(
        outW, outH, placeX, placeY, placeW, placeH, k,
      ));
    }
  }

  // 3) 仅超硬上限时缩小；贴图区不得小于源图像素（2K 扩图不能变 <2K）
  const long = Math.max(outW, outH);
  if (long > maxEdge) {
    const kCap = maxEdge / long;
    // place 已 1:1 源图时 kFloor=1 → 拒绝缩小；抬升后允许收到源图 1:1
    const kFloor = Math.max(iw / placeW, ih / placeH, 0.01);
    const k = Math.max(kCap, kFloor);
    if (k < 0.999) {
      ({ outW, outH, placeX, placeY, placeW, placeH } = scaleLayout(
        outW, outH, placeX, placeY, placeW, placeH, k,
      ));
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');

  ctx.fillStyle = greenHex;
  ctx.fillRect(0, 0, outW, outH);
  ctx.drawImage(img, 0, 0, iw, ih, placeX, placeY, placeW, placeH);

  const dataUrl = canvas.toDataURL('image/png');
  log.info('buildGreenScreenCanvas', 'ok', {
    iw,
    ih,
    outW,
    outH,
    pixels: outW * outH,
    minPixels,
    maxEdge,
    pads,
    placed: { x: placeX, y: placeY, w: placeW, h: placeH },
  });

  return {
    dataUrl,
    width: outW,
    height: outH,
    placed: { x: placeX, y: placeY, w: placeW, h: placeH },
    greenHex,
    pads,
  };
}

/** 扩图图生图提示词：明确只填绿幕、保留原图区域 */
export function buildOutpaintPrompt(opts?: {
  greenHex?: string;
  userHint?: string;
}): string {
  const green = (opts?.greenHex || GREEN_SCREEN_HEX).toUpperCase();
  const hint = (opts?.userHint || '').trim();
  const lines = [
    '这是一张扩图画布：原图区域保留，四周纯色绿幕为待填充区域。',
    `请仅将 ${green} 绿幕区域自然外延填充为连贯场景，严格保留原图内容、主体、构图、风格与分辨率细节，不要覆盖或改写原图区域。`,
    '边缘与原图无缝衔接，透视、光影、材质连续，不要出现绿边、色块残留、文字水印或无关物体。',
  ];
  if (hint) lines.push(`用户补充：${hint}`);
  return lines.join('');
}
