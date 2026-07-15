'use client';

// Copilot 聊天：Ask/Agent + 真实 tool call 循环（画布读写）

import { useCallback, useEffect, useRef, useState } from 'react';
import { createLogger } from '../../lib/logger';
import {
  runCopilotSend,
  type AskUserAnswer,
  type AskUserRequest,
  type CopilotMsg,
  type SendOptions,
  type ToolCallRecord,
} from '../../lib/runCopilotSend';

export type { AskUserAnswer, AskUserRequest, CopilotMsg, SendOptions, ToolCallRecord };

const log = createLogger('CopilotChat');

export function useCopilotChat(model: string) {
  const [messages, setMessages] = useState<CopilotMsg[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [askRequest, setAskRequest] = useState<AskUserRequest | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const streamBuf = useRef('');
  const rafRef = useRef(0);
  const messagesRef = useRef<CopilotMsg[]>([]);
  const askResolverRef = useRef<((a: AskUserAnswer) => void) | null>(null);
  messagesRef.current = messages;

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    if (askResolverRef.current) {
      askResolverRef.current({
        selected_id: 'cancelled',
        selected_label: '用户停止',
        cancelled: true,
      });
      askResolverRef.current = null;
    }
    setAskRequest(null);
    setLoading(false);
    log.info('stop', 'user stop', { len: streamBuf.current.length });
  }, []);

  const loadMessages = useCallback(
    (msgs: CopilotMsg[]) => {
      stop();
      setMessages(msgs);
      setError('');
      streamBuf.current = '';
      log.info('loadMessages', 'loaded', { count: msgs.length });
    },
    [stop],
  );

  const clear = useCallback(() => {
    stop();
    setMessages([]);
    setError('');
    streamBuf.current = '';
    log.info('clear', 'session cleared');
  }, [stop]);

  const answerAskUser = useCallback((answer: AskUserAnswer) => {
    const resolve = askResolverRef.current;
    askResolverRef.current = null;
    setAskRequest(null);
    if (resolve) resolve(answer);
    log.info('answerAskUser', 'answered', {
      id: answer.selected_id,
      cancelled: Boolean(answer.cancelled),
    });
  }, []);

  const onAskUser = useCallback((req: AskUserRequest) => {
    return new Promise<AskUserAnswer>((resolve) => {
      if (askResolverRef.current) {
        askResolverRef.current({
          selected_id: 'superseded',
          selected_label: '被新的询问替换',
          cancelled: true,
        });
      }
      askResolverRef.current = resolve;
      setAskRequest(req);
    });
  }, []);

  useEffect(
    () => () => {
      abortRef.current?.abort();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (askResolverRef.current) {
        askResolverRef.current({
          selected_id: 'cancelled',
          selected_label: '会话卸载',
          cancelled: true,
        });
        askResolverRef.current = null;
      }
    },
    [],
  );

  const onSummarize = useCallback(
    async (req: { keepLast: number; note?: string }) => {
      const keep = Math.min(40, Math.max(4, req.keepLast || 8));
      const prev = messagesRef.current;
      if (prev.length <= keep) {
        return {
          summary: req.note || '上下文尚短，无需压缩',
          kept: prev.length,
          removed: 0,
        };
      }
      const head = prev.slice(0, -keep);
      const tail = prev.slice(-keep);
      const bits: string[] = [];
      for (const m of head) {
        if (m.role === 'user' && m.content.trim()) {
          bits.push(`User: ${m.content.trim().slice(0, 120)}`);
        } else if (m.role === 'assistant' && m.content.trim()) {
          bits.push(`Assistant: ${m.content.trim().slice(0, 120)}`);
        } else if (m.role === 'tool' && m.toolCall) {
          bits.push(`Tool ${m.toolCall.name}: ${m.toolCall.detail || (m.toolCall.ok ? 'ok' : 'fail')}`);
        }
      }
      const body = bits.slice(-24).join(' · ');
      const summaryText = [
        '【上下文摘要 · summarize_context】',
        req.note ? `焦点：${req.note}` : '',
        `已折叠 ${head.length} 条较早消息。`,
        body ? `要点：${body}` : '',
        '请基于摘要与后续原文继续，勿重复已完成的工具调用。',
      ]
        .filter(Boolean)
        .join('\n');
      const summaryMsg: CopilotMsg = {
        id: `sum_${Date.now().toString(36)}`,
        role: 'assistant',
        content: summaryText,
      };
      const next = [summaryMsg, ...tail];
      setMessages(next);
      messagesRef.current = next;
      log.info('onSummarize', 'compacted', {
        before: prev.length,
        after: next.length,
        removed: head.length,
      });
      return {
        summary: summaryText.slice(0, 500),
        kept: tail.length + 1,
        removed: head.length,
      };
    },
    [],
  );

  const send = useCallback(
    async (textRaw: string, options?: SendOptions) =>
      runCopilotSend(textRaw, options, {
        model,
        loading,
        messagesRef,
        streamBuf,
        rafRef,
        abortRef,
        setMessages,
        setLoading,
        setError,
        onAskUser,
        onSummarize,
      }),
    [loading, model, onAskUser, onSummarize],
  );

  return {
    messages,
    loading,
    error,
    send,
    stop,
    clear,
    loadMessages,
    askRequest,
    answerAskUser,
  };
}
