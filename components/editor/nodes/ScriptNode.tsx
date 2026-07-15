'use client';

// 创建脚本：创造/修改双模式
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, ScrollText } from 'lucide-react';
import { Handle, Position, useFlow } from '../flow';
import { ModelIcon } from '../settings/ModelIcon';
import { listTextModelOptions, subscribeChannels } from '../../../lib/settingsStore';
import { useTextNodeGenerate, THINKING_CYCLE, type ThinkingLevel } from './useTextNodeGenerate';
import { TextResultView } from './TextResultView';
import { TextNodeToolbar } from './TextNodeToolbar';
import { TextFullscreen } from './TextFullscreen';
import { collectUpstreamInputs } from './collectUpstream';
import { useUpstreamImages } from './useUpstreamImages';
import {
  buildScriptUserMessage,
  hasScriptReviseBase,
  parseScriptMode,
  scriptSystemForMode,
  type ScriptWorkMode,
} from './scriptPrompt';
import { ScriptNodePanel } from './ScriptNodePanel';
import { createLogger } from '@/lib/logger';

const log = createLogger('ScriptNode');

function parseThinking(raw: unknown): ThinkingLevel {
  return raw === 'low' || raw === 'medium' || raw === 'high' || raw === 'off' ? raw : 'medium';
}

function modeMeta(mode: ScriptWorkMode) {
  const r = mode === 'revise';
  return {
    recipeId: r ? 'script-storyboard-revise' : 'script-storyboard-one-shot',
    recipeTitle: r ? '四栏故事板修改' : '四栏故事板一键',
    scriptMode: mode,
  };
}

interface NodeProps {
  id: string;
  data: Record<string, any>;
  selected?: boolean;
}

