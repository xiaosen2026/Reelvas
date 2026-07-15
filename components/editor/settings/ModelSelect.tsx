'use client';

import { useState } from 'react';
import { ModelItem } from '../../../lib/settingsData';
import { ModelIcon } from './ModelIcon';

const IChevron = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0 opacity-50"><path d="m6 9 6 6 6-6" /></svg>
);
const ICheck = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-primary"><path d="M20 6 9 17l-5-5" /></svg>
);

// Agent 模型偏好下拉：点击展开模型列表（图标 + 名称 + 定价说明 + 选中打勾）
export function ModelSelect({ label, models, value, onChange }: { label: string; models: ModelItem[]; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const current = models.find((m) => m.name === value) ?? models[0];

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1.5">{label}</p>
      <div className="relative">
        {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground flex items-center justify-between hover:border-ring transition-colors"
        >
          <span className="flex items-center gap-2 truncate"><ModelIcon name={current['name']} size={18} fallback={current['icon']} />{current['name']}</span>
          <IChevron />
        </button>
        {open && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 max-h-72 overflow-y-auto rounded-lg bg-popover border border-border shadow-md py-1">
            {models.map((m) => (
              <button
                key={m.name}
                type="button"
                onClick={() => { onChange(m.name); setOpen(false); }}
                className="w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-muted/50 transition-colors"
              >
                <span className="mt-0.5"><ModelIcon name={m.name} size={18} fallback={m.icon} /></span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm text-foreground">{m.name}</span>
                  <span className="block text-xs text-muted-foreground">{m.desc}</span>
                </span>
                <span className="w-4 shrink-0 mt-0.5">{m.name === value && <ICheck />}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
