'use client';

// 全景全屏层：旋转预览 + 发送当前视角到画布

import { createPortal } from 'react-dom';
import { Send, X } from 'lucide-react';

type Props = {
  open: boolean;
  title: string;
  tip: string;
  sending: boolean;
  canSend: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onSend: () => void;
  onClose: () => void;
};

export function PanoramaFullscreen({
  open,
  title,
  tip,
  sending,
  canSend,
  containerRef,
  onSend,
  onClose,
}: Props) {
  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-300 bg-black flex flex-col">
      <div className="flex items-center justify-between gap-3 px-4 py-2 shrink-0">
        <span className="text-sm text-white/70 truncate">{title}</span>
        <div className="flex items-center gap-2 shrink-0">
          {tip ? <span className="text-xs text-amber-300/90 max-w-xs truncate">{tip}</span> : null}
          <span className="hidden sm:inline text-xs text-white/50">拖拽旋转 · 滚轮缩放视角</span>
          <button
            type="button"
            disabled={sending || !canSend}
            onClick={onSend}
            className="h-8 px-3 rounded-lg bg-white text-black text-xs font-medium hover:bg-white/90 disabled:opacity-50 flex items-center gap-1.5"
          >
            <Send className="size-3.5" />
            {sending ? '发送中…' : '发送到画布'}
          </button>
          <button
            type="button"
            className="h-8 px-2.5 rounded-lg border border-white/20 text-sm text-white/70 hover:text-white flex items-center gap-1"
            onClick={onClose}
          >
            <X className="size-4" />
            关闭
          </button>
        </div>
      </div>
      <div
        ref={containerRef}
        className="flex-1 min-h-0 nodrag nowheel"
        onPointerDown={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
      />
    </div>,
    document.body,
  );
}
