// OpenAI 兼容 Chat Completions 客户端（本地调试 / 任意兼容端点）
// 默认不请求云端；base 由设置渠道提供

import { createLogger } from '../logger';
import { summarizeMessages } from './chatMultimodal';

const log = createLogger('openaiChat');

/** 多模态 content 片段（OpenAI vision 兼容） */
export type ChatContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export type ChatToolCall = {
  id: string;
  type?: 'function';
  function: { name: string; arguments: string };
};

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  /** 纯文本，或含 image_url 的多模态数组；tool 角色时为工具返回 JSON 字符串 */
  content: string | ChatContentPart[] | null;
  /** assistant 发起的 tool_calls */
  tool_calls?: ChatToolCall[];
  /** tool 消息对应的 call id */
  tool_call_id?: string;
  name?: string;
}

export { attachImagesToUserMessage, summarizeMessages } from './chatMultimodal';
export type ChatToolDef = {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export interface ChatCompletionParams {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  signal?: AbortSignal;
  /** OpenAI tools；有则进入 function calling */
  tools?: ChatToolDef[];
  tool_choice?: 'auto' | 'none' | 'required' | { type: 'function'; function: { name: string } };
}

export interface ChatCompletionResult {
  content: string;
  model: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  tool_calls?: ChatToolCall[];
  finish_reason?: string | null;
}

export interface ChatCompletionStreamParams extends ChatCompletionParams {
  /** 每个 token / 片段回调（累计内容由调用方自行拼接） */
  onDelta: (delta: string) => void;
}

/** 规范化 base：去尾斜杠；若无 /v1 则补上（兼容 localhost:8317 与 .../v1） */
export function normalizeOpenAIBase(baseUrl: string): string {
  let base = baseUrl.trim().replace(/\/+$/, '');
  if (!/\/v\d+$/i.test(base)) {
    base = `${base}/v1`;
  }
  return base;
}

function maskKey(key: string): string {
  if (key.length <= 4) return '***';
  return `${key.slice(0, 2)}***${key.slice(-2)}`;
}

function buildChatBody(params: ChatCompletionParams, stream: boolean): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: params.model,
    messages: params.messages,
    temperature: params.temperature ?? 0.7,
    stream,
  };
  if (params.tools?.length) {
    body.tools = params.tools;
    body.tool_choice = params.tool_choice ?? 'auto';
  }
  return body;
}

