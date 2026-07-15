'use client';

import { useState } from 'react';
import { Switch } from './Switch';
import { AutoSaveDirSection } from './AutoSaveDirSection';
import { McpControlSection } from './McpControlSection';
import { getComfyServerUrl, setComfyServerUrl } from '@/lib/settingsStore';

const PERF_KEY = 'reelvas_perf_panel';

function usePerfToggle() {
  const [v, setV] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem(PERF_KEY) === '1';
    return false;
  });
  const toggle = () => {
    const next = !v;
    localStorage.setItem(PERF_KEY, next ? '1' : '0');
    setV(next);
    window.dispatchEvent(new Event('storage'));
  };
  return [v, toggle] as const;
}

const IChevron = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0 opacity-50"><path d="m6 9 6 6 6-6"/></svg>
);

export function GeneralTab() {
  const [perfPanel, togglePerf] = usePerfToggle();
  const [layout, setLayout] = useState('网格对齐');
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [comfyUrl, setComfyUrl] = useState(() => getComfyServerUrl());

  return (
    <div className="space-y-7">
      <div className="overflow-hidden rounded-2xl border border-border/50 bg-white">
        <div className="flex items-center justify-between gap-4 border-b border-border/40 px-7 py-5">
          <div className="flex items-center gap-4">
            <span className="flex size-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19V5"/><path d="M20 19V5"/><path d="M4 15h16"/><path d="M8 11v4"/><path d="M12 7v8"/><path d="M16 10v5"/></svg>
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">显示性能监视面板</p>
              <p className="mt-1 text-xs text-muted-foreground">在画布右下角显示 FPS、帧时长、内存等实时性能数据。</p>
            </div>
          </div>
          <Switch checked={perfPanel} onChange={togglePerf} label="显示性能监视面板" />
        </div>

        <div className="flex items-center justify-between gap-4 px-7 py-5">
          <div className="flex items-center gap-4">
            <span className="flex size-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v18"/><path d="M3 12h18"/><path d="M6 6h12v12H6z"/></svg>
            </span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">自动布局方式</p>
              <p className="mt-1 text-xs text-muted-foreground">网格对齐按工作流分层整理，尽量保留上下文；全局整理会全局整理节点。</p>
            </div>
          </div>
          <div className="relative shrink-0">
            <button type="button" onClick={() => setLayoutOpen((v) => !v)} className="flex h-10 min-w-[150px] items-center justify-between gap-2 rounded-xl border border-border bg-background px-4 text-sm text-foreground transition-colors hover:border-ring">
              {layout}<IChevron />
            </button>
            {layoutOpen && (
              <div className="absolute right-0 top-full z-10 mt-1 w-36 rounded-lg border border-border bg-popover py-1 shadow-sm">
                {['网格对齐', '全局整理'].map((o) => (
                  <button
                    key={o}
                    type="button"
                    onClick={() => {
                      setLayout(o);
                      setLayoutOpen(false);
                    }}
                    className={`w-full px-3 py-1.5 text-left text-sm transition-colors hover:bg-muted/50 ${o === layout ? 'font-medium text-primary' : 'text-foreground'}`}
                  >
                    {o}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <AutoSaveDirSection />
      </div>

      <div className="rounded-2xl border border-border/50 bg-white px-7 py-5">
        <div className="mb-4 flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect width="8" height="8" x="3" y="3" rx="2"/><path d="M7 11v4a2 2 0 0 0 2 2h4"/><rect width="8" height="8" x="13" y="13" rx="2"/></svg>
            ComfyUI
          </span>
        </div>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="mb-1.5 block text-xs text-muted-foreground">ComfyUI 服务地址</label>
            <input
              value={comfyUrl}
              onChange={(e) => {
                setComfyUrl(e.target.value);
                setComfyServerUrl(e.target.value);
              }}
              placeholder="http://127.0.0.1:8188"
              className="h-9 w-full rounded-xl border border-border/60 bg-background px-3 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:border-foreground/30 focus:outline-none transition-colors"
            />
          </div>
        </div>
      </div>

      <McpControlSection />
    </div>
  );
}
