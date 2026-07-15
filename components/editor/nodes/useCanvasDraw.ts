// 画板全屏绘制交互 hook（指针 + 历史）

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CANVAS_H,
  CANVAS_W,
  DEFAULT_STROKE,
  type CanvasEl,
  type CanvasTool,
  hitTest,
  newElId,
  paintCanvas,
} from './canvasDrawing';

type DragState = {
  mode: CanvasTool;
  startX: number;
  startY: number;
  penId?: string;
  points?: { x: number; y: number }[];
};

export function useCanvasDraw(open: boolean, initialEls: CanvasEl[]) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [els, setEls] = useState<CanvasEl[]>(initialEls);
  const [past, setPast] = useState<CanvasEl[][]>([]);
  const [future, setFuture] = useState<CanvasEl[][]>([]);
  const [tool, setTool] = useState<CanvasTool>('pen');
  const [color, setColor] = useState('#ef4444');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CanvasEl | null>(null);
  const dragRef = useRef<DragState | null>(null);

  useEffect(() => {
    if (!open) return;
    setEls(initialEls);
    setPast([]);
    setFuture([]);
    setSelectedId(null);
    setDraft(null);
    setTool('pen');
  }, [open, initialEls]);

  const repaint = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    paintCanvas(ctx, els, draft, selectedId);
  }, [els, draft, selectedId]);

  useEffect(() => {
    if (!open) return;
    repaint();
  }, [open, repaint]);

  const pushHistory = useCallback(
    (next: CanvasEl[]) => {
      setPast((p) => [...p.slice(-40), els]);
      setFuture([]);
      setEls(next);
    },
    [els],
  );

  const undo = useCallback(() => {
    setPast((p) => {
      if (!p.length) return p;
      const prev = p[p.length - 1];
      setFuture((f) => [els, ...f].slice(0, 40));
      setEls(prev);
      setSelectedId(null);
      return p.slice(0, -1);
    });
  }, [els]);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (!f.length) return f;
      const [next, ...rest] = f;
      setPast((p) => [...p, els].slice(-40));
      setEls(next);
      setSelectedId(null);
      return rest;
    });
  }, [els]);

  const toLogical = useCallback((clientX: number, clientY: number) => {
    const c = canvasRef.current;
    if (!c) return { x: 0, y: 0 };
    const r = c.getBoundingClientRect();
    const x = ((clientX - r.left) / r.width) * CANVAS_W;
    const y = ((clientY - r.top) / r.height) * CANVAS_H;
    return {
      x: Math.max(0, Math.min(CANVAS_W, x)),
      y: Math.max(0, Math.min(CANVAS_H, y)),
    };
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      const { x, y } = toLogical(e.clientX, e.clientY);

      if (tool === 'select') {
        setSelectedId(hitTest(els, x, y));
        dragRef.current = null;
        return;
      }
      if (tool === 'text') {
        const text = window.prompt('输入文字', '');
        if (text && text.trim()) {
          pushHistory([
            ...els,
            { id: newElId(), kind: 'text', color, x, y, text: text.trim(), size: 28 },
          ]);
        }
        return;
      }
      if (tool === 'pen') {
        const id = newElId();
        dragRef.current = { mode: 'pen', startX: x, startY: y, penId: id, points: [{ x, y }] };
        setDraft({ id, kind: 'pen', color, width: DEFAULT_STROKE, points: [{ x, y }] });
        return;
      }
      dragRef.current = { mode: tool, startX: x, startY: y };
      if (tool === 'rect') {
        setDraft({ id: 'draft', kind: 'rect', color, width: DEFAULT_STROKE, x, y, w: 0, h: 0 });
      } else if (tool === 'circle') {
        setDraft({ id: 'draft', kind: 'circle', color, width: DEFAULT_STROKE, cx: x, cy: y, r: 0 });
      }
    },
    [tool, els, color, toLogical, pushHistory],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const d = dragRef.current;
      if (!d) return;
      const { x, y } = toLogical(e.clientX, e.clientY);
      if (d.mode === 'pen' && d.points) {
        d.points.push({ x, y });
        setDraft({
          id: d.penId || 'draft',
          kind: 'pen',
          color,
          width: DEFAULT_STROKE,
          points: [...d.points],
        });
      } else if (d.mode === 'rect') {
        setDraft({
          id: 'draft',
          kind: 'rect',
          color,
          width: DEFAULT_STROKE,
          x: d.startX,
          y: d.startY,
          w: x - d.startX,
          h: y - d.startY,
        });
      } else if (d.mode === 'circle') {
        const r = Math.hypot(x - d.startX, y - d.startY);
        setDraft({
          id: 'draft',
          kind: 'circle',
          color,
          width: DEFAULT_STROKE,
          cx: d.startX,
          cy: d.startY,
          r,
        });
      }
    },
    [color, toLogical],
  );

  const onPointerUp = useCallback(() => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d || !draft) {
      setDraft(null);
      return;
    }
    if (d.mode === 'pen' && draft.kind === 'pen' && draft.points.length > 0) {
      pushHistory([...els, { ...draft, id: d.penId || newElId() }]);
    } else if (d.mode === 'rect' && draft.kind === 'rect' && (Math.abs(draft.w) > 2 || Math.abs(draft.h) > 2)) {
      pushHistory([...els, { ...draft, id: newElId() }]);
    } else if (d.mode === 'circle' && draft.kind === 'circle' && draft.r > 2) {
      pushHistory([...els, { ...draft, id: newElId() }]);
    }
    setDraft(null);
  }, [draft, els, pushHistory]);

  const clearOrDelete = useCallback(() => {
    if (selectedId) {
      pushHistory(els.filter((el) => el.id !== selectedId));
      setSelectedId(null);
      return;
    }
    if (!els.length) return;
    if (!window.confirm('清空画板全部内容？')) return;
    pushHistory([]);
  }, [els, selectedId, pushHistory]);

  return {
    canvasRef,
    els,
    past,
    future,
    tool,
    setTool,
    color,
    setColor,
    selectedId,
    draft,
    undo,
    redo,
    clearOrDelete,
    onPointerDown,
    onPointerMove,
    onPointerUp,
  };
}
