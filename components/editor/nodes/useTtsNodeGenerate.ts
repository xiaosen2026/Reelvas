'use client';

// TTS 节点生成：普通单声 / 高级多人配音拼接

import { useCallback, useEffect, useRef, useState } from 'react';
import type { FlowEdge, FlowNode } from '../flow/types';
import { getPrimaryTtsChannel } from '../../../lib/settingsStore';
import {
  createSpeech,
  defaultSpeechVoice,
  isBrowserTtsModel,
} from '../../../lib/llm/openaiSpeech';
import {
  resolveDialogueLines,
  type TtsCastMember,
  type TtsMode,
} from '../../../lib/llm/ttsDialogue';
import {
  blobFromObjectUrl,
  concatAudioBlobs,
} from '../../../lib/llm/ttsConcatAudio';
import { recordAudioCall } from '../../../lib/usageStore';
import { createLogger } from '../../../lib/logger';

const log = createLogger('useTtsNodeGenerate');

export type TtsGenerateParams = {
  id: string;
  text: string;
  model: string;
  voice: string;
  mode: TtsMode;
  cast: TtsCastMember[];
  getGraph: () => { nodes: FlowNode[]; edges: FlowEdge[] };
  patchNode: (data: Record<string, unknown>) => void;
  initialUrl?: string;
  initialStatus?: string;
  initialError?: string;
};

export function useTtsNodeGenerate(p: TtsGenerateParams) {
  const [loading, setLoading] = useState(p.initialStatus === 'loading');
  const [error, setError] = useState(p.initialError || '');
  const [url, setUrl] = useState(p.initialUrl || '');
  const [progress, setProgress] = useState('');
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
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setLoading(false);
    setProgress('');
    pRef.current.patchNode({ status: 'idle' });
  }, []);

  const onSubmit = useCallback(async () => {
    const cur = pRef.current;
    const text = cur.text.trim();
    if (!text) {
      const msg = '请输入要朗读的文本';
      setError(msg);
      cur.patchNode({ status: 'error', error: msg });
      return;
    }

    const model = cur.model || 'browser-tts';
    const freeLocal = isBrowserTtsModel(model);
    const channel = getPrimaryTtsChannel();
    if (!freeLocal && (!channel?.apiKey?.trim() || !channel?.apiAddr?.trim())) {
      const msg =
        '请先在设置 → TTS 模型 配置 API Key，或改用 browser-tts（免费本地）';
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
    setProgress('');
    cur.patchNode({
      status: 'loading',
      error: '',
      text: cur.text,
      model: cur.model,
      voice: cur.voice,
      mode: cur.mode,
      cast: cur.cast,
    });

    const mode: TtsMode = cur.mode === 'advanced' ? 'advanced' : 'normal';
    log.info('onSubmit', 'start', {
      id: cur.id,
      model,
      voice: cur.voice,
      freeLocal,
      mode,
    });

    try {
      if (mode === 'normal') {
        const result = await createSpeech({
          apiKey: channel?.apiKey || '',
          apiBase: channel?.apiAddr || '',
          model,
          input: text,
          voice: cur.voice || defaultSpeechVoice(model),
          signal: ac.signal,
        });
        setUrl(result.url);
        setLoading(false);
        setProgress('');
        const persisted = Boolean(result.persisted);
        cur.patchNode({
          status: 'done',
          error: '',
          audioUrl: result.url,
          value: result.url,
          localSpoken: Boolean(result.localSpoken),
          freePersisted: freeLocal && persisted,
          lineCount: 1,
        });
        if (!freeLocal) recordAudioCall(1);
        log.info('onSubmit', 'ok', { id: cur.id, freeLocal, persisted, mode });
        return;
      }

      const lines = resolveDialogueLines({
        script: text,
        cast: cur.cast || [],
        model,
        defaultVoice: cur.voice || defaultSpeechVoice(model),
      });
      if (!lines.length) {
        throw new Error(
          '高级模式未解析到台词，请用 @角色名[台词内容]（选中文本后按 @）',
        );
      }

      const blobs: Blob[] = [];
      for (let i = 0; i < lines.length; i++) {
        if (ac.signal.aborted) throw new DOMException('Aborted', 'AbortError');
        const line = lines[i];
        setProgress((i + 1) + '/' + lines.length + ' ' + line.speaker);
        log.info('onSubmit', 'line', {
          i,
          speaker: line.speaker,
          voice: line.voice,
          chars: line.text.length,
        });
        const result = await createSpeech({
          apiKey: channel?.apiKey || '',
          apiBase: channel?.apiAddr || '',
          model,
          input: line.text,
          voice: line.voice || defaultSpeechVoice(model),
          signal: ac.signal,
        });
        const blob = await blobFromObjectUrl(result.url, ac.signal);
        blobs.push(blob);
        if (result.url.startsWith('blob:')) {
          try {
            URL.revokeObjectURL(result.url);
          } catch {
            /* ignore */
          }
        }
      }

      const merged = await concatAudioBlobs(blobs);
      setUrl(merged.url);
      setLoading(false);
      setProgress('');
      cur.patchNode({
        status: 'done',
        error: '',
        audioUrl: merged.url,
        value: merged.url,
        localSpoken: false,
        freePersisted: freeLocal,
        lineCount: lines.length,
        speakers: [...new Set(lines.map((l) => l.speaker))],
      });
      if (!freeLocal) recordAudioCall(lines.length);
      log.info('onSubmit', 'ok multi', {
        id: cur.id,
        lines: lines.length,
        bytes: merged.bytes,
      });
    } catch (err) {
      if (
        ac.signal.aborted ||
        (err instanceof DOMException && err.name === 'AbortError')
      ) {
        setLoading(false);
        setProgress('');
        cur.patchNode({ status: 'idle' });
        return;
      }
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setLoading(false);
      setProgress('');
      cur.patchNode({ status: 'error', error: msg });
      log.error('onSubmit', 'fail', { id: cur.id, msg });
    } finally {
      if (abortRef.current === ac) abortRef.current = null;
    }
  }, []);

  return { loading, error, url, progress, onSubmit, onStop, setUrl };
}