export async function chatCompletion(params: ChatCompletionParams): Promise<ChatCompletionResult> {
  const { apiKey, model, messages, signal } = params;
  const base = normalizeOpenAIBase(params.baseUrl);
  const url = `${base}/chat/completions`;

  log.info('chatCompletion', 'request', {
    url,
    model,
    apiKey: maskKey(apiKey),
    tools: params.tools?.length ?? 0,
    ...summarizeMessages(messages),
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(buildChatBody(params, false)),
    signal,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    log.error('chatCompletion', 'http error', { status: res.status, body: body.slice(0, 500) });
    throw new Error(`LLM 请求失败 ${res.status}: ${body.slice(0, 200) || res.statusText}`);
  }

  const data = (await res.json()) as {
    model?: string;
    choices?: Array<{
      message?: {
        content?: string | null;
        tool_calls?: ChatToolCall[];
      };
      finish_reason?: string | null;
    }>;
    usage?: ChatCompletionResult['usage'];
  };

  const msg = data.choices?.[0]?.message;
  const content = msg?.content ?? '';
  const tool_calls = msg?.tool_calls?.length ? msg.tool_calls : undefined;
  log.info('chatCompletion', 'ok', {
    model: data.model ?? model,
    contentLen: typeof content === 'string' ? content.length : 0,
    toolCalls: tool_calls?.length ?? 0,
    finish: data.choices?.[0]?.finish_reason,
    usage: data.usage,
  });

  return {
    content: typeof content === 'string' ? content : '',
    model: data.model ?? model,
    usage: data.usage,
    tool_calls,
    finish_reason: data.choices?.[0]?.finish_reason,
  };
}

/**
 * OpenAI 兼容 SSE 流式 Chat Completions（stream: true）
 * 解析 `data: {...}` / `data: [DONE]`，通过 onDelta 推送 choices[0].delta.content
 */
export async function chatCompletionStream(
  params: ChatCompletionStreamParams,
): Promise<ChatCompletionResult> {
  const { apiKey, model, signal, onDelta } = params;
  const base = normalizeOpenAIBase(params.baseUrl);
  const url = `${base}/chat/completions`;

  log.info('chatCompletionStream', 'request', {
    url,
    model,
    apiKey: maskKey(apiKey),
    tools: params.tools?.length ?? 0,
    ...summarizeMessages(params.messages),
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      Accept: 'text/event-stream',
    },
    body: JSON.stringify(buildChatBody(params, true)),
    signal,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    log.error('chatCompletionStream', 'http error', { status: res.status, body: body.slice(0, 500) });
    throw new Error(`LLM 请求失败 ${res.status}: ${body.slice(0, 200) || res.statusText}`);
  }

  if (!res.body) {
    throw new Error('LLM 流式响应无 body（浏览器或代理不支持 ReadableStream）');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let content = '';
  let resolvedModel = model;
  let usage: ChatCompletionResult['usage'];
  let finish_reason: string | null | undefined;
  /** index → 累积 tool_call */
  const toolMap = new Map<number, ChatToolCall>();

  const onPart = (part: {
    delta?: string;
    model?: string;
    usage?: ChatCompletionResult['usage'];
    finish_reason?: string | null;
    tool_calls?: Array<{
      index?: number;
      id?: string;
      type?: string;
      function?: { name?: string; arguments?: string };
    }>;
  }) => {
    if (part.model) resolvedModel = part.model;
    if (part.usage) usage = part.usage;
    if (part.finish_reason) finish_reason = part.finish_reason;
    if (part.delta) {
      content += part.delta;
      onDelta(part.delta);
    }
    if (part.tool_calls?.length) {
      for (const tc of part.tool_calls) {
        const idx = typeof tc.index === 'number' ? tc.index : 0;
        const cur = toolMap.get(idx) || {
          id: '',
          type: 'function' as const,
          function: { name: '', arguments: '' },
        };
        if (tc.id) cur.id = tc.id;
        if (tc.function?.name) cur.function.name += tc.function.name;
        if (tc.function?.arguments) cur.function.arguments += tc.function.arguments;
        toolMap.set(idx, cur);
      }
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE 事件以空行分隔；兼容 \n\n 与 \r\n\r\n
      while (true) {
        const crlf = buffer.indexOf('\r\n\r\n');
        const lf = buffer.indexOf('\n\n');
        let sep = -1;
        let sepLen = 2;
        if (crlf >= 0 && (lf < 0 || crlf <= lf)) {
          sep = crlf;
          sepLen = 4;
        } else if (lf >= 0) {
          sep = lf;
          sepLen = 2;
        }
        if (sep < 0) break;

        const rawEvent = buffer.slice(0, sep);
        buffer = buffer.slice(sep + sepLen);
        if (handleSseEvent(rawEvent, onPart) === 'done') {
          break;
        }
      }
    }

    // 冲刷尾部残留
    if (buffer.trim()) {
      handleSseEvent(buffer, onPart);
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* ignore */
    }
  }

  const tool_calls =
    toolMap.size > 0
      ? [...toolMap.entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([, v]) => v)
          .filter((t) => t.function.name)
      : undefined;

  log.info('chatCompletionStream', 'ok', {
    model: resolvedModel,
    contentLen: content.length,
    toolCalls: tool_calls?.length ?? 0,
    finish: finish_reason,
    usage,
  });
  return {
    content,
    model: resolvedModel,
    usage,
    tool_calls,
    finish_reason,
  };
}

/** 处理单个 SSE 事件块；返回 'done' 表示流结束 */
function handleSseEvent(
  rawEvent: string,
  onPart: (part: {
    delta?: string;
    model?: string;
    usage?: ChatCompletionResult['usage'];
    finish_reason?: string | null;
    tool_calls?: Array<{
      index?: number;
      id?: string;
      type?: string;
      function?: { name?: string; arguments?: string };
    }>;
  }) => void,
): 'done' | 'cont' {
  const lines = rawEvent.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(':')) continue; // 注释/心跳
    if (!trimmed.startsWith('data:')) continue;
    const data = trimmed.slice(5).trim();
    if (!data) continue;
    if (data === '[DONE]') return 'done';
    try {
      const json = JSON.parse(data) as {
        model?: string;
        choices?: Array<{
          delta?: {
            content?: string | null;
            tool_calls?: Array<{
              index?: number;
              id?: string;
              type?: string;
              function?: { name?: string; arguments?: string };
            }>;
          };
          finish_reason?: string | null;
        }>;
        usage?: ChatCompletionResult['usage'];
      };
      const choice = json.choices?.[0];
      const delta = choice?.delta?.content;
      const hasDelta = typeof delta === 'string' && delta.length > 0;
      const tcs = choice?.delta?.tool_calls;
      if (hasDelta || json.model || json.usage || tcs?.length || choice?.finish_reason) {
        onPart({
          delta: hasDelta ? (delta as string) : undefined,
          model: json.model,
          usage: json.usage,
          finish_reason: choice?.finish_reason,
          tool_calls: tcs,
        });
      }
    } catch (err) {
      log.warn('chatCompletionStream', 'sse json skip', {
        err: err instanceof Error ? err.message : String(err),
        data: data.slice(0, 120),
      });
    }
  }
  return 'cont';
}

/** GET /v1/models —— 仅对用户配置的端点调用 */
export async function listModels(baseUrl: string, apiKey: string, signal?: AbortSignal): Promise<string[]> {
  const base = normalizeOpenAIBase(baseUrl);
  const url = `${base}/models`;
  log.info('listModels', 'request', { url, apiKey: maskKey(apiKey) });

  const res = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${apiKey}` },
    signal,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    log.error('listModels', 'http error', { status: res.status, body: body.slice(0, 300) });
    throw new Error(`获取模型失败 ${res.status}: ${body.slice(0, 160) || res.statusText}`);
  }

  const data = (await res.json()) as { data?: Array<{ id?: string }> };
  const ids = (data.data ?? []).map((m) => m.id).filter((id): id is string => Boolean(id));
  log.info('listModels', 'ok', { count: ids.length });
  return ids;
}
