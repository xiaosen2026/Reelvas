'use client';

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { Image as ImageIcon, Loader2, Maximize2 } from 'lucide-react';
import { Handle, Position, useFlow } from '../flow';
import { ModelIcon } from '../settings/ModelIcon';
import { listImageModelOptions, subscribeChannels } from '../../../lib/settingsStore';
import { getRecipeById, listRecipeOptions } from '../../../lib/recipePresets';
import { useEnhancePrompt } from './useEnhancePrompt';
import { useImageNodeGenerate } from './useImageNodeGenerate';
import {
  type ImageAspect,
  type ImageQuality,
  type ImageRes,
  type ImageSizeValue,
} from './ImageSizePicker';
import { ImageNodeToolbar } from './ImageNodeToolbar';
import { ImageNodePanel } from './ImageNodePanel';
import { ImageLightbox } from './ImageLightbox';
import { normalizeCameraPick, type CameraPick } from './cameraPresets';
import { mapNodeMediaSize } from './fitMediaNodeSize';
import { useUpstreamImages } from './useUpstreamImages';
import { collectUpstreamInputs } from './collectUpstream';
import { useAgentSubmitListener } from '../../../lib/useAgentSubmitListener';

interface NodeProps {
  id: string;
  data: {
    label?: string;
    prompt?: string;
    model?: string;
    res?: string;
    qty?: string;
    aspect?: string;
    quality?: string;
    recipeId?: string;
    recipeTitle?: string;
    camera?: Partial<CameraPick>;
    value?: string;
    imageUrls?: string[];
    status?: 'idle' | 'loading' | 'done' | 'error';
    error?: string;
    /** 工具栏快速创建后自动提交一次 */
    autoGenerate?: boolean;
  };
  selected?: boolean;
}

const QTY = ['1x', '2x', '3x', '4x'].map((v) => ({ value: v, label: v }));
const ASPECTS: ImageAspect[] = ['auto', '1:1', '2:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'];

function normalizeAspect(v?: string): ImageAspect {
  const a = (v || 'auto') as ImageAspect;
  return ASPECTS.includes(a) ? a : 'auto';
}
function normalizeQuality(v?: string): ImageQuality {
  const q = (v || 'high').toLowerCase();
  return q === 'low' || q === 'medium' || q === 'high' ? q : 'high';
}
function normalizeRes(v?: string): ImageRes {
  const t = (v || '1K').toUpperCase();
  return t.includes('4') ? '4K' : t.includes('2') ? '2K' : '1K';
}

