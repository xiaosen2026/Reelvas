'use client';

// 图片灯箱：全屏放大预览，Esc / 点击遮罩关闭

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X, ZoomIn } from 'lucide-react';
import { createLogger } from '../../../lib/logger';

const log = createLogger('ImageLightbox');

type Props = {
  open: boolean;
  urls: string[];
  /** 打开时默认索引 */
  startIndex?: number;
  title?: string;
  onClose: () => void;
};

export function ImageLightbox({ open, urls, startIndex = 0, title = '图片预览', onClose }: Props) {
  const [idx, setIdx] = useState(0);
  const list = urls.filter(Boolean);
  const src = list[idx] || '';

  useEffect(() => {
    if (!open) return;
    const next = Math.min(Math.max(0, startIndex), Math.max(0, list.length - 1));
    setIdx(next);
    log.info('open', 'lightbox', { count: list.length, start: next });
  }, [open, startIndex, list.length]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'ArrowLeft' && list.length > 1) {
        e.preventDefault();
        setIdx((i) => (i - 1 + list.length) % list.length);
      }
      if (e.key === 'ArrowRight' && list.length > 1) {
        e.preventDefault();
        setIdx((i) => (i + 1) % list.length);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, list.length, onClose]);

  if (!open || !src || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-300 flex flex-col bg-black/92 text-white"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onClose}
      role="dialog"
      aria-modal
      aria-label={title}
    >
      <div
        className="flex items-center justify-between gap-3 px-4 py-2 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-sm text-white/70 truncate min-w-0 flex items-center gap-1.5">
          <ZoomIn className="size-3.5 shrink-0 opacity-70" />
          {title}
          {list.length > 1 ? (
            <span className="text-white/40">
              · {idx + 1}/{list.length}
            </span>
          ) : null}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <span className="hidden sm:inline text-xs text-white/40">Esc 关闭 · 点击空白关闭</span>
          <button
            type="button"
            title="关闭"
            onClick={onClose}
            className="h-8 px-2.5 rounded-lg border border-white/20 text-sm text-white/80 hover:text-white hover:bg-white/10 flex items-center gap-1"
          >
            <X className="size-4" />
            关闭
          </button>
        </div>
      </div>

      <div className="relative flex-1 min-h-0 flex items-center justify-center px-4 pb-6 nodrag nowheel">
        {list.length > 1 ? (
          <>
            <button
              type="button"
              title="上一张"
              className="absolute left-3 z-10 size-10 rounded-full border border-white/20 bg-black/40 text-white/90 hover:bg-black/60 flex items-center justify-center"
              onClick={(e) => {
                e.stopPropagation();
                setIdx((i) => (i - 1 + list.length) % list.length);
              }}
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              title="下一张"
              className="absolute right-3 z-10 size-10 rounded-full border border-white/20 bg-black/40 text-white/90 hover:bg-black/60 flex items-center justify-center"
              onClick={(e) => {
                e.stopPropagation();
                setIdx((i) => (i + 1) % list.length);
              }}
            >
              <ChevronRight className="size-5" />
            </button>
          </>
        ) : null}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          className="max-w-full max-h-full object-contain select-none shadow-sm"
          draggable={false}
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </div>,
    document.body,
  );
}
