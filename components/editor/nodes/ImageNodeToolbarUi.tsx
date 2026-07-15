'use client';

// 图片节点顶部工具栏共享 UI 碎片

import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import type { ToolMenuItem } from './imageToolMenus';

export function TbBtn({
  children, onClick, disabled, title,
}: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; title?: string }) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className="flex items-center gap-1 h-8 px-2 rounded-full text-[11px] text-foreground hover:bg-muted/40 disabled:opacity-35 disabled:pointer-events-none transition-colors whitespace-nowrap"
    >
      {children}
    </button>
  );
}

export function IconBtn({
  children, onClick, disabled, title,
}: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; title?: string }) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className="flex items-center justify-center size-8 rounded-full text-foreground hover:bg-muted/40 disabled:opacity-35 disabled:pointer-events-none transition-colors"
    >
      {children}
    </button>
  );
}

export function Div() {
  return <div className="w-px h-5 bg-border/40 mx-0.5" />;
}

export function MenuWrap({
  open, onToggle, onClose, label, icon, children, disabled, wide, caret,
}: {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  disabled?: boolean;
  wide?: boolean;
  caret?: boolean;
}) {
  return (
    <div className="relative">
      <TbBtn onClick={onToggle} disabled={disabled} title={label}>
        {icon} {label}
        {caret ? (open ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />) : null}
      </TbBtn>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={onClose} />
          <div
            className={`absolute top-full left-0 mt-1.5 z-50 rounded-xl border border-border/50 bg-card shadow-sm p-1 ${
              wide ? 'w-max max-w-[min(560px,94vw)]' : 'w-52'
            }`}
          >
            {children}
          </div>
        </>
      )}
    </div>
  );
}

export function SimpleMenu({ items, onPick }: { items: ToolMenuItem[]; onPick: (i: ToolMenuItem) => void }) {
  return (
    <div className="py-0.5">
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          onClick={() => onPick(it)}
          className="w-full flex flex-col items-start gap-0.5 px-2.5 py-2 rounded-lg text-left hover:bg-muted/30 transition-colors"
        >
          <span className="text-xs text-foreground">{it.label}</span>
          {it.desc ? <span className="text-[10px] text-muted-foreground">{it.desc}</span> : null}
        </button>
      ))}
    </div>
  );
}

/** 二级面板：portal + fixed，避免被一级 max-h/overflow 裁切 */
function CascadeSubPanel({
  anchorEl, items, onPick,
}: {
  anchorEl: HTMLElement | null;
  items: ToolMenuItem[];
  onPick: (i: ToolMenuItem) => void;
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!anchorEl) {
      setPos(null);
      return;
    }
    const r = anchorEl.getBoundingClientRect();
    const w = 224; // w-56
    const gap = 4;
    const maxH = 288; // max-h-72
    let left = r.right + gap;
    let top = r.top;
    // 贴右边界时改到左侧
    if (left + w > window.innerWidth - 8) left = Math.max(8, r.left - w - gap);
    // 视口钳制：工具条常在卡片上方，rect.top 可能为负
    if (top < 8) top = 8;
    if (top + maxH > window.innerHeight - 8) {
      top = Math.max(8, window.innerHeight - maxH - 8);
    }
    if (left < 8) left = 8;
    setPos({ top, left });
  }, [anchorEl]);

  if (!pos || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed w-56 rounded-xl border border-border/50 bg-card shadow-sm p-1 z-300 max-h-72 overflow-y-auto"
      style={{ top: pos.top, left: pos.left }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onPick(c)}
          className="w-full flex flex-col items-start gap-0.5 px-2.5 py-2 rounded-lg text-left hover:bg-muted/30 transition-colors"
        >
          <span className="text-xs text-foreground">{c.label}</span>
          {c.desc ? (
            <span className="text-[10px] text-muted-foreground leading-snug line-clamp-2">{c.desc}</span>
          ) : null}
        </button>
      ))}
    </div>,
    document.body,
  );
}

export function CascadeMenu({
  items, subId, onPick,
}: { items: ToolMenuItem[]; subId: string | null; onPick: (i: ToolMenuItem) => void }) {
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  return (
    <div className="py-0.5 max-h-80 overflow-y-auto">
      {items.map((it) => (
        <div
          key={it.id}
          ref={(el) => {
            rowRefs.current[it.id] = el;
          }}
          className="relative"
        >
          <button
            type="button"
            onClick={() => onPick(it)}
            className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-left hover:bg-muted/30 transition-colors"
          >
            <span className="min-w-0 flex flex-col items-start gap-0.5">
              <span className="text-xs text-foreground">{it.label}</span>
              {it.desc ? (
                <span className="text-[10px] text-muted-foreground leading-snug line-clamp-2">{it.desc}</span>
              ) : null}
            </span>
            {it.children?.length ? <ChevronRight className="size-3.5 text-muted-foreground shrink-0" /> : null}
          </button>
          {it.children && subId === it.id ? (
            <CascadeSubPanel
              anchorEl={rowRefs.current[it.id]}
              items={it.children}
              onPick={onPick}
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}
