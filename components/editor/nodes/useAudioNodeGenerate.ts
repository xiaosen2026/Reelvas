'use client';

// 音频/音乐节点生成：Suno NewAPI

import { useCallback, useEffect, useRef, useState } from 'react';
import type { FlowEdge, FlowNode } from '../flow/types';
import { getPrimaryAudioChannel } from '../../../lib/settingsStore';
import { createSunoMusic } from '../../../lib/llm/sunoMusic';
import { recordAudioCall } from '../../../lib/usageStore';
import { createLogger } from '../../../lib/logger';

const log = createLogger('useAudioNodeGenerate');

export type AudioGenerateParams = {
  id: string;
  lyrics: string;
  desc: string;
  style: string;
  title: string;
  instrumental: boolean;
  model: string;
  qty: string;
  getGraph: () => { nodes: FlowNode[]; edges: FlowEdge[] };
  patchNode: (data: Record<string, unknown>) => void;
  initialUrl?: string;
  initialStatus?: string;
  initialError?: string;
};

export function useAudioNodeGenerate(p: AudioGenerateParams) {
  const [loading, setLoading] = useState(p.initialStatus === 'loading');
  const [error, setError] = useState(p.initialError || '');
  const [url, setUrl] = useState(p.initialUrl || '');
  const abortRef = useRef<AbortController | null>(null);
  const pRef = useRef(p);
  pRef.current = p;

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const onStop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
    pRef.current.patchNode({ status: 'idle' });
  }, []);

  const onSubmit = useCallback(async () => {
    const cur = pRef.current;
    const lyrics = cur.lyrics.trim();
    const desc = cur.desc.trim();
    if (!lyrics && !desc && !cur.instrumental) {
      const msg = '请填写歌词或描述';
      setError(msg);
      cur.patchNode({ status: 'error', error: msg });
      return;
    }

    const channel = getPrimaryAudioChannel();
    if (!channel?.apiKey?.trim() || !channel?.apiAddr?.trim()) {
      const msg = '请先在设置 → 音频模型 配置 API Key 与地址';
      setError(msg);
      setLoading(false);
      cur.patchNode({ status: 'error', error: msg });
      return;
    }

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    setError('');
    cur.patchNode({
      status: 'loading',
      error: '',
      lyrics: cur.lyrics,
      desc: cur.desc,
      style: cur.style,
      title: cur.title,
      instrumental: cur.instrumental,
      model: cur.model,
      qty: cur.qty,
    });
    log.info('onSubmit', 'start', { id: cur.id, model: cur.model });

    try {
      const result = await createSunoMusic({
        apiKey: channel.apiKey,
        apiBase: channel.apiAddr,
        model: cur.model || 'suno_music',
        prompt: desc || lyrics,
        lyrics: lyrics || undefined,
        style: cur.style,
        title: cur.title,
        instrumental: cur.instrumental,
        signal: ac.signal,
      });
      setUrl(result.url);
      setLoading(false);
      cur.patchNode({
        status: 'done',
        error: '',
        audioUrl: result.url,
        value: result.url,
        taskId: result.taskId,
      });
      recordAudioCall(1);
      log.info('onSubmit', 'ok', { id: cur.id, url: result.url.slice(0, 80) });
    } catch (err) {
      if (ac.signal.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
        setLoading(false);
        cur.patchNode({ status: 'idle' });
        return;
      }
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setLoading(false);
      cur.patchNode({ status: 'error', error: msg });
      log.error('onSubmit', 'fail', { id: cur.id, msg });
    } finally {
      if (abortRef.current === ac) abortRef.current = null;
    }
  }, []);

  return { loading, error, url, onSubmit, onStop, setUrl };
}
