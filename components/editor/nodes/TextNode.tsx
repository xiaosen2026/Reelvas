'use client';

import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { Type, Loader2 } from 'lucide-react';
import { Handle, Position, useFlow } from '../flow';
import { ModelIcon } from '../settings/ModelIcon';
import { listTextModelOptions, subscribeChannels } from '../../../lib/settingsStore';
import { getRecipeById, listRecipeOptions } from '../../../lib/recipePresets';
import { useTextNodeGenerate, THINKING_CYCLE, type ThinkingLevel } from './useTextNodeGenerate';
import { useEnhancePrompt } from './useEnhancePrompt';
import { TextResultView } from './TextResultView';
import { TextNodeToolbar } from './TextNodeToolbar';
import { TextNodePanel } from './TextNodePanel';
import { TextFullscreen } from './TextFullscreen';
import { useUpstreamImages } from './useUpstreamImages';
import { parseThinking, recipePatch } from './textNodeUtils';
import { createLogger } from '../../../lib/logger';
import { useAgentSubmitListener } from '../../../lib/useAgentSubmitListener';

const log = createLogger('TextNode');

interface NodeProps {
  id: string;
  data: {
    label?: string;
    prompt?: string;
    model?: string;
    recipeId?: string;
    recipeTitle?: string;
    thinking?: ThinkingLevel;
    value?: string;
    status?: 'idle' | 'loading' | 'done' | 'error';
    error?: string;
  };
  selected?: boolean;
}

