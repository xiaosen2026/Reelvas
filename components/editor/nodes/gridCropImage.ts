// 宫格裁切：一张图按 cols×rows 均匀切成多张 dataURL

import { srcToBlob } from './imageBlobUtils';
import { createLogger } from '../../../lib/logger';

const log = createLogger('gridCropImage');

export type GridCropCell = {
  url: string;
  col: number;
  row: number;
  index: number;
  naturalW: number;
  naturalH: number;
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

/**
 * 将 src 均匀切成 cols×rows 格，返回每格 PNG dataURL。
 * 像素边界用整除 + 末格吃余数，避免缝隙。
 */
export async function splitImageToGrid(
  src: string,
  cols: number,
  rows: number,
): Promise<GridCropCell[]> {
  const c = Math.max(1, Math.min(12, Math.floor(cols)));
  const r = Math.max(1, Math.min(12, Math.floor(rows)));
  if (c * r <= 1) throw new Error('宫格至少 2 格');

  const blob = await srcToBlob(src);
  const img = await loadFromBlob(blob);
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) throw new Error('无效图片尺寸');

  const baseW = Math.floor(iw / c);
  const baseH = Math.floor(ih / r);
  const cells: GridCropCell[] = [];

  for (let row = 0; row < r; row++) {
    for (let col = 0; col < c; col++) {
      const sx = col * baseW;
      const sy = row * baseH;
      const sw = col === c - 1 ? iw - sx : baseW;
      const sh = row === r - 1 ? ih - sy : baseH;
      const canvas = document.createElement('canvas');
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('no 2d context');
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      const url = canvas.toDataURL('image/png');
      cells.push({
        url,
        col,
        row,
        index: row * c + col,
        naturalW: sw,
        naturalH: sh,
      });
    }
  }

  log.info('splitImageToGrid', 'ok', { cols: c, rows: r, iw, ih, n: cells.length });
  return cells;
}

/** 多图按行列合并为一张 PNG（object-cover 填满每格） */
export async function mergeImagesGrid(opts: {
  urls: string[];
  cols: number;
  rows: number;
  cellMax?: number;
}): Promise<{ dataUrl: string; width: number; height: number }> {
  const cols = Math.max(1, opts.cols);
  const rows = Math.max(1, opts.rows);
  const n = cols * rows;
  const urls = opts.urls.slice(0, n);
  while (urls.length < n) urls.push('');

  const cellMax = opts.cellMax ?? 512;
  // 以首张有效图估比例，默认 1:1
  let ar = 1;
  for (const u of urls) {
    if (!u) continue;
    try {
      const b = await srcToBlob(u);
      const im = await loadFromBlob(b);
      const w = im.naturalWidth || im.width;
      const h = im.naturalHeight || im.height;
      if (w && h) {
        ar = w / h;
        break;
      }
    } catch {
      /* skip */
    }
  }

  let cellW = cellMax;
  let cellH = Math.round(cellW / ar);
  if (cellH > cellMax) {
    cellH = cellMax;
    cellW = Math.round(cellH * ar);
  }

  const canvas = document.createElement('canvas');
  canvas.width = cellW * cols;
  canvas.height = cellH * rows;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  ctx.fillStyle = '#111111';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < n; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = col * cellW;
    const y = row * cellH;
    const src = urls[i];
    if (!src) {
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(x, y, cellW, cellH);
      continue;
    }
    try {
      const b = await srcToBlob(src);
      const im = await loadFromBlob(b);
      const iw = im.naturalWidth || im.width;
      const ih = im.naturalHeight || im.height;
      const scale = Math.max(cellW / iw, cellH / ih);
      const dw = iw * scale;
      const dh = ih * scale;
      const dx = x + (cellW - dw) / 2;
      const dy = y + (cellH - dh) / 2;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, cellW, cellH);
      ctx.clip();
      ctx.drawImage(im, dx, dy, dw, dh);
      ctx.restore();
    } catch {
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(x, y, cellW, cellH);
    }
  }

  log.info('mergeImagesGrid', 'ok', { cols, rows, w: canvas.width, h: canvas.height });
  return {
    dataUrl: canvas.toDataURL('image/png'),
    width: canvas.width,
    height: canvas.height,
  };
}
