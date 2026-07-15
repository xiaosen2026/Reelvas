import { useCallback, useEffect, useRef, useState } from 'react';
import { getPrimaryTextChannel } from '../../../lib/settingsStore';
import { buildChatMessages } from '../../../lib/recipePresets';
import {
  attachImagesToUserMessage,
  chatCompletionStream,
  type ChatMessage,
} from '../../../lib/llm/openaiChat';
import { recordTextUsage } from '../../../lib/usageStore';
import { createLogger } from '../../../lib/logger';
import {
  collectUpstreamInputs,
  mergePromptWithUpstream,
} from './collectUpstream';
import type { FlowEdge, FlowNode } from '../flow/types';
import {
  THINKING_CYCLE,
  THINKING_HINT,
  THINKING_LABEL,
  THINKING_TEMP,
  type ThinkingLevel,
} from './textThinking';

export type { ThinkingLevel };
export { THINKING_CYCLE, THINKING_LABEL };

const log = createLogger('TextNode');

function systemText(content: ChatMessage['content']): string {
  if (typeof content === 'string') return content;
  if (!content) return '';
  return content.map((p) => (p.type === 'text' ? p.text : '')).join('\n');
}

function withThinkingMessages(messages: ChatMessage[], thinking: ThinkingLevel): ChatMessage[] {
  const hint = THINKING_HINT[thinking];
  if (!hint) return messages;
  const next = messages.map((m) => ({ ...m }));
  if (next[0]?.role === 'system') {
    next[0] = { role: 'system', content: `${systemText(next[0].content)}\n\n${hint}` };
  } else {
    next.unshift({ role: 'system', content: hint });
  }
  return next;
}

type PatchFn = (patch: Record<string, unknown>) => void;
type MetaFn = () => { recipeId: string; recipeTitle: string };

