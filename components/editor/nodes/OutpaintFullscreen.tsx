'use client';

// 扩图全屏编辑：拖边外扩绿幕 + 补充描述 + 生成

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUp, Expand, Square, X } from 'lucide-react';
import { formatPadsLabel, type ExpandPads } from './buildGreenScreenCanvas';
import { OutpaintExpandStage } from './OutpaintExpandStage';
import { Dropdown, type DropdownOption } from './Dropdown';
import { createLogger } from '@/lib/logger';

const log = createLogger('OutpaintFullscreen');

type Props = {
  open: boolean;
  title: string;
  imageUrl: string;
  pads: ExpandPads;
  userHint: string;
  loading: boolean;
  error: string;
  model: string;
  modelOptions: DropdownOption[];
  defaultModel: string;
  onModelChange: (v: string) => void;
  onPadsChange: (next: ExpandPads) => void;
  onUserHint: (v: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  onClose: () => void;
};

export function OutpaintFullscreen({
  open,
  title,
  imageUrl,
  pads,
  userHint,
  loading,
  error,
  model,
  modelOptions,
  defaultModel,
  onModelChange,
  onPadsChange,
  onUserHint,
  onSubmit,
  onStop,
  onClose,
}: Props) {
  useEffect(() => {
    if (!open) return;
    log.info('open', 'editor', { title, hasImage: !!imageUrl });
  }, [open, title, imageUrl]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (!loading) onClose();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'enter') {
        e.preventDefault();
        if (!loading && imageUrl) onSubmit();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, loading, imageUrl, onClose, onSubmit]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-300 flex flex-col bg-background text-foreground"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Expand className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-sm text-muted-foreground">
            {title} — 扩图编辑
          </span>
          <span className="hidden shrink-0 font-mono text-[11px] text-muted-foreground/80 sm:inline">
            {formatPadsLabel(pads)}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden text-xs text-muted-foreground md:inline">
            拖白点外扩绿幕 · 原图不变形 · Esc 关闭 · Ctrl+Enter 生成
          </span>
          {loading ? (
            <button
              type="button"
              onClick={onStop}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-xs text-muted-foreground hover:text-foreground"
            >
              <Square className="size-3.5 fill-current" />
              停止
            </button>
          ) : (
            <button
              type="button"
              disabled={!imageUrl}
              onClick={() => void onSubmit()}
              className="flex h-8 items-center gap-1.5 rounded-lg bg-foreground px-3 text-xs font-medium text-background hover:opacity-90 disabled:opacity-50"
            >
              <ArrowUp className="size-3.5" />
              生成扩图
            </button>
          )}
          <button
            type="button"
            className="flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-sm text-muted-foreground hover:text-foreground"
            onClick={onClose}
            disabled={loading}
          >
            <X className="size-4" />
            关闭
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="nodrag nowheel flex min-h-0 flex-1 items-center justify-center bg-muted/30 p-4">
          <div className="relative h-full w-full max-w-5xl overflow-hidden rounded-xl border border-border bg-black/80 shadow-sm">
            {imageUrl ? (
              <OutpaintExpandStage
                imageUrl={imageUrl}
                pads={pads}
                onChange={onPadsChange}
                disabled={loading}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                请先连接参考图片
              </div>
            )}
            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-background/40 text-sm text-muted-foreground">
                合成绿幕并填充中…
              </div>
            ) : null}
          </div>
        </div>

        <aside className="w-full shrink-0 space-y-3 border-t border-border p-4 lg:w-72 lg:border-l lg:border-t-0">
          <div>
            <p className="mb-1 text-xs font-medium">模型</p>
            <Dropdown
              value={model}
              options={modelOptions.length ? modelOptions : [{ value: defaultModel, label: defaultModel }]}
              onChange={onModelChange}
              wide
            />
          </div>
          <div>
            <p className="mb-1 text-xs font-medium">外扩边距</p>
            <p className="font-mono text-[11px] text-muted-foreground">{formatPadsLabel(pads)}</p>
          </div>
          <label className="block space-y-1">
            <span className="text-xs text-muted-foreground">补充描述（可选）</span>
            <textarea
              value={userHint}
              onChange={(e) => onUserHint(e.target.value)}
              rows={4}
              disabled={loading}
              placeholder="如：向左侧延伸街道、右侧补天空…"
              className="w-full resize-none rounded-lg border border-border/50 bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/70 disabled:opacity-50"
            />
          </label>
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            与图片节点同一图像渠道模型。绿幕按原图真实比例扩展，拖边只改外扩区。
          </p>
          {error ? (
            <p className="text-[11px] text-red-500 whitespace-pre-wrap wrap-break-word">{error}</p>
          ) : null}
        </aside>
      </div>
    </div>,
    document.body,
  );
}
