'use client';

import { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CopilotMsg } from './useCopilotChat';
import { FloatingMenu } from './FloatingMenu';

/** 粗估 token：CJK 约 1.5 字/token，其它约 4 字/token */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  const cjk = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
  const rest = Math.max(0, text.length - cjk);
  return Math.max(0, Math.ceil(cjk / 1.5 + rest / 4));
}

/** 按模型名猜测上下文上限（无 API 字段时的本地默认） */
export function contextLimitForModel(model: string): number {
  const m = (model || '').toLowerCase();
  if (m.includes('32k')) return 32_768;
  if (m.includes('16k')) return 16_384;
  if (m.includes('8k')) return 8_192;
  if (m.includes('200k') || m.includes('claude')) return 200_000;
  if (m.includes('1m') || m.includes('gemini')) return 1_000_000;
  if (m.includes('mini') || m.includes('flash')) return 128_000;
  if (m.includes('grok') || m.includes('gpt-4') || m.includes('o1') || m.includes('o3')) return 128_000;
  return 128_000;
}

export function formatTok(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(Math.max(0, Math.round(n)));
}

export interface ContextBreakdown {
  messages: number;
  draft: number;
  system: number;
  used: number;
  limit: number;
  reserved: number;
  percent: number;
}

export function calcContextBreakdown(
  messages: CopilotMsg[],
  draft: string,
  model: string,
  systemPrompt = '',
): ContextBreakdown {
  const limit = contextLimitForModel(model);
  const reserved = Math.min(16_384, Math.max(2048, Math.floor(limit * 0.2)));
  const messagesTok = messages.reduce((s, m) => s + estimateTokens(m.content || ''), 0);
  const draftTok = estimateTokens(draft);
  const systemTok = estimateTokens(systemPrompt);
  const used = messagesTok + draftTok + systemTok;
  const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 1000) / 10) : 0;
  return { messages: messagesTok, draft: draftTok, system: systemTok, used, limit, reserved, percent };
}

function pctOf(part: number, limit: number): number {
  if (limit <= 0) return 0;
  return Math.min(100, (part / limit) * 100);
}

export function ContextWindowInfo({
  messages,
  draft,
  model,
  systemPrompt = '',
  onCompress,
}: {
  messages: CopilotMsg[];
  draft: string;
  model: string;
  /** 当前模式 system prompt，计入上下文估算 */
  systemPrompt?: string;
  /** 压缩对话：裁掉旧消息，保留近期轮次 */
  onCompress?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const b = useMemo(
    () => calcContextBreakdown(messages, draft, model, systemPrompt),
    [messages, draft, model, systemPrompt],
  );

  const ring = Math.min(100, b.percent);
  const warn = b.percent >= 80;
  const mid = b.percent >= 50;

  const backdrop =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div className="fixed inset-0 z-[9990]" onClick={() => setOpen(false)} aria-hidden />,
          document.body,
        )
      : null;

  return (
    <>
      {backdrop}
      <button
        ref={btnRef}
        type="button"
        aria-label={`上下文窗口 ${formatTok(b.used)}/${formatTok(b.limit)}，${b.percent}%`}
        title={`上下文 ${formatTok(b.used)} / ${formatTok(b.limit)}（${b.percent}%）`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={`flex h-8 items-center gap-1.5 rounded-md px-1.5 text-[11px] tabular-nums transition-colors hover:bg-muted/50 ${
          warn ? 'text-amber-600' : mid ? 'text-foreground/80' : 'text-muted-foreground'
        }`}
      >
        <span className="relative inline-flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden>
          <svg viewBox="0 0 36 36" className="h-4 w-4 -rotate-90">
            <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3" className="opacity-20" />
            <circle
              cx="18"
              cy="18"
              r="15"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={`${(ring / 100) * 94.2} 94.2`}
            />
          </svg>
        </span>
        <span>{Math.round(b.percent)}%</span>
      </button>

      <FloatingMenu
        open={open}
        anchorRef={btnRef}
        align="right"
        minWidth={260}
        maxWidth={300}
        maxHeight={320}
        className="p-3"
      >
        <div className="flex flex-col gap-2.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-foreground">SessionInfo</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">上下文窗口</p>
            </div>
            <p className={`text-sm font-medium tabular-nums ${warn ? 'text-amber-600' : 'text-foreground'}`}>
              {Math.round(b.percent)}%
            </p>
          </div>

          <p className="text-xs text-foreground tabular-nums">
            {formatTok(b.used)}
            <span className="text-muted-foreground"> / {formatTok(b.limit)} 个令牌</span>
          </p>

          <div className="space-y-1">
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden flex">
              <div
                className={`h-full transition-all ${warn ? 'bg-amber-500' : 'bg-primary'}`}
                style={{ width: `${pctOf(b.used, b.limit)}%` }}
              />
              <div
                className="h-full bg-muted-foreground/25"
                style={{ width: `${pctOf(b.reserved, b.limit)}%` }}
                title="保留用于响应"
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              保留用于响应 · 约 {formatTok(b.reserved)}
            </p>
          </div>

          <ul className="flex flex-col gap-1.5 text-[11px]">
            <Row label="Messages" value={b.messages} limit={b.limit} />
            <Row label="当前输入" value={b.draft} limit={b.limit} />
            {b.system > 0 && <Row label="System" value={b.system} limit={b.limit} />}
          </ul>

          {onCompress && (
            <button
              type="button"
              onClick={() => {
                onCompress();
                setOpen(false);
              }}
              disabled={messages.length < 4}
              className="mt-1 w-full rounded-md border border-border/60 bg-muted/50 px-2 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-default"
            >
              压缩对话
            </button>
          )}
          <p className="text-[10px] text-muted-foreground leading-snug">
            本地估算（非 API 精确值）· 上限按模型名默认
          </p>
        </div>
      </FloatingMenu>
    </>
  );
}

function Row({ label, value, limit }: { label: string; value: number; limit: number }) {
  return (
    <li className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums text-foreground">
        {formatTok(value)}
        <span className="text-muted-foreground ml-1">· {pctOf(value, limit).toFixed(1)}%</span>
      </span>
    </li>
  );
}
