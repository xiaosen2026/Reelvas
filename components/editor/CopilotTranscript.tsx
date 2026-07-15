'use client';

import type { MutableRefObject } from 'react';
import { useMemo, useState } from 'react';
import { RotateCcw, Check, X } from 'lucide-react';
import type { CopilotMsg, ToolCallRecord } from './useCopilotChat';
import type { WorkflowHandle } from './CanvasFlowCore';
import { quickActions } from '../../lib/editor';
import { CopilotMarkdown } from './CopilotMarkdown';

/** 时间线条目：user / assistant 文本 / 单次 tool（不归类） */
type TimelineItem =
  | { kind: 'user' | 'assistant'; id: string; content: string }
  | { kind: 'tool'; id: string; tool: ToolCallRecord };

/**
 * 把消息列表展平为时间线。
 * - 新数据：role=tool 已是独立条目
 * - 旧数据：assistant.toolCalls 挂在气泡下 → 展开到文本后，保持相对顺序
 */
function toTimeline(messages: CopilotMsg[]): TimelineItem[] {
  const out: TimelineItem[] = [];
  for (const m of messages) {
    if (m.role === 'user') {
      out.push({ kind: 'user', id: m.id, content: m.content || '' });
      continue;
    }
    if (m.role === 'tool' && m.toolCall) {
      out.push({ kind: 'tool', id: m.id, tool: m.toolCall });
      continue;
    }
    if (m.role === 'assistant') {
      const text = m.content || '';
      const legacy = m.toolCalls?.length ? m.toolCalls : [];
      // 有文本则先出文本，再按数组顺序展开旧 tool（旧数据无法还原真实交错，只能保相对序）
      if (text.trim() || !legacy.length) {
        out.push({ kind: 'assistant', id: m.id, content: text });
      }
      legacy.forEach((tc, i) => {
        out.push({ kind: 'tool', id: `${m.id}-legacy-${i}`, tool: tc });
      });
    }
  }
  return out;
}

function ToolCallRow({ tool, onUndo }: { tool: ToolCallRecord; onUndo?: () => void }) {
  const [undoing, setUndoing] = useState(false);
  const handleUndo = () => {
    if (!onUndo) return;
    setUndoing(true);
    onUndo();
    window.setTimeout(() => setUndoing(false), 600);
  };
  return (
    <div
      className={`flex w-full items-center gap-2 rounded-md border px-2.5 py-1.5 font-mono text-[11px] ${
        tool.ok
          ? 'border-border/60 bg-muted/40 text-foreground'
          : 'border-red-200 bg-red-50 text-red-700'
      } ${undoing ? 'opacity-50' : ''}`}
    >
      <span className="shrink-0 text-muted-foreground">{tool.ok ? '✓' : '✗'}</span>
      <span className="truncate font-medium">{tool.name}</span>
      {tool.detail ? <span className="truncate text-muted-foreground">{tool.detail}</span> : null}
      {onUndo && tool.ok ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleUndo();
          }}
          title="撤销"
          className="ml-auto shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <RotateCcw className="h-3 w-3" />
        </button>
      ) : tool.ok ? (
        <Check className="ml-auto h-3 w-3 shrink-0 text-emerald-600" />
      ) : (
        <X className="ml-auto h-3 w-3 shrink-0 text-red-500" />
      )}
    </div>
  );
}

export function CopilotTranscript({
  messages,
  loading,
  error,
  mode,
  onPickAction,
  workflowRef,
}: {
  messages: CopilotMsg[];
  loading: boolean;
  error: string;
  mode: string;
  onPickAction: (text: string) => void;
  workflowRef?: MutableRefObject<WorkflowHandle | null>;
}) {
  const timeline = useMemo(() => toTimeline(messages), [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-col gap-3 py-6">
        <p className="text-sm text-muted-foreground">Ask / Agent · 上会话 · 下工具</p>
        <h2 className="text-base font-medium text-foreground">需要我为你做些什么？</h2>
        <div className="flex flex-col gap-1">
          {quickActions.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => onPickAction('请帮我' + a)}
              className="rounded-md border border-border px-2.5 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-muted"
            >
              {a}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {timeline.map((item) => {
        if (item.kind === 'tool') {
          return (
            <ToolCallRow
              key={item.id}
              tool={item.tool}
              onUndo={
                item.tool.undoable
                  ? () => {
                      const h = workflowRef?.current;
                      if (!h) return;
                      for (let j = 0; j < 3; j++) {
                        if (!h.agentUndo()) break;
                      }
                    }
                  : undefined
              }
            />
          );
        }

        const isUser = item.kind === 'user';
        const isStreaming =
          !isUser && loading && item === timeline[timeline.length - 1] && !item.content.trim();
        return (
          <div key={item.id} className="flex flex-col gap-1">
            <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {isUser ? 'You' : mode}
            </div>
            {isUser ? (
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {item.content}
              </div>
            ) : (
              <CopilotMarkdown
                content={item.content || (isStreaming || loading ? '…' : '')}
              />
            )}
          </div>
        );
      })}
      {error ? <p className="text-xs text-red-500">{error}</p> : null}
    </div>
  );
}
