import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import {
  formatToolsForSystem,
  getModeAssistantConfig,
  isCopilotMode,
  type CopilotMode,
} from './copilotAssistantStore';
import { buildOpenAIToolsForMode, getCanvasToolGuideText } from './copilotCanvasTools';
import { buildSkillSystemAppendix } from './copilotSkillMention';
import { getPrimaryTextChannel } from './settingsStore';
import {
  chatCompletionStream,
  type ChatMessage,
  type ChatToolCall,
} from './llm/openaiChat';
import { recordTextUsage } from './usageStore';
import { createLogger } from './logger';
import type { WorkflowHandle } from '../components/editor/CanvasFlowCore';
import type { AskUserAnswer, AskUserRequest } from './askUserTypes';
import { executeCopilotToolCall } from './executeCopilotToolCall';

export type { AskUserAnswer, AskUserOption, AskUserRequest } from './askUserTypes';

const log = createLogger('CopilotChat');
const MAX_TOOL_ROUNDS = 8;

export type ToolCallRecord = {
  name: string;
  ok: boolean;
  detail?: string;
  undoable?: boolean;
};

export type CopilotMsg = {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCall?: ToolCallRecord;
  toolNames?: string[];
  toolCalls?: ToolCallRecord[];
};

export type SendOptions = {
  mode?: string;
  workflow?: WorkflowHandle | null;
};

