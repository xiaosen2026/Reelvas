'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

// 轻量下拉：支持选项级 icon / desc
export interface DropdownOption {
  value: string;
  label: string;
  /** 选项左侧图标（React 节点） */
  icon?: React.ReactNode;
  /** 副文案说明（非余额） */
  desc?: string;
}

interface Props {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  /** 触发器左侧固定图标（无选项 icon 时使用） */
  icon?: React.ReactNode;
  size?: 'sm' | 'md';
  /** 加宽菜单（模型列表） */
  wide?: boolean;
}

export function Dropdown({ value, options, onChange, icon, size = 'sm', wide = false }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value);
  const textCls = size === 'sm' ? 'text-xs' : 'text-sm';

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const triggerIcon = current?.icon ?? icon;

  return (
    <div className="relative nodrag nowheel" ref={ref}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-accent transition-colors max-w-48 ${textCls}`}
      >
        {triggerIcon && <span className="shrink-0 text-muted-foreground flex items-center">{triggerIcon}</span>}
        <span className="truncate">{current ? current.label : value}</span>
        <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div
          className={`absolute bottom-full left-0 mb-1 max-h-60 overflow-y-auto rounded-lg bg-card border border-border shadow-sm py-1 z-50 ${
            wide ? 'min-w-64 max-w-80' : 'min-w-40 max-w-70'
          }`}
        >
          {options.map((opt) => {
            const selected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`w-full flex items-start gap-2 px-3 py-1.5 text-left hover:bg-accent transition-colors ${
                  selected ? 'text-foreground' : 'text-muted-foreground'
                }`}
              >
                {opt.icon ? (
                  <span className="mt-0.5 shrink-0 flex items-center">{opt.icon}</span>
                ) : null}
                <span className="flex-1 min-w-0">
                  <span className={`block truncate ${textCls}`}>{opt.label}</span>
                  {opt.desc ? (
                    <span className="block text-[10px] text-muted-foreground truncate mt-0.5">{opt.desc}</span>
                  ) : null}
                </span>
                {selected ? <Check className="size-3.5 shrink-0 text-primary mt-0.5" /> : <span className="w-3.5 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