export function TextNode({ id, data, selected }: NodeProps) {
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
  const recipeOptions = useMemo(() => listRecipeOptions('文本'), []);
  const defaultModel = modelOptions[0]?.value ?? 'grok-4.5';

  useEffect(() => {
    return subscribeChannels((kind) => {
      if (kind !== 'text') return;
      const next = buildModelOptions();
      setModelOptions(next);
      setModel((cur) => (next.some((m) => m.value === cur) ? cur : next[0]?.value ?? 'grok-4.5'));
    });
  }, [buildModelOptions]);

  const [prompt, setPrompt] = useState(data.prompt || '');
  // Agent build_workflow 写入 data.prompt 后同步到输入框
  useEffect(() => {
    if (typeof data.prompt === 'string' && data.prompt !== prompt) {
      setPrompt(data.prompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.prompt]);
  const [model, setModel] = useState(data.model || defaultModel);
  const [recipeId, setRecipeId] = useState(data.recipeId || 'none');
  const [thinking, setThinking] = useState<ThinkingLevel>(() => parseThinking(data.thinking));
  const [editing, setEditing] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const label = data.label || '文本节点';
  const cardRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);

  const activeRecipe = useMemo(() => getRecipeById(recipeId), [recipeId]);
  const recipeMeta = useCallback(
    () => ({
      recipeId: recipeId === 'none' ? '' : recipeId,
      recipeTitle: activeRecipe?.title || '',
    }),
    [recipeId, activeRecipe],
  );

  const patchNode = useCallback(
    (patch: Record<string, unknown>) => {
      rf.setNodes((nds) =>
        nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)),
      );
    },
    [rf, id],
  );

  const onRecipeChange = useCallback(
    (nextId: string) => {
      setRecipeId(nextId);
      patchNode(recipePatch(nextId, { prompt, model }));
    },
    [patchNode, prompt, model],
  );

  const cycleThinking = useCallback(() => {
    setThinking((cur) => {
      const next = THINKING_CYCLE[(THINKING_CYCLE.indexOf(cur) + 1) % THINKING_CYCLE.length];
      patchNode({ thinking: next, prompt, model, ...recipeMeta() });
      return next;
    });
  }, [patchNode, prompt, model, recipeMeta]);

  const upImages = useUpstreamImages(id);
  const imageSrcsRef = useRef(upImages.imageSrcs);
  imageSrcsRef.current = upImages.imageSrcs;
  const getGraph = useCallback(() => ({ nodes: rf.getNodes(), edges: rf.getEdges() }), [rf]);
  const getImageSrcs = useCallback(() => imageSrcsRef.current, []);
  const localImageSet = useMemo(() => new Set(upImages.local), [upImages.local]);

  const { loading, error, result, onSubmit, onStop, updateResult } = useTextNodeGenerate({
    id,
    prompt,
    model,
    recipeId,
    thinking,
    recipeMeta,
    patchNode,
    getGraph,
    getImageSrcs,
    initialValue: data.value,
    initialStatus: data.status,
    initialError: data.error,
  });

  useAgentSubmitListener(id, onSubmit);

  const { enhancing, enhance } = useEnhancePrompt('text');
  const onEnhance = useCallback(async () => {
    if (!prompt.trim() || loading || enhancing) return;
    try {
      const next = await enhance(prompt);
      if (next) {
        setPrompt(next);
        patchNode({ prompt: next, model, ...recipeMeta() });
      }
    } catch (err) {
      patchNode({ error: err instanceof Error ? err.message : String(err), status: 'error' });
    }
  }, [prompt, loading, enhancing, enhance, patchNode, model, recipeMeta]);

  const persistResult = useCallback(
    (text: string) => {
      updateResult(text);
      patchNode({ value: text, status: text ? 'done' : 'idle', error: '' });
      log.info('persistResult', 'ok', { id, len: text.length });
    },
    [updateResult, patchNode, id],
  );

  const onStartEdit = useCallback(() => {
    if (!loading && result) setEditing(true);
  }, [loading, result]);

  const onEndEdit = useCallback(() => {
    setEditing(false);
    persistResult(result);
  }, [persistResult, result]);

  const onResultChange = useCallback((value: string) => updateResult(value), [updateResult]);
  const onResultChangePersist = useCallback(
    (value: string) => {
      updateResult(value);
      patchNode({ value, status: value ? 'done' : 'idle', error: '' });
    },
    [updateResult, patchNode],
  );

  const placeholder = activeRecipe?.plannerHint || '输入描述（Enter 发送，生成中再按 Enter/Esc 停止）';

  return (
    <div className="relative group w-full h-full flex flex-col gap-2">
      <div className="absolute left-0 bottom-full pb-1.5 flex items-center gap-1.5">
        <span className="text-[11px] text-muted-foreground font-medium tracking-wide">{label}</span>
        {activeRecipe && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-md border border-border text-muted-foreground max-w-35 truncate">
            {activeRecipe.title}
          </span>
        )}
      </div>

      <div className="relative w-full flex-1 min-h-40" ref={cardRef}>
        <div
          className={`bg-card border rounded-2xl w-full h-full overflow-hidden flex flex-col transition-[box-shadow,border-color] duration-200 cursor-move ${
            selected ? 'ring-2 ring-zinc-500' : 'border-border/80'
          }`}
        >
          {loading ? (
            <div className="flex-1 flex flex-col min-h-0">
              {result ? (
                <TextResultView text={result} loading editing={false} onStartEdit={() => {}} onChange={() => {}} onEndEdit={() => {}} />
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="size-8 animate-spin" />
                  <span className="text-xs">生成中…</span>
                </div>
              )}
              <div className="shrink-0 flex items-center justify-between px-3 py-1.5 border-t border-border/50 text-muted-foreground">
                <span className="text-[10px]">SSE{activeRecipe ? ` · ${activeRecipe.title}` : ''}</span>
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
              onChange={onResultChange}
              onEndEdit={onEndEdit}
            />
          ) : error ? (
            <div className="flex-1 flex items-center justify-center p-3">
              <p className="text-xs text-red-500 text-center leading-relaxed">{error}</p>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex items-center justify-center size-16 rounded-2xl bg-muted/50">
                <Type className="size-8 text-muted-foreground" />
              </div>
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
        onTextChange={onResultChangePersist}
        onFullscreen={() => setFullscreen(true)}
      />

      <TextFullscreen
        open={fullscreen}
        title={label}
        text={result}
        onChange={onResultChangePersist}
        onClose={() => {
          setFullscreen(false);
          persistResult(result);
        }}
      />

      <TextNodePanel
        cardRef={cardRef}
        selected={selected}
        model={model}
        modelOptions={modelOptions}
        onModelChange={setModel}
        recipeId={recipeId}
        recipeOptions={recipeOptions}
        onRecipeChange={onRecipeChange}
        images={upImages.imageSrcs}
        localImageSet={localImageSet}
        onAddFiles={(files) => void upImages.addLocalFiles(files)}
        onRemoveLocal={upImages.removeLocal}
        prompt={prompt}
        onPromptChange={setPrompt}
        placeholder={placeholder}
        loading={loading}
        enhancing={enhancing}
        thinking={thinking}
        onCycleThinking={cycleThinking}
        onEnhance={() => void onEnhance()}
        onSubmit={() => void onSubmit()}
        onStop={onStop}
      />
    </div>
  );
}
