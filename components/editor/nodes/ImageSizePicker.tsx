'use client';

// 图像尺寸组合选择：比例 + 质量 + 分辨率（参考主流生成器面板，接入现有节点）

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export type ImageAspect =
  | 'auto'
  | '1:1'
  | '2:1'
  | '2:3'
  | '3:2'
  | '3:4'
  | '4:3'
  | '4:5'
  | '5:4'
  | '9:16'
  | '16:9'
  | '21:9';

export type ImageQuality = 'low' | 'medium' | 'high';
export type ImageRes = '1K' | '2K' | '4K';

export interface ImageSizeValue {
  aspect: ImageAspect;
  quality: ImageQuality;
  res: ImageRes;
}

const ASPECTS: { value: ImageAspect; label: string; icon: string }[] = [
  { value: 'auto', label: '自适应', icon: '□' },
  { value: '1:1', label: '1:1', icon: '□' },
  { value: '2:1', label: '2:1', icon: '▭' },
  { value: '2:3', label: '2:3', icon: '▯' },
  { value: '3:2', label: '3:2', icon: '▭' },
  { value: '3:4', label: '3:4', icon: '▯' },
  { value: '4:3', label: '4:3', icon: '▭' },
  { value: '4:5', label: '4:5', icon: '▯' },
  { value: '5:4', label: '5:4', icon: '▭' },
  { value: '9:16', label: '9:16', icon: '▯' },
  { value: '16:9', label: '16:9', icon: '▭' },
  { value: '21:9', label: '21:9', icon: '▭' },
];

const QUALITIES: { value: ImageQuality; label: string }[] = [
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
];

const RESOLUTIONS: { value: ImageRes; label: string }[] = [
  { value: '1K', label: '1k' },
  { value: '2K', label: '2k' },
  { value: '4K', label: '4k' },
];

function qualityLabel(q: ImageQuality): string {
  return QUALITIES.find((x) => x.value === q)?.label ?? q;
}

function aspectLabel(a: ImageAspect): string {
  if (a === 'auto') return '自适应';
  return a;
}

/** 触发器摘要：16:9 / 高 / 1k */
export function formatImageSizeSummary(v: ImageSizeValue): string {
  return `${aspectLabel(v.aspect)} / ${qualityLabel(v.quality)} / ${v.res.toLowerCase()}`;
}

interface Props {
  value: ImageSizeValue;
  onChange: (next: ImageSizeValue) => void;
}

export function ImageSizePicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div className="relative nodrag nowheel" ref={ref}>
      <button
        type="button"
        title="比例 / 质量 / 分辨率"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-accent transition-colors text-xs max-w-44"
      >
        <span className="truncate font-medium">{formatImageSizeSummary(value)}</span>
        <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div
          className="absolute bottom-full left-0 mb-1 w-72 rounded-xl bg-card border border-border shadow-sm p-3 z-50 flex flex-col gap-3"
          onClick={(e) => e.stopPropagation()}
        >
          <section>
            <div className="text-[11px] text-muted-foreground mb-2">比例</div>
            <div className="grid grid-cols-4 gap-1.5">
              {ASPECTS.map((a) => {
                const selected = value.aspect === a.value;
                return (
                  <button
                    key={a.value}
                    type="button"
                    onClick={() => onChange({ ...value, aspect: a.value })}
                    className={`flex flex-col items-center gap-0.5 rounded-lg border px-1 py-1.5 text-[10px] transition-colors ${
                      selected
                        ? 'border-primary bg-accent text-foreground'
                        : 'border-border/60 text-muted-foreground hover:bg-accent/60'
                    }`}
                  >
                    <span className="text-sm leading-none opacity-70">{a.icon}</span>
                    <span>{a.label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <div className="text-[11px] text-muted-foreground mb-2">图像质量</div>
            <div className="grid grid-cols-3 gap-1.5">
              {QUALITIES.map((q) => {
                const selected = value.quality === q.value;
                return (
                  <button
                    key={q.value}
                    type="button"
                    onClick={() => onChange({ ...value, quality: q.value })}
                    className={`rounded-lg border px-2 py-1.5 text-xs transition-colors ${
                      selected
                        ? 'border-primary bg-accent text-foreground'
                        : 'border-border/60 text-muted-foreground hover:bg-accent/60'
                    }`}
                  >
                    {q.label}
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <div className="text-[11px] text-muted-foreground mb-2">分辨率</div>
            <div className="grid grid-cols-3 gap-1.5">
              {RESOLUTIONS.map((r) => {
                const selected = value.res === r.value;
                return (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => onChange({ ...value, res: r.value })}
                    className={`rounded-lg border px-2 py-1.5 text-xs transition-colors ${
                      selected
                        ? 'border-primary bg-accent text-foreground'
                        : 'border-border/60 text-muted-foreground hover:bg-accent/60'
                    }`}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
          </section>

          <div className="flex items-center gap-1 text-[10px] text-muted-foreground pt-0.5">
            <Check className="size-3" />
            <span>当前：{formatImageSizeSummary(value)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