export function useTextNodeGenerate(opts: {
  id: string;
  prompt: string;
  model: string;
  recipeId: string;
  thinking: ThinkingLevel;
  recipeMeta: MetaFn;
  patchNode: PatchFn;
  initialValue?: string;
  initialStatus?: string;
  initialError?: string;
  systemOverride?: string | null;
  buildUserContent?: (prompt: string) => string;
  getGraph?: () => { nodes: FlowNode[]; edges: FlowEdge[] };
  getImageSrcs?: () => string[];
}) {
  const {
    id,
    prompt,
    model,
    recipeId,
    thinking,
    recipeMeta,
    patchNode,
    systemOverride,
    buildUserContent,
    getGraph,
    getImageSrcs,
  } = opts;
  const [loading, setLoading] = useState(opts.initialStatus === 'loading');
  const [error, setError] = useState(opts.initialError || '');
  const [result, setResult] = useState(opts.initialValue || '');
  const abortRef = useRef<AbortController | null>(null);
  const resultRef = useRef(opts.initialValue || '');
  const rafRef = useRef(0);
  const pendingPatchRef = useRef('');

  const onStop = useCallback(() => {
    if (!abortRef.current && !loading) return;
    abortRef.current?.abort();
    abortRef.current = null;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    const partial = resultRef.current;
    setLoading(false);
    setResult(partial);
    patchNode({
      prompt,
      model,
      thinking,
      ...recipeMeta(),
      status: partial ? 'done' : 'idle',
      error: '',
      value: partial,
    });
    log.info('onStop', 'user stop', { id, len: partial.length });
  }, [loading, patchNode, prompt, model, thinking, recipeMeta, id]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  const onSubmit = useCallback(async () => {
    const localText = prompt.trim();
    if (!localText || loading) return;
    const channel = getPrimaryTextChannel();
    if (!channel?.apiKey?.trim() || !channel?.apiAddr?.trim()) {
      const msg = '未配置文本渠道：请在设置 → 文本模型中填写 API 地址与 Key';
      setError(msg);
      setResult('');
      resultRef.current = '';
      patchNode({ prompt, model, thinking, status: 'error', error: msg });
      return;
    }

    let upstreamTexts: string[] = [];
    let imageSrcs: string[] = [];
    if (getGraph) {
      const g = getGraph();
      const up = collectUpstreamInputs(id, g.nodes, g.edges);
      upstreamTexts = up.texts;
      imageSrcs = up.imageSrcs;
    }
    if (getImageSrcs) imageSrcs = getImageSrcs();
    // Script 等自带 buildUserContent 时不再二次合并上游文本
    const baseText = buildUserContent
      ? buildUserContent(localText)
      : mergePromptWithUpstream(localText, upstreamTexts);

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    resultRef.current = '';
    pendingPatchRef.current = '';
    setLoading(true);
    setError('');
    setResult('');
    const meta = recipeMeta();
    const temperature = THINKING_TEMP[thinking] ?? 0.7;
    patchNode({ prompt, model, thinking, ...meta, status: 'loading', error: '', value: '' });
    log.info('onSubmit', 'stream generate', {
      id,
      model,
      thinking,
      temperature,
      recipeId: meta.recipeId || 'none',
      upstreamTexts: upstreamTexts.length,
      images: imageSrcs.length,
    });

    const flushUi = (full: string) => {
      setResult(full);
      pendingPatchRef.current = full;
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = 0;
          patchNode({
            prompt,
            model,
            thinking,
            ...meta,
            value: pendingPatchRef.current,
            status: 'loading',
            error: '',
          });
        });
      }
    };

    try {
      let messages: ChatMessage[];
      if (systemOverride != null) {
        messages = [];
        if (systemOverride.trim()) messages.push({ role: 'system', content: systemOverride.trim() });
        messages.push({ role: 'user', content: baseText });
      } else {
        messages = buildChatMessages(baseText, recipeId);
      }
      messages = withThinkingMessages(messages, thinking);
      messages = attachImagesToUserMessage(messages, imageSrcs);
      const res = await chatCompletionStream({
        baseUrl: channel.apiAddr,
        apiKey: channel.apiKey,
        model,
        messages,
        temperature,
        signal: ac.signal,
        onDelta: (delta) => {
          if (ac.signal.aborted || abortRef.current !== ac) return;
          resultRef.current += delta;
          flushUi(resultRef.current);
        },
      });

      if (ac.signal.aborted || abortRef.current !== ac) return;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
      const finalText = res.content || resultRef.current;
      resultRef.current = finalText;
      setLoading(false);
      setResult(finalText);
      abortRef.current = null;
      patchNode({ prompt, model, thinking, ...meta, value: finalText, status: 'done', error: '' });
      const apiTok = res.usage?.total_tokens;
      const tokens =
        typeof apiTok === 'number' && apiTok > 0
          ? apiTok
          : Math.max(1, Math.ceil((baseText.length + finalText.length) / 4));
      recordTextUsage(tokens);
      log.info('onSubmit', 'stream done', {
        id,
        len: finalText.length,
        tokens,
        usage: res.usage,
        thinking,
        images: imageSrcs.length,
      });
    } catch (err) {
      if ((err as Error)?.name === 'AbortError' || ac.signal.aborted) {
        setLoading(false);
        if (abortRef.current === ac) abortRef.current = null;
        const partial = resultRef.current;
        setResult(partial);
        patchNode({
          prompt,
          model,
          thinking,
          ...meta,
          status: partial ? 'done' : 'idle',
          error: '',
          value: partial,
        });
        log.info('onSubmit', 'aborted', { id, len: partial.length });
        return;
      }
      const msg = err instanceof Error ? err.message : String(err);
      setLoading(false);
      setError(msg);
      abortRef.current = null;
      patchNode({
        prompt,
        model,
        thinking,
        ...meta,
        status: 'error',
        error: msg,
        value: resultRef.current,
      });
      log.error('onSubmit', 'failed', { id, err: msg });
    }
  }, [
    prompt,
    model,
    recipeId,
    thinking,
    recipeMeta,
    patchNode,
    loading,
    id,
    systemOverride,
    buildUserContent,
    getGraph,
    getImageSrcs,
  ]);

  const updateResult = useCallback(
    (text: string) => {
      resultRef.current = text;
      setResult(text);
      log.debug('updateResult', 'manual edit', { id, len: text.length });
    },
    [id],
  );

  return { loading, error, result, onSubmit, onStop, updateResult };
}
