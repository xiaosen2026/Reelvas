// 分镜格子：比例 / 网格 / 槽位 / 合成 PNG

export type StoryAspect = '16:9' | '9:16' | '3:4' | '4:3' | '1:1';
export type StoryGrid = '2x2' | '3x3' | '4x4' | '1x4' | '4x1';

export const ASPECT_OPTIONS: StoryAspect[] = ['16:9', '9:16', '3:4', '4:3', '1:1'];
export const GRID_OPTIONS: StoryGrid[] = ['2x2', '3x3', '4x4', '1x4', '4x1'];

export function parseAspect(s: unknown): StoryAspect {
  return ASPECT_OPTIONS.includes(s as StoryAspect) ? (s as StoryAspect) : '16:9';
}

export function parseGrid(s: unknown): StoryGrid {
  return GRID_OPTIONS.includes(s as StoryGrid) ? (s as StoryGrid) : '3x3';
}

export function gridDims(g: StoryGrid): { cols: number; rows: number } {
  if (g === '2x2') return { cols: 2, rows: 2 };
  if (g === '4x4') return { cols: 4, rows: 4 };
  if (g === '1x4') return { cols: 1, rows: 4 };
  if (g === '4x1') return { cols: 4, rows: 1 };
  return { cols: 3, rows: 3 };
}

export function slotCount(g: StoryGrid): number {
  const { cols, rows } = gridDims(g);
  return cols * rows;
}

export function aspectRatio(a: StoryAspect): number {
  const [w, h] = a.split(':').map(Number);
  return (w || 16) / (h || 9);
}

export function normalizeSlots(raw: unknown, n: number): string[] {
  const arr = Array.isArray(raw) ? raw.map((x) => (typeof x === 'string' ? x : '')) : [];
  const out = arr.slice(0, n);
  while (out.length < n) out.push('');
  return out;
}

export function swapSlots(slots: string[], a: number, b: number): string[] {
  if (a < 0 || b < 0 || a >= slots.length || b >= slots.length || a === b) return slots;
  const next = slots.slice();
  const t = next[a];
  next[a] = next[b];
  next[b] = t;
  return next;
}

/** 保留本地与仍在上游的图；新上游图填空槽 */
export function syncSlotsWithUpstream(
  slots: string[],
  upstream: string[],
  localSet: Set<string>,
  n: number,
): string[] {
  const up = upstream.map((u) => u.trim()).filter(Boolean);
  const upSet = new Set(up);
  const next = normalizeSlots(slots, n).map((u) => {
    if (!u) return '';
    if (localSet.has(u) || upSet.has(u)) return u;
    return '';
  });
  const present = new Set(next.filter(Boolean));
  for (const u of up) {
    if (present.has(u)) continue;
    const empty = next.findIndex((x) => !x);
    if (empty < 0) break;
    next[empty] = u;
    present.add(u);
  }
  return next;
}

export function parseLocalUrls(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === 'string' && !!x.trim());
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`load fail: ${src.slice(0, 48)}`));
    img.src = src;
  });
}

export async function mergeStoryboardPng(opts: {
  slots: string[];
  grid: StoryGrid;
  aspect: StoryAspect;
  cellMax?: number;
}): Promise<string> {
  const { cols, rows } = gridDims(opts.grid);
  const n = cols * rows;
  const slots = normalizeSlots(opts.slots, n);
  const ar = aspectRatio(opts.aspect);
  const cellMax = opts.cellMax ?? 512;
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
    const src = slots[i];
    if (!src) {
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(x, y, cellW, cellH);
      continue;
    }
    try {
      const img = await loadImage(src);
      const ir = img.naturalWidth / img.naturalHeight || 1;
      let dw = cellW;
      let dh = cellH;
      let dx = x;
      let dy = y;
      if (ir > ar) {
        dh = cellH;
        dw = cellH * ir;
        dx = x + (cellW - dw) / 2;
      } else {
        dw = cellW;
        dh = cellW / ir;
        dy = y + (cellH - dh) / 2;
      }
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, cellW, cellH);
      ctx.clip();
      ctx.drawImage(img, dx, dy, dw, dh);
      ctx.restore();
    } catch {
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(x, y, cellW, cellH);
    }
  }
  return canvas.toDataURL('image/png');
}

export function buildStoryboardFileName(): string {
  const t = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `storyboard-${t.getFullYear()}${p(t.getMonth() + 1)}${p(t.getDate())}-${p(t.getHours())}${p(t.getMinutes())}${p(t.getSeconds())}.png`;
}
