'use client';

// 画板全屏：笔/形/字 + 撤销重做 + 发送 PNG

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Send, X } from 'lucide-react';
import { CANVAS_H, CANVAS_W, type CanvasEl } from './canvasDrawing';
import { CanvasToolbarBar } from './CanvasToolbarBar';
import { useCanvasDraw } from './useCanvasDraw';
import { createLogger } from '@/lib/logger';

const log = createLogger('CanvasFullscreen');

type Props = {
  open: boolean;
  title: string;
  initialEls: CanvasEl[];
  tip?: string;
  sending?: boolean;
  onSend: (els: CanvasEl[]) => void;
  onClose: () => void;
};

export function CanvasFullscreen({
  open,
  title,
  initialEls,
  tip = '',
  sending = false,
  onSend,
  onClose,
}: Props) {
  const d = useCanvasDraw(open, initialEls);

  useEffect(() => {
    if (!open) return;
    log.info('open', 'load', { n: initialEls.length });
  }, [open, initialEls]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) d.redo();
        else d.undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        d.redo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'enter') {
        e.preventDefault();
        if (!sending) onSend(d.els);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, onSend, sending, d.els, d.undo, d.redo]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-300 flex flex-col bg-background text-foreground"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-border shrink-0">
        <span className="text-sm text-muted-foreground truncate">
          {title} — 作画 {d.els.length ? `· ${d.els.length} 笔迹` : ''}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {tip ? <span className="text-xs text-amber-600 max-w-xs truncate">{tip}</span> : null}
          <span className="hidden sm:inline text-xs text-muted-foreground">Esc 关闭 · Ctrl+Enter 发送</span>
          <button
            type="button"
            disabled={sending || (!d.els.length && !d.draft)}
            onClick={() => onSend(d.els)}
            className="h-8 px-3 rounded-lg bg-foreground text-background text-xs font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
          >
            <Send className="size-3.5" />
            {sending ? '发送中…' : '发送到画布'}
          </button>
          <button
            type="button"
            className="h-8 px-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
            onClick={onClose}
          >
            <X className="size-4" />
            关闭
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex items-center justify-center bg-muted/30 p-4 nodrag nowheel">
        <canvas
          ref={d.canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="max-w-full max-h-full bg-white border border-border shadow-sm rounded-lg cursor-crosshair touch-none"
          style={{ aspectRatio: `${CANVAS_W} / ${CANVAS_H}` }}
          onPointerDown={d.onPointerDown}
          onPointerMove={d.onPointerMove}
          onPointerUp={d.onPointerUp}
          onPointerCancel={d.onPointerUp}
        />
      </div>

      <CanvasToolbarBar
        tool={d.tool}
        color={d.color}
        canUndo={d.past.length > 0}
        canRedo={d.future.length > 0}
        selectedId={d.selectedId}
        onTool={d.setTool}
        onColor={d.setColor}
        onClear={d.clearOrDelete}
        onUndo={d.undo}
        onRedo={d.redo}
      />
    </div>,
    document.body,
  );
}