// 图片节点：预设联动设置 → Recipes（type=图片）
export function ImageNode({ id, data, selected }: NodeProps) {
  const rf = useFlow();
  const buildModelOptions = useCallback(
    () =>
      listImageModelOptions().map((m) => ({
        value: m.value,
        label: m.label,
        desc: m.desc,
        icon: <ModelIcon name={m.value} size={16} fallback={m.icon} />,
      })),
    [],
  );

  const [modelOptions, setModelOptions] = useState(buildModelOptions);
  const recipeOptions = useMemo(() => listRecipeOptions('图片'), []);
  const defaultModel = modelOptions[0]?.value ?? 'gpt-image-2';

  useEffect(() => subscribeChannels((kind) => {
    if (kind !== 'image') return;
    const next = buildModelOptions();
    setModelOptions(next);
    setModel((cur: string) => (next.some((m) => m.value === cur) ? cur : next[0]?.value ?? 'gpt-image-2'));
  }), [buildModelOptions]);

  const [prompt, setPrompt] = useState(data.prompt || '');
  // Agent / 工作流写入 data.prompt 后同步到输入框（仅挂载 useState 会丢）
  useEffect(() => {
    if (typeof data.prompt === 'string' && data.prompt !== prompt) {
      setPrompt(data.prompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只跟外部 data.prompt
  }, [data.prompt]);
  const [recipeId, setRecipeId] = useState(data.recipeId || 'none');
  const [model, setModel] = useState(data.model || defaultModel);
  const [qty, setQty] = useState(data.qty || '1x');
  const [sizeVal, setSizeVal] = useState<ImageSizeValue>(() => ({
    aspect: normalizeAspect(data.aspect),
    quality: normalizeQuality(data.quality),
    res: normalizeRes(data.res),
  }));
  const [camera, setCamera] = useState<CameraPick>(() => normalizeCameraPick(data.camera));
  const [cameraOpen, setCameraOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const label = data.label || '图片节点';
  const cardRef = useRef<HTMLDivElement>(null);

  const activeRecipe = useMemo(() => getRecipeById(recipeId), [recipeId]);
  const recipeMeta = useCallback(
    () => ({ recipeId: recipeId === 'none' ? '' : recipeId, recipeTitle: activeRecipe?.title || '' }),
    [recipeId, activeRecipe],
  );

  const { enhancing, enhance } = useEnhancePrompt('image');
  const upImages = useUpstreamImages(id);
  const imageSrcsRef = useRef(upImages.imageSrcs);
  imageSrcsRef.current = upImages.imageSrcs;
  const getImageSrcs = useCallback(() => imageSrcsRef.current, []);
  const localImageSet = useMemo(() => new Set(upImages.local), [upImages.local]);

  const patchNode = useCallback(
    (patch: Record<string, unknown>) => {
      rf.setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)));
    },
    [rf, id],
  );

  const sizePatch = useCallback(
    (next: ImageSizeValue) => ({ aspect: next.aspect, quality: next.quality, res: next.res }),
    [],
  );

  const onRecipeChange = useCallback(
    (nextId: string) => {
      setRecipeId(nextId);
      const recipe = getRecipeById(nextId);
      patchNode({
        recipeId: nextId === 'none' ? '' : nextId,
        recipeTitle: recipe?.title || '',
        prompt, model, qty, camera, ...sizePatch(sizeVal),
      });
    },
    [patchNode, prompt, model, qty, camera, sizeVal, sizePatch],
  );

  const initialUrls = useMemo(() => {
    if (Array.isArray(data.imageUrls) && data.imageUrls.length) return data.imageUrls;
    return data.value ? [data.value] : [];
  }, [data.imageUrls, data.value]);

  const getGraph = useCallback(() => ({ nodes: rf.getNodes(), edges: rf.getEdges() }), [rf]);

  const { loading, phaseLabel, error, urls, onSubmit, onStop } = useImageNodeGenerate({
    id,
    prompt,
    model,
    res: sizeVal.res,
    qty,
    aspect: sizeVal.aspect,
    quality: sizeVal.quality,
    recipeId: recipeId === 'none' ? '' : recipeId,
    recipeMeta,
    camera,
    getGraph,
    setNodes: rf.setNodes,
    patchNode,
    getImageSrcs,
    initialUrls,
    initialStatus: data.status,
    initialError: data.error,
  });

  useAgentSubmitListener(id, onSubmit);

  // 工具栏快速创建：挂载后自动提交一次（抠图/全景需上游图）
  // useUpstreamImages 首帧常为空；nodes/edges 也可能分批 commit。
  // 短轮询等图上可读到参考图再 submit；onSubmit 内亦合并 graph+ui。
  const autoGenOnce = useRef(false);
  useEffect(() => {
    if (!data.autoGenerate || autoGenOnce.current || loading || !prompt.trim()) return;
    let cancelled = false;
    const tryFire = (): boolean => {
      if (cancelled || autoGenOnce.current) return true;
      const { nodes, edges } = getGraph();
      const graphImgs = collectUpstreamInputs(id, nodes, edges).imageSrcs;
      const uiImgs = upImages.imageSrcs;
      if (graphImgs.length === 0 && uiImgs.length === 0) return false;
      autoGenOnce.current = true;
      patchNode({ autoGenerate: false });
      void onSubmit();
      return true;
    };
    if (tryFire()) return;
    let n = 0;
    const timer = window.setInterval(() => {
      n += 1;
      if (tryFire() || n >= 40) window.clearInterval(timer);
    }, 50);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [
    data.autoGenerate,
    loading,
    prompt,
    onSubmit,
    patchNode,
    getGraph,
    id,
    upImages.imageSrcs,
  ]);

  const onCameraApply = useCallback(
    (next: CameraPick) => {
      setCamera(next);
      patchNode({ camera: next, prompt, model, qty, ...sizePatch(sizeVal), ...recipeMeta() });
    },
    [patchNode, prompt, model, qty, sizeVal, sizePatch, recipeMeta],
  );

  const onEnhance = useCallback(async () => {
    if (!prompt.trim() || enhancing) return;
    try {
      const next = await enhance(prompt, { systemPrompt: activeRecipe?.systemPrompt });
      if (next) {
        setPrompt(next);
        patchNode({ prompt: next, model, qty, camera, ...sizePatch(sizeVal), ...recipeMeta() });
      }
    } catch {
      /* 渠道未配置等 */
    }
  }, [prompt, enhancing, enhance, patchNode, model, qty, camera, sizeVal, sizePatch, activeRecipe, recipeMeta]);

  const onSizeChange = useCallback(
    (next: ImageSizeValue) => {
      setSizeVal(next);
      patchNode({ prompt, model, qty, camera, ...sizePatch(next), ...recipeMeta() });
    },
    [patchNode, prompt, model, qty, camera, sizePatch, recipeMeta],
  );

  const previewUrl = urls[0] || data.value || '';
  const lightboxUrls = useMemo(() => {
    if (urls.length) return urls;
    return previewUrl ? [previewUrl] : [];
  }, [urls, previewUrl]);
  const statusError = error || data.error || '';
  const placeholder =
    activeRecipe?.plannerHint ||
    '输入描述；连线上游文本会追加，上游图片走图生图（多图一起提交）';
  const basePatch = () => ({ prompt, model, qty, camera, ...sizePatch(sizeVal), ...recipeMeta() });
  const cardCls = `relative bg-card border rounded-2xl w-full h-full overflow-hidden flex items-center justify-center transition-[box-shadow,border-color] duration-200 cursor-move ${
    selected ? 'ring-2 ring-zinc-500' : 'border-border/80'
  }`;

  return (
    <div className="relative group w-full h-full flex flex-col gap-2">
      <div className="absolute left-0 bottom-full pb-1.5 flex items-center gap-1.5">
        <span className="text-[11px] text-muted-foreground font-medium tracking-wide">{label}</span>
        {activeRecipe ? (
          <span className="text-[10px] px-1.5 py-0.5 rounded-md border border-border text-muted-foreground max-w-40 truncate">
            {activeRecipe.title}
          </span>
        ) : null}
      </div>

      <ImageNodeToolbar nodeId={id} selected={selected} cardRef={cardRef} imageUrl={previewUrl} hasImage={!!previewUrl} />

      <div className="relative w-full flex-1 min-h-40" ref={cardRef}>
        <div
          className={cardCls}
          onDoubleClick={(e) => {
            if (!previewUrl) return;
            e.stopPropagation();
            setLightboxOpen(true);
          }}
        >
          {loading ? (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Loader2 className="size-8 animate-spin" />
              <span className="text-xs">{phaseLabel || '处理中…'}</span>
            </div>
          ) : previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt=""
              className="w-full h-full object-cover pointer-events-none select-none"
              draggable={false}
              onLoad={(e) => {
                const img = e.currentTarget;
                rf.setNodes((nds) => mapNodeMediaSize(nds, id, img.naturalWidth, img.naturalHeight));
              }}
            />
          ) : (
            <div className="flex flex-col items-center gap-1.5 px-3 text-center">
              <div className="flex items-center justify-center size-16 rounded-2xl bg-muted/50">
                <ImageIcon className="size-8 text-muted-foreground" />
              </div>
              {statusError ? <p className="text-[10px] text-red-500 line-clamp-3 max-w-[90%]">{statusError}</p> : null}
            </div>
          )}
          {previewUrl ? (
            <button
              type="button"
              title="放大预览"
              className="nodrag absolute top-2 right-2 z-10 flex items-center gap-1 rounded-full border border-border bg-background/80 px-2.5 py-1 text-xs text-muted-foreground shadow-sm backdrop-blur-sm hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxOpen(true);
              }}
            >
              <Maximize2 className="size-3.5" />
              <span>放大</span>
            </button>
          ) : null}
        </div>
        <Handle type="target" position={Position.Left} style={{ left: -6, top: '50%', transform: 'translateY(-50%)' }} />
        <Handle type="source" position={Position.Right} style={{ right: -6, top: '50%', transform: 'translateY(-50%)' }} />
      </div>

      <ImageLightbox
        open={lightboxOpen}
        urls={lightboxUrls}
        title={label}
        onClose={() => setLightboxOpen(false)}
      />

      <ImageNodePanel
        cardRef={cardRef}
        selected={selected}
        recipeId={recipeId}
        recipeOptions={recipeOptions}
        onRecipeChange={onRecipeChange}
        loading={loading}
        onStop={onStop}
        onSubmit={onSubmit}
        images={upImages.imageSrcs}
        localImageSet={localImageSet}
        onAddFiles={upImages.addLocalFiles}
        onRemoveLocal={upImages.removeLocal}
        prompt={prompt}
        onPromptChange={setPrompt}
        placeholder={placeholder}
        enhancing={enhancing}
        onEnhance={onEnhance}
        statusError={statusError}
        model={model}
        modelOptions={modelOptions}
        defaultModel={defaultModel}
        onModelChange={(v) => {
          setModel(v);
          patchNode({ ...basePatch(), model: v });
        }}
        sizeVal={sizeVal}
        onSizeChange={onSizeChange}
        qty={qty}
        qtyOptions={QTY}
        onQtyChange={(v) => {
          setQty(v);
          patchNode({ ...basePatch(), qty: v });
        }}
        camera={camera}
        cameraOpen={cameraOpen}
        onCameraOpenChange={setCameraOpen}
        onCameraApply={onCameraApply}
      />
    </div>
  );
}
