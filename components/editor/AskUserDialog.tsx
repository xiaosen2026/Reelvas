'use client';

// Agent ask_user：选择题弹窗，点选后才继续 tool 循环

import { useEffect, useRef, useState } from 'react';
import { HelpCircle, X } from 'lucide-react';

export type AskUserOption = { id: string; label: string };

export type AskUserRequest = {
  question: string;
  options: AskUserOption[];
  allowFreeText?: boolean;
};

export type AskUserAnswer = {
  selected_id: string;
  selected_label: string;
  free_text?: string;
  cancelled?: boolean;
};

type Props = {
  open: boolean;
  request: AskUserRequest | null;
  onAnswer: (answer: AskUserAnswer) => void;
};

export function AskUserDialog({ open, request, onAnswer }: Props) {
  const [free, setFree] = useState('');
  const bgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setFree('');
  }, [open, request?.question]);

  if (!open || !request) return null;

  const options = (request.options || []).filter((o) => o?.id && o?.label).slice(0, 6);
  const allowFree = Boolean(request.allowFreeText);

  const pick = (opt: AskUserOption) => {
    onAnswer({
      selected_id: opt.id,
      selected_label: opt.label,
      free_text: free.trim() || undefined,
    });
  };

  const submitFree = () => {
    const t = free.trim();
    if (!t) return;
    onAnswer({
      selected_id: 'free_text',
      selected_label: t,
      free_text: t,
    });
  };

  return (
    <div
      ref={bgRef}
      className="fixed inset-0 z-[10060] flex items-center justify-center bg-black/30"
      role="dialog"
      aria-modal="true"
      aria-label="需要你的选择"
    >
      <div className="w-[min(420px,92vw)] overflow-hidden rounded-xl border border-border bg-background shadow-sm">
        <div className="flex items-start gap-3 border-b border-border px-4 py-3">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
            <HelpCircle className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-foreground">需要你的选择</h2>
            <p className="mt-1 text-sm leading-relaxed text-foreground">{request.question}</p>
          </div>
          <button
            type="button"
            aria-label="取消并跳过"
            onClick={() =>
              onAnswer({
                selected_id: 'cancelled',
                selected_label: '用户取消',
                cancelled: true,
              })
            }
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex flex-col gap-1.5 px-4 py-3">
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => pick(opt)}
              className="rounded-md border border-border px-3 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-muted"
            >
              <span className="font-medium">{opt.label}</span>
            </button>
          ))}
          {options.length === 0 ? (
            <p className="text-xs text-muted-foreground">无可选项，请关闭后重试</p>
          ) : null}
        </div>

        {allowFree ? (
          <div className="border-t border-border px-4 py-3">
            <label className="mb-1 block text-[11px] text-muted-foreground">或自定义</label>
            <div className="flex gap-2">
              <input
                value={free}
                onChange={(e) => setFree(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    submitFree();
                  }
                }}
                placeholder="输入你的选择…"
                className="min-w-0 flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-foreground/30"
              />
              <button
                type="button"
                disabled={!free.trim()}
                onClick={submitFree}
                className="shrink-0 rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background disabled:opacity-40"
              >
                确定
              </button>
            </div>
          </div>
        ) : null}

        <div className="border-t border-border bg-muted/30 px-4 py-2">
          <p className="text-[10px] text-muted-foreground">选择后 Agent 会继续执行，不会停在半路</p>
        </div>
      </div>
    </div>
  );
}
