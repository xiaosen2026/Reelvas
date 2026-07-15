'use client';

import { useLayoutEffect, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';

type Align = 'left' | 'right';

/** 顶层浮动菜单：挂 body，避免被面板 overflow / 右边缘裁切 */
export function FloatingMenu({
  open,
  anchorRef,
  align = 'right',
  minWidth = 160,
  maxWidth = 320,
  maxHeight,
  className = '',
  children,
}: {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  align?: Align;
  minWidth?: number;
  maxWidth?: number;
  maxHeight?: number;
  className?: string;
  children: ReactNode;
}) {
  const [style, setStyle] = useState<CSSProperties | null>(null);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) {
      setStyle(null);
      return;
    }
    const place = () => {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const width = Math.min(maxWidth, Math.max(minWidth, r.width, 200));
      let left = align === 'right' ? r.right - width : r.left;
      left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
      // 优先向上展开；若上方空间不足则向下
      const gap = 8;
      const preferUp = r.top > 120;
      const top = preferUp ? r.top - gap : r.bottom + gap;
      setStyle({
        position: 'fixed',
        top,
        left,
        width,
        maxHeight: maxHeight ?? 240,
        transform: preferUp ? 'translateY(-100%)' : undefined,
        zIndex: 10000,
      });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, anchorRef, align, minWidth, maxWidth, maxHeight]);

  if (!open || !style || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={`overflow-y-auto rounded-md editor-panel-surface border border-border/50 shadow-sm ${className}`}
      style={style}
      onClick={(e) => e.stopPropagation()}
      role="listbox"
    >
      {children}
    </div>,
    document.body,
  );
}
