// 画板元素模型 + 渲染 / 导出（逻辑尺寸固定，便于缩略图与输出一致）

export type CanvasTool = 'select' | 'rect' | 'circle' | 'pen' | 'text';

export type Pt = { x: number; y: number };

export type CanvasEl =
  | { id: string; kind: 'pen'; color: string; width: number; points: Pt[] }
  | { id: string; kind: 'rect'; color: string; width: number; x: number; y: number; w: number; h: number }
  | { id: string; kind: 'circle'; color: string; width: number; cx: number; cy: number; r: number }
  | { id: string; kind: 'text'; color: string; x: number; y: number; text: string; size: number };

/** 导出与绘制共用逻辑分辨率 */
export const CANVAS_W = 1024;
export const CANVAS_H = 768;
export const DEFAULT_STROKE = 3;

export function newElId(): string {
  return `el-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function parseCanvasEls(raw: unknown): CanvasEl[] {
  if (!Array.isArray(raw)) return [];
  const out: CanvasEl[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const id = typeof o.id === 'string' ? o.id : newElId();
    const color = typeof o.color === 'string' ? o.color : '#ef4444';
    const width = typeof o.width === 'number' && o.width > 0 ? o.width : DEFAULT_STROKE;
    if (o.kind === 'pen' && Array.isArray(o.points)) {
      const points = o.points
        .filter((p): p is Pt => !!p && typeof p === 'object' && typeof (p as Pt).x === 'number')
        .map((p) => ({ x: Number((p as Pt).x), y: Number((p as Pt).y) }));
      if (points.length) out.push({ id, kind: 'pen', color, width, points });
    } else if (o.kind === 'rect') {
      out.push({
        id,
        kind: 'rect',
        color,
        width,
        x: Number(o.x) || 0,
        y: Number(o.y) || 0,
        w: Number(o.w) || 0,
        h: Number(o.h) || 0,
      });
    } else if (o.kind === 'circle') {
      out.push({
        id,
        kind: 'circle',
        color,
        width,
        cx: Number(o.cx) || 0,
        cy: Number(o.cy) || 0,
        r: Math.max(0, Number(o.r) || 0),
      });
    } else if (o.kind === 'text' && typeof o.text === 'string' && o.text) {
      out.push({
        id,
        kind: 'text',
        color,
        x: Number(o.x) || 0,
        y: Number(o.y) || 0,
        text: o.text,
        size: typeof o.size === 'number' && o.size > 0 ? o.size : 24,
      });
    }
  }
  return out;
}

function drawEl(ctx: CanvasRenderingContext2D, el: CanvasEl) {
  ctx.save();
  ctx.strokeStyle = el.color;
  ctx.fillStyle = el.color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (el.kind === 'pen') {
    if (el.points.length < 2) {
      const p = el.points[0];
      if (p) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, el.width / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.lineWidth = el.width;
      ctx.beginPath();
      ctx.moveTo(el.points[0].x, el.points[0].y);
      for (let i = 1; i < el.points.length; i++) {
        ctx.lineTo(el.points[i].x, el.points[i].y);
      }
      ctx.stroke();
    }
  } else if (el.kind === 'rect') {
    ctx.lineWidth = el.width;
    ctx.strokeRect(el.x, el.y, el.w, el.h);
  } else if (el.kind === 'circle') {
    ctx.lineWidth = el.width;
    ctx.beginPath();
    ctx.arc(el.cx, el.cy, el.r, 0, Math.PI * 2);
    ctx.stroke();
  } else if (el.kind === 'text') {
    ctx.font = `${el.size}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textBaseline = 'top';
    ctx.fillText(el.text, el.x, el.y);
  }
  ctx.restore();
}

/** 白底绘制全部元素（可选预览草稿） */
export function paintCanvas(
  ctx: CanvasRenderingContext2D,
  els: CanvasEl[],
  draft?: CanvasEl | null,
  selectedId?: string | null,
) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  for (const el of els) {
    drawEl(ctx, el);
    if (selectedId && el.id === selectedId) {
      ctx.save();
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 4]);
      const b = boundsOf(el);
      if (b) ctx.strokeRect(b.x - 4, b.y - 4, b.w + 8, b.h + 8);
      ctx.restore();
    }
  }
  if (draft) drawEl(ctx, draft);
}

export function boundsOf(el: CanvasEl): { x: number; y: number; w: number; h: number } | null {
  if (el.kind === 'pen') {
    if (!el.points.length) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of el.points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    return { x: minX, y: minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) };
  }
  if (el.kind === 'rect') {
    return {
      x: Math.min(el.x, el.x + el.w),
      y: Math.min(el.y, el.y + el.h),
      w: Math.abs(el.w),
      h: Math.abs(el.h),
    };
  }
  if (el.kind === 'circle') {
    return { x: el.cx - el.r, y: el.cy - el.r, w: el.r * 2, h: el.r * 2 };
  }
  // text 粗略包围
  const w = Math.max(24, el.text.length * el.size * 0.6);
  return { x: el.x, y: el.y, w, h: el.size * 1.4 };
}

export function hitTest(els: CanvasEl[], x: number, y: number): string | null {
  for (let i = els.length - 1; i >= 0; i--) {
    const b = boundsOf(els[i]);
    if (!b) continue;
    if (x >= b.x - 6 && x <= b.x + b.w + 6 && y >= b.y - 6 && y <= b.y + b.h + 6) {
      return els[i].id;
    }
  }
  return null;
}

export function exportPngDataUrl(els: CanvasEl[]): string {
  const c = document.createElement('canvas');
  c.width = CANVAS_W;
  c.height = CANVAS_H;
  const ctx = c.getContext('2d');
  if (!ctx) return '';
  paintCanvas(ctx, els);
  return c.toDataURL('image/png');
}

export function buildCanvasFileName(): string {
  const t = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `canvas-${t.getFullYear()}${p(t.getMonth() + 1)}${p(t.getDate())}-${p(t.getHours())}${p(t.getMinutes())}${p(t.getSeconds())}.png`;
}
