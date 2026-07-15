'use client';

import { useState, useRef, useCallback, useMemo } from 'react';
import { Music, Loader2 } from 'lucide-react';
import { Handle, Position, useFlow } from '../flow';
import { ModelIcon } from '../settings/ModelIcon';
import { useEnhancePrompt } from './useEnhancePrompt';
import { useAudioNodeGenerate } from './useAudioNodeGenerate';
import { useChannelModelOptions } from './useChannelModelOptions';
import { AudioNodePanel } from './AudioNodePanel';
import { useAgentSubmitListener } from '../../../lib/useAgentSubmitListener';

interface NodeProps {
  id: string;
  data: {
    label?: string;
    lyrics?: string;
    desc?: string;
    style?: string;
    title?: string;
    instrumental?: boolean;
    model?: string;
    qty?: string;
    value?: string;
    audioUrl?: string;
    status?: 'idle' | 'loading' | 'done' | 'error';
    error?: string;
  };
  selected?: boolean;
}

/** 音频/音乐节点（Suno），与 TTS 节点分离 */
export function AudioNode({ id, data, selected }: NodeProps) {
  const rf = useFlow();
  const channelModels = useChannelModelOptions('audio');
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
  const defaultModel = modelOptions[0]?.value ?? 'suno_music';

  const [lyrics, setLyrics] = useState(data.lyrics || '');
  const [desc, setDesc] = useState(data.desc || '');
  const [style, setStyle] = useState(data.style || '');
  const [title, setTitle] = useState(data.title || '');
  const [instrumental, setInstrumental] = useState(Boolean(data.instrumental));
  const [model, setModel] = useState(data.model || defaultModel);
  const [qty, setQty] = useState(data.qty || '1x');
  const label = data.label || '音频节点';
  const cardRef = useRef<HTMLDivElement>(null);

  const { enhancing, enhance } = useEnhancePrompt('audio');

  const patchNode = useCallback(
    (patch: Record<string, unknown>) => {
      rf.setNodes((nds) =>
        nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)),
      );
    },
    [rf, id],
  );

  const persist = useCallback(
    (over: Record<string, unknown> = {}) => {
      patchNode({
        lyrics,
        desc,
        style,
        title,
        instrumental,
        model,
        qty,
        ...over,
      });
    },
    [patchNode, lyrics, desc, style, title, instrumental, model, qty],
  );

  const getGraph = useCallback(
    () => ({ nodes: rf.getNodes(), edges: rf.getEdges() }),
    [rf],
  );

  const initialUrl = data.audioUrl || data.value || '';
  const { loading, error, url, onSubmit, onStop } = useAudioNodeGenerate({
    id,
    lyrics,
    desc,
    style,
    title,
    instrumental,
    model,
    qty,
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
    if (enhancing) return;
    const source = lyrics.trim() ? lyrics : desc;
    if (!source.trim()) return;
    try {
      const next = await enhance(source);
      if (!next) return;
      if (lyrics.trim()) {
        setLyrics(next);
        persist({ lyrics: next });
      } else {
        setDesc(next);
        persist({ desc: next });
      }
    } catch {
      /* 渠道未配置等 */
    }
  }, [enhancing, enhance, lyrics, desc, persist]);

  return (
    <div className="relative group w-full h-full flex flex-col gap-2">
      <div className="absolute left-0 bottom-full pb-1.5 flex items-center gap-1.5">
        <span className="text-[11px] text-muted-foreground font-medium tracking-wide">{label}</span>
      </div>

      <div className="relative w-full flex-1 min-h-0" ref={cardRef}>
        <div
          className={`bg-card border rounded-xl w-full h-full overflow-hidden flex items-center justify-center transition-[box-shadow,border-color] duration-200 cursor-move ${
            selected ? 'ring-2 ring-zinc-500' : 'border-border/80'
          }`}
        >
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground px-3">
              <Loader2 className="size-4 animate-spin" />
              <span className="text-[11px]">生成中…</span>
            </div>
          ) : previewUrl ? (
            <div className="flex items-center gap-2 w-full px-2.5 py-1.5">
              <Music className="size-4 shrink-0 text-muted-foreground" />
              <audio controls src={previewUrl} className="w-full h-8 min-w-0" />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1.5 px-3 text-center">
              <div className="flex items-center justify-center size-12 rounded-2xl bg-muted/50">
                <Music className="size-6 text-muted-foreground" />
              </div>
              {statusError ? (
                <p className="text-[10px] text-red-500 line-clamp-3 max-w-[90%]">{statusError}</p>
              ) : null}
            </div>
          )}
        </div>
        <Handle type="target" position={Position.Left} style={{ left: -6, top: '50%', transform: 'translateY(-50%)' }} />
        <Handle type="source" position={Position.Right} style={{ right: -6, top: '50%', transform: 'translateY(-50%)' }} />
      </div>

      <AudioNodePanel
        cardRef={cardRef}
        selected={selected}
        loading={loading}
        onStop={onStop}
        onSubmit={onSubmit}
        lyrics={lyrics}
        onLyricsChange={(v) => {
          setLyrics(v);
          persist({ lyrics: v });
        }}
        desc={desc}
        onDescChange={(v) => {
          setDesc(v);
          persist({ desc: v });
        }}
        style={style}
        onStyleChange={(v) => {
          setStyle(v);
          persist({ style: v });
        }}
        title={title}
        onTitleChange={(v) => {
          setTitle(v);
          persist({ title: v });
        }}
        instrumental={instrumental}
        onInstrumentalChange={(v) => {
          setInstrumental(v);
          persist({ instrumental: v });
        }}
        enhancing={enhancing}
        onEnhance={onEnhance}
        statusError={statusError}
        model={model}
        modelOptions={modelOptions}
        defaultModel={defaultModel}
        onModelChange={(v) => {
          setModel(v);
          persist({ model: v });
        }}
        qty={qty}
        onQtyChange={(v) => {
          setQty(v);
          persist({ qty: v });
        }}
      />
    </div>
  );
}
