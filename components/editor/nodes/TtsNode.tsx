'use client';

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { AudioLines, Users } from 'lucide-react';
import { Handle, Position, useFlow } from '../flow';
import { NodePanel } from './NodePanel';
import { ModelIcon } from '../settings/ModelIcon';
import { useEnhancePrompt } from './useEnhancePrompt';
import { useTtsNodeGenerate } from './useTtsNodeGenerate';
import { useAgentSubmitListener } from '../../../lib/useAgentSubmitListener';
import { useChannelModelOptions } from './useChannelModelOptions';
import { TtsNodePanel } from './TtsNodePanel';
import { TtsNodeCard } from './TtsNodeCard';
import {
  defaultSpeechVoice,
  listSpeechVoices,
} from '../../../lib/llm/openaiSpeech';
import {
  defaultCast,
  sampleAdvancedScript,
  syncCastFromScript,
  type TtsCastMember,
  type TtsMode,
} from '../../../lib/llm/ttsDialogue';

interface NodeProps {
  id: string;
  data: {
    label?: string;
    text?: string;
    model?: string;
    voice?: string;
    mode?: TtsMode;
    cast?: TtsCastMember[];
    value?: string;
    audioUrl?: string;
    status?: 'idle' | 'loading' | 'done' | 'error';
    error?: string;
    localSpoken?: boolean;
    freePersisted?: boolean;
    lineCount?: number;
  };
  selected?: boolean;
}

/** TTS 语音节点 · 普通单声 / 高级多人配音 */
export function TtsNode({ id, data, selected }: NodeProps) {
  const rf = useFlow();
  const channelModels = useChannelModelOptions('tts');
  const modelOptions = useMemo(
    () =>
      channelModels.map((m) => ({
        value: m.value,
        label: m.label,
        desc: m.desc,
        icon: <ModelIcon name={m.value} size={16} fallback={m.icon} />,
      })),
    [channelModels],
  );
  const defaultModel = modelOptions[0]?.value ?? 'browser-tts';

  const [text, setText] = useState(data.text || '');
  const [model, setModel] = useState(data.model || defaultModel);
  const [voice, setVoice] = useState(
    data.voice || defaultSpeechVoice(data.model || defaultModel),
  );
  const [mode, setMode] = useState<TtsMode>(
    data.mode === 'advanced' ? 'advanced' : 'normal',
  );
  const [cast, setCast] = useState<TtsCastMember[]>(() =>
    data.cast?.length ? data.cast : defaultCast(data.model || defaultModel),
  );
  const label = data.label || 'TTS 节点';
  const cardRef = useRef<HTMLDivElement>(null);
  const voiceOptions = useMemo(() => listSpeechVoices(model), [model]);

  useEffect(() => {
    const opts = listSpeechVoices(model);
    const values = new Set(opts.map((o) => o.value));
    const d = defaultSpeechVoice(model);
    setCast((prev) =>
      prev.map((c) => ({
        ...c,
        voice: values.has(c.voice) ? c.voice : d,
      })),
    );
  }, [model]);

  const { enhancing, enhance } = useEnhancePrompt('tts');

  const patchNode = useCallback(
    (patch: Record<string, unknown>) => {
      rf.setNodes((nds) =>
        nds.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, ...patch } } : n,
        ),
      );
    },
    [rf, id],
  );

  const persist = useCallback(
    (over: Record<string, unknown> = {}) => {
      patchNode({ text, model, voice, mode, cast, ...over });
    },
    [patchNode, text, model, voice, mode, cast],
  );

  const getGraph = useCallback(
    () => ({ nodes: rf.getNodes(), edges: rf.getEdges() }),
    [rf],
  );

  const initialUrl = data.audioUrl || data.value || '';
  const { loading, error, url, progress, onSubmit, onStop } =
    useTtsNodeGenerate({
      id,
      text,
      model,
      voice,
      mode,
      cast,
      getGraph,
      patchNode,
      initialUrl,
      initialStatus: data.status,
      initialError: data.error,
    });

  useAgentSubmitListener(id, onSubmit);

  const previewUrl = url || initialUrl;
  const statusError = error || data.error || '';

  const onEnhance = useCallback(async () => {
    if (enhancing || !text.trim()) return;
    try {
      const next = await enhance(text);
      if (!next) return;
      setText(next);
      persist({ text: next });
    } catch {
      /* ignore */
    }
  }, [enhancing, enhance, text, persist]);

  const onSyncCast = useCallback(() => {
    const next = syncCastFromScript(text, cast, model);
    setCast(next);
    persist({ cast: next });
  }, [text, cast, model, persist]);

  const onFillSample = useCallback(() => {
    const sample = sampleAdvancedScript();
    setText(sample);
    const nextCast = syncCastFromScript(sample, cast, model);
    setCast(nextCast);
    setMode('advanced');
    persist({ text: sample, cast: nextCast, mode: 'advanced' });
  }, [cast, model, persist]);

  return (
    <div className="relative group w-full h-full flex flex-col gap-2">
      <div className="absolute left-0 bottom-full pb-1.5 flex items-center gap-1.5">
        <span className="inline-flex items-center gap-1 text-[11px] text-violet-600/90 dark:text-violet-300 font-medium tracking-wide">
          <AudioLines className="size-3" />
          {label}
        </span>
        {mode === 'advanced' ? (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-600 border border-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/30 flex items-center gap-0.5">
            <Users className="size-2.5" />
            多人
          </span>
        ) : null}
      </div>

      <div className="relative w-full flex-1 min-h-0" ref={cardRef}>
        <TtsNodeCard
          label={label}
          selected={selected}
          loading={loading}
          progress={progress}
          previewUrl={previewUrl}
          statusError={statusError}
          mode={mode}
          lineCount={data.lineCount}
          freePersisted={data.freePersisted}
        />
        <Handle
          type="target"
          position={Position.Left}
          style={{ left: -6, top: '50%', transform: 'translateY(-50%)' }}
        />
        <Handle
          type="source"
          position={Position.Right}
          style={{ right: -6, top: '50%', transform: 'translateY(-50%)' }}
        />
      </div>

      <NodePanel cardRef={cardRef} selected={selected} panelW={400}>
        <TtsNodePanel
          text={text}
          model={model}
          voice={voice}
          mode={mode}
          cast={cast}
          modelOptions={modelOptions}
          defaultModel={defaultModel}
          voiceOptions={voiceOptions}
          loading={loading}
          enhancing={enhancing}
          statusError={statusError}
          onText={(v) => {
            setText(v);
            persist({ text: v });
          }}
          onMode={(m) => {
            setMode(m);
            persist({ mode: m });
          }}
          onModel={(v, nextVoice, nextCast) => {
            setModel(v);
            setVoice(nextVoice);
            setCast(nextCast);
            persist({ model: v, voice: nextVoice, cast: nextCast });
          }}
          onVoice={(v) => {
            setVoice(v);
            persist({ voice: v });
          }}
          onCast={(next) => {
            setCast(next);
            persist({ cast: next });
          }}
          onSubmit={() => void onSubmit()}
          onStop={onStop}
          onEnhance={() => void onEnhance()}
          onSyncCast={onSyncCast}
          onFillSample={onFillSample}
        />
      </NodePanel>
    </div>
  );
}