function uid(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export type CopilotSendCtx = {
  model: string;
  loading: boolean;
  messagesRef: MutableRefObject<CopilotMsg[]>;
  streamBuf: MutableRefObject<string>;
  rafRef: MutableRefObject<number>;
  abortRef: MutableRefObject<AbortController | null>;
  setMessages: Dispatch<SetStateAction<CopilotMsg[]>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string>>;
  /** 弹出选择题并等待用户；未提供时 ask_user 会失败回退 */
  onAskUser?: (req: AskUserRequest) => Promise<AskUserAnswer>;
  /** 压缩对话上下文；未提供时 summarize_context 会失败回退 */
  onSummarize?: (req: {
    keepLast: number;
    note?: string;
  }) => Promise<{ summary: string; kept: number; removed: number }>;
};

export async function runCopilotSend(
  textRaw: string,
  options: SendOptions | undefined,
  ctx: CopilotSendCtx,
): Promise<boolean> {
  const text = textRaw.trim();
  if (!text || ctx.loading) return false;

  const channel = getPrimaryTextChannel();
  if (!channel?.apiKey?.trim() || !channel?.apiAddr?.trim()) {
    const msg = '未配置文本渠道：请在设置 → 文本模型中填写 API 地址与 Key';
    ctx.setError(msg);
    log.warn('send', 'no channel');
    return false;
  }

  const modeRaw = options?.mode ?? 'Ask';
  // 旧会话可能残留 Plan，统一落到 Ask
  const mode: CopilotMode = isCopilotMode(modeRaw)
    ? modeRaw
    : modeRaw === 'Agent'
      ? 'Agent'
      : 'Ask';
  const modeCfg = getModeAssistantConfig(mode);
  const tools = buildOpenAIToolsForMode(mode, modeCfg.tools);
  const systemContent =
    modeCfg.systemPrompt.trim() +
    formatToolsForSystem(modeCfg.tools) +
    getCanvasToolGuideText(mode) +
    buildSkillSystemAppendix(text);

  const userMsg: CopilotMsg = { id: uid(), role: 'user', content: text };
  ctx.streamBuf.current = '';
  ctx.setError('');
  ctx.setMessages((prev) => [...prev, userMsg]);
  ctx.setLoading(true);

  ctx.abortRef.current?.abort();
  const ac = new AbortController();
  ctx.abortRef.current = ac;

  const apiMessages: ChatMessage[] = [
    { role: 'system', content: systemContent },
    ...ctx.messagesRef.current
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .filter((m) => m.content.trim())
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user', content: text },
  ];

  const workflow = options?.workflow ?? null;
  const allToolNames: string[] = [];
  let totalTokens = 0;
  let streamingAssistantId: string | null = null;
  /** ask_user 中途落盘后防止 assistant 文本重复写入 */
  let assistantTextCommitted = false;

  const ensureStreamingAssistant = (): string => {
    if (streamingAssistantId) return streamingAssistantId;
    const id = uid();
    streamingAssistantId = id;
    ctx.setMessages((prev) => [...prev, { id, role: 'assistant', content: '' }]);
    return id;
  };

  const flushAssistant = (id: string, full: string) => {
    if (ctx.rafRef.current) cancelAnimationFrame(ctx.rafRef.current);
    ctx.rafRef.current = requestAnimationFrame(() => {
      ctx.rafRef.current = 0;
      ctx.setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, content: full } : m)));
    });
  };

  const commitRoundWithTools = (roundContent: string, toolRows: CopilotMsg[]) => {
    ctx.setMessages((prev) => {
      let next = prev;
      if (!assistantTextCommitted) {
        if (streamingAssistantId) {
          const aid = streamingAssistantId;
          if (roundContent.trim()) {
            next = next.map((m) => (m.id === aid ? { ...m, content: roundContent } : m));
          } else {
            next = next.filter((m) => m.id !== aid);
          }
          streamingAssistantId = null;
        } else if (roundContent.trim()) {
          next = [...next, { id: uid(), role: 'assistant', content: roundContent }];
        }
        assistantTextCommitted = true;
      }
      return toolRows.length ? [...next, ...toolRows] : next;
    });
  };

  log.info('send', 'start', { model: ctx.model, mode, tools: tools.length, msgCount: apiMessages.length, hasWorkflow: Boolean(workflow) });

  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      if (ac.signal.aborted) break;
      assistantTextCommitted = false;

      let roundBuf = '';
      const res = await chatCompletionStream({
        baseUrl: channel.apiAddr,
        apiKey: channel.apiKey,
        model: ctx.model,
        messages: apiMessages,
        temperature: mode === 'Ask' ? 0.5 : 0.35,
        tools: tools.length ? tools : undefined,
        tool_choice: tools.length ? 'auto' : undefined,
        signal: ac.signal,
        onDelta: (delta) => {
          if (ac.signal.aborted || ctx.abortRef.current !== ac) return;
          roundBuf += delta;
          ctx.streamBuf.current = roundBuf;
          flushAssistant(ensureStreamingAssistant(), roundBuf);
        },
      });

      if (ac.signal.aborted || ctx.abortRef.current !== ac) return true;

      const roundContent = res.content || roundBuf || '';
      ctx.streamBuf.current = roundContent;
      if (res.usage?.total_tokens) totalTokens += res.usage.total_tokens;

      const calls = res.tool_calls?.filter((c) => c.function?.name) || [];
      if (!calls.length) {
        const aid = streamingAssistantId ?? ensureStreamingAssistant();
        const display = roundContent || '（无文本回复）';
        if (ctx.rafRef.current) {
          cancelAnimationFrame(ctx.rafRef.current);
          ctx.rafRef.current = 0;
        }
        ctx.setMessages((prev) => prev.map((m) => (m.id === aid ? { ...m, content: display } : m)));
        streamingAssistantId = null;
        break;
      }

      apiMessages.push({
        role: 'assistant',
        content: roundContent || null,
        tool_calls: calls.map((c) => ({
          id: c.id || `call_${uid()}`,
          type: 'function' as const,
          function: {
            name: c.function.name,
            arguments: c.function.arguments || '{}',
          },
        })),
      });

      const toolRows: CopilotMsg[] = [];
      for (const call of calls as ChatToolCall[]) {
        const name = call.function.name;
        allToolNames.push(name);
        const exec = await executeCopilotToolCall({
          name,
          argsRaw: call.function.arguments || '{}',
          workflow,
          onAskUser: ctx.onAskUser,
          onSummarize: ctx.onSummarize,
          round,
          uid,
          isAborted: () => ac.signal.aborted || ctx.abortRef.current !== ac,
          beforeAskUser: () => {
            if (ctx.rafRef.current) {
              cancelAnimationFrame(ctx.rafRef.current);
              ctx.rafRef.current = 0;
            }
            if (toolRows.length || roundContent.trim() || streamingAssistantId) {
              commitRoundWithTools(roundContent, toolRows);
              toolRows.length = 0;
            }
          },
        });
        if (exec.aborted) return true;
        apiMessages.push({
          role: 'tool',
          tool_call_id: call.id || `call_${uid()}`,
          name,
          content: JSON.stringify(exec.result).slice(0, 12000),
        });
        toolRows.push(exec.row);
      }

      if (ctx.rafRef.current) {
        cancelAnimationFrame(ctx.rafRef.current);
        ctx.rafRef.current = 0;
      }
      commitRoundWithTools(roundContent, toolRows);
    }

    if (ctx.rafRef.current) {
      cancelAnimationFrame(ctx.rafRef.current);
      ctx.rafRef.current = 0;
    }
    if (streamingAssistantId) {
      const aid = streamingAssistantId;
      const display = ctx.streamBuf.current || '（无文本回复）';
      ctx.setMessages((prev) => prev.map((m) => (m.id === aid ? { ...m, content: display } : m)));
    }

    ctx.setLoading(false);
    ctx.abortRef.current = null;
    const displayLen = ctx.streamBuf.current.length;
    const tokens =
      totalTokens > 0 ? totalTokens : Math.max(1, Math.ceil((text.length + displayLen) / 4));
    recordTextUsage(tokens);
    log.info('send', 'done', { model: ctx.model, mode, len: displayLen, tools: allToolNames, tokens });
    return true;
  } catch (err) {
    if ((err as Error)?.name === 'AbortError' || ac.signal.aborted) {
      ctx.setLoading(false);
      if (ctx.abortRef.current === ac) ctx.abortRef.current = null;
      log.info('send', 'aborted', { len: ctx.streamBuf.current.length });
      return true;
    }
    const msg = err instanceof Error ? err.message : String(err);
    ctx.setLoading(false);
    ctx.setError(msg);
    ctx.abortRef.current = null;
    if (streamingAssistantId) {
      const aid = streamingAssistantId;
      ctx.setMessages((prev) =>
        prev.map((m) => (m.id === aid ? { ...m, content: m.content || `（请求失败）${msg}` } : m)),
      );
    } else {
      ctx.setMessages((prev) => [
        ...prev,
        { id: uid(), role: 'assistant', content: `（请求失败）${msg}` },
      ]);
    }
    log.error('send', 'failed', { err: msg });
    return false;
  }
}