export function ScriptNode({ id, data, selected }: NodeProps) {
  const rf = useFlow();
  const buildModelOptions = useCallback(
    () =>
      listTextModelOptions().map((m) => ({
        value: m.value,
        label: m.label,
        desc: m.desc,
        icon: <ModelIcon name={m.value} size={16} fallback={m.icon} />,
      })),
    [],
  );

  const [modelOptions, setModelOptions] = useState(buildModelOptions);
  const defaultModel = modelOptions[0]?.value ?? 'grok-4.5';
  useEffect(() => subscribeChannels((kind) => {
    if (kind !== 'text') return;
    const next = buildModelOptions();
    setModelOptions(next);
    setModel((cur: string) => (next.some((m) => m.value === cur) ? cur : next[0]?.value ?? 'grok-4.5'));
  }), [buildModelOptions]);

  const [prompt, setPrompt] = useState(data.prompt || '');
  const [model, setModel] = useState(data.model || defaultModel);
  const [thinking, setThinking] = useState<ThinkingLevel>(() => parseThinking(data.thinking));
  const [mode, setMode] = useState<ScriptWorkMode>(() => parseScriptMode(data.scriptMode));
  const [editing, setEditing] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const label = data.label || '创建脚本';
  const cardRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const reviseBaseRef = useRef(String(data.value || ''));
  const recipeMeta = useCallback(() => modeMeta(mode), [mode]);
  const patchNode = useCallback(
    (patch: Record<string, unknown>) => {
      rf.setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)));
    },
    [rf, id],
  );

  const cycleThinking = useCallback(() => {
    setThinking((cur) => {
      const next = THINKING_CYCLE[(THINKING_CYCLE.indexOf(cur) + 1) % THINKING_CYCLE.length];
      patchNode({ thinking: next, prompt, model, ...modeMeta(mode) });
      return next;
    });
  }, [patchNode, prompt, model, mode]);

  const onModeChange = useCallback((next: ScriptWorkMode) => {
    if (next === mode) return;
    setMode(next);
    patchNode({ prompt, model, thinking, ...modeMeta(next) });
    log.info('onModeChange', next, { id });
  }, [mode, patchNode, prompt, model, thinking, id]);

  const buildUserContent = useCallback(
    (idea: string) => {
      const up = collectUpstreamInputs(id, rf.getNodes(), rf.getEdges()).texts;
      return buildScriptUserMessage(idea, up, { mode, baseDraft: reviseBaseRef.current });
    },
    [id, rf, mode],
  );

  const upImages = useUpstreamImages(id);
  const imageSrcsRef = useRef(upImages.imageSrcs);
  imageSrcsRef.current = upImages.imageSrcs;
  const getImageSrcs = useCallback(() => imageSrcsRef.current, []);
  const localImageSet = useMemo(() => new Set(upImages.local), [upImages.local]);

  const { loading, error, result, onSubmit, onStop, updateResult } = useTextNodeGenerate({
    id,
    prompt,
    model,
    recipeId: 'none',
    thinking,
    recipeMeta,
    patchNode,
    getImageSrcs,
    initialValue: data.value,
    initialStatus: data.status,
    initialError: data.error,
    systemOverride: scriptSystemForMode(mode),
    buildUserContent,
  });

  const persistResult = useCallback(
    (text: string) => {
      updateResult(text);
      if (text.trim()) reviseBaseRef.current = text;
      patchNode({ value: text, status: text ? 'done' : 'idle', error: '' });
      log.info('persistResult', 'ok', { id, len: text.length });
    },
    [updateResult, patchNode, id],
  );

  const onStartEdit = useCallback(() => {
    if (!loading && result) setEditing(true);
  }, [loading, result]);

  const onResultChange = useCallback(
    (v: string, persist = false) => {
      updateResult(v);
      if (v.trim()) reviseBaseRef.current = v;
      if (persist) patchNode({ value: v, status: v ? 'done' : 'idle', error: '' });
    },
    [updateResult, patchNode],
  );

  const onModelChange = useCallback((v: string) => {
    setModel(v);
    patchNode({ model: v, prompt, thinking, ...modeMeta(mode) });
  }, [patchNode, prompt, thinking, mode]);

  const onPromptChange = useCallback((v: string) => {
    setPrompt(v);
    patchNode({ prompt: v, model, thinking, ...modeMeta(mode) });
  }, [patchNode, model, thinking, mode]);

  const onGenerate = useCallback(() => {
    if (loading) {
      onStop();
      return;
    }
    if (mode === 'revise') {
      const up = collectUpstreamInputs(id, rf.getNodes(), rf.getEdges()).texts;
      const base = (result || reviseBaseRef.current || '').trim();
      if (!hasScriptReviseBase(base, up)) {
        patchNode({
          status: 'error',
          error: '修改模式需要节点已有结果，或从上游接入可修订文本',
          scriptMode: mode,
        });
        log.warn('onGenerate', 'revise without base', { id });
        return;
      }
      reviseBaseRef.current = base || reviseBaseRef.current;
    } else if (result.trim()) {
      reviseBaseRef.current = result;
    }
    void onSubmit();
  }, [loading, onStop, mode, id, rf, result, patchNode, onSubmit]);

  const isRevise = mode === 'revise';
  const cardCls = `bg-card border rounded-2xl w-full h-full overflow-hidden flex flex-col transition-[box-shadow,border-color] duration-200 cursor-move ${
    selected ? 'ring-2 ring-zinc-500' : 'border-border/80'
  }`;

  return (
    <div className="relative group w-full h-full flex flex-col gap-2">
      <div className="absolute left-0 bottom-full pb-1.5 flex items-center gap-1.5">
        <ScrollText className="size-3 text-muted-foreground" />
        <span className="text-[11px] text-muted-foreground font-medium tracking-wide">{label}</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded-md border border-border text-muted-foreground">
          {isRevise ? '修改模式' : '创造模式'}
        </span>
      </div>

      <div className="relative w-full flex-1 min-h-40" ref={cardRef}>
        <div className={cardCls}>
          {loading ? (
            <div className="flex-1 flex flex-col min-h-0">
              {result ? (
                <TextResultView text={result} loading editing={false} onStartEdit={() => {}} onChange={() => {}} onEndEdit={() => {}} />
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="size-8 animate-spin" />
                  <span className="text-xs">{isRevise ? '修订四栏故事板…' : '生成四栏故事板…'}</span>
                </div>
              )}
              <div className="shrink-0 flex items-center justify-between px-3 py-1.5 border-t border-border/50 text-muted-foreground">
                <span className="text-[10px]">{isRevise ? 'SSE · 按要求修订' : 'SSE · 创意+故事板一次完成'}</span>
                <button type="button" onClick={onStop} className="px-2 py-0.5 rounded-md text-[10px] border border-border hover:bg-accent text-foreground">
                  停止
                </button>
              </div>
            </div>
          ) : result ? (
            <TextResultView
              text={result}
              editing={editing}
              editorRef={editorRef}
              onStartEdit={onStartEdit}
              onChange={(v) => onResultChange(v)}
              onEndEdit={() => {
                setEditing(false);
                persistResult(result);
              }}
            />
          ) : error ? (
            <div className="flex-1 flex items-center justify-center p-3 text-center text-sm text-amber-700">{error}</div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground p-4">
              <ScrollText className="size-8 opacity-40" />
              <span className="text-xs text-center leading-relaxed">
                {isRevise ? '接入或生成底稿后，填写修改要求再提交' : '输入创意 → 一键生成四栏故事板'}
              </span>
            </div>
          )}
        </div>
        <Handle type="target" position={Position.Left} style={{ left: -6, top: '50%', transform: 'translateY(-50%)' }} />
        <Handle type="source" position={Position.Right} style={{ right: -6, top: '50%', transform: 'translateY(-50%)' }} />
      </div>

      <TextNodeToolbar
        nodeId={id}
        selected={selected}
        cardRef={cardRef}
        text={result}
        hasResult={!!result}
        editing={editing}
        editorRef={editorRef}
        onStartEdit={onStartEdit}
        onTextChange={(v) => onResultChange(v, true)}
        onFullscreen={() => setFullscreen(true)}
      />

      <TextFullscreen
        open={fullscreen}
        title={label}
        text={result}
        onChange={(v) => onResultChange(v, true)}
        onClose={() => {
          setFullscreen(false);
          persistResult(result);
        }}
      />

      <ScriptNodePanel
        cardRef={cardRef}
        selected={selected}
        model={model}
        modelOptions={modelOptions}
        onModelChange={onModelChange}
        mode={mode}
        onModeChange={onModeChange}
        images={upImages.imageSrcs}
        localImageSet={localImageSet}
        onAddFiles={upImages.addLocalFiles}
        onRemoveLocal={upImages.removeLocal}
        prompt={prompt}
        onPromptChange={onPromptChange}
        thinking={thinking}
        onCycleThinking={cycleThinking}
        loading={loading}
        actionLabel={isRevise ? '一键修改' : '一键生成'}
        onGenerate={onGenerate}
        onStop={onStop}
      />
    </div>
  );
}
