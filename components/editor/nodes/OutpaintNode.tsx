'use client';

// 扩图节点：卡片预览 + 双击全屏拖边扩图 + 图生图

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Expand, Image as ImageIcon, Loader2, Maximize2 } from 'lucide-react';
import { Handle, Position, useFlow } from '../flow';
import { ModelIcon } from '../settings/ModelIcon';
import { listImageModelOptions, subscribeChannels } from '../../../lib/settingsStore';
import { createLogger } from '../../../lib/logger';
import { useUpstreamImages } from './useUpstreamImages';
import { mapNodeMediaSize } from './fitMediaNodeSize';
import {
  clampPads,
  DEFAULT_EXPAND_PADS,
  type ExpandPads,
} from './buildGreenScreenCanvas';
import { ImageLightbox } from './ImageLightbox';
import { OutpaintFullscreen } from './OutpaintFullscreen';
import { OutpaintNodePanel } from './OutpaintNodePanel';
import { runOutpaintSubmit } from './runOutpaintSubmit';

const log = createLogger('OutpaintNode');
const FALLBACK_MODEL = 'doubao-seedream-5-0-260128';

interface NodeProps {
  id: string;
  data: Record<string, any>;
  selected?: boolean;
}

function readPads(data: Record<string, any>): ExpandPads {
  if (data.pads && typeof data.pads === 'object') return clampPads(data.pads);
  return { ...DEFAULT_EXPAND_PADS };
}

export function OutpaintNode({ id, data, selected }: NodeProps) {
  const rf = useFlow();
  const label = data.label || '扩图';
  const cardRef = useRef<HTMLDivElement>(null);

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
  const defaultModel = modelOptions[0]?.value ?? FALLBACK_MODEL;
  const [model, setModel] = useState(String(data.model || defaultModel));

  useEffect(() => subscribeChannels((kind) => {
    if (kind !== 'image') return;
    const next = buildModelOptions();
    setModelOptions(next);
    setModel((cur) => (next.some((m) => m.value === cur) ? cur : next[0]?.value ?? FALLBACK_MODEL));
  }), [buildModelOptions]);

  const [pads, setPads] = useState<ExpandPads>(() => readPads(data));
  const [userHint, setUserHint] = useState(String(data.userHint || ''));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(String(data.error || ''));
  const [fullscreen, setFullscreen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const upImages = useUpstreamImages(id);
  const imageSrcsRef = useRef(upImages.imageSrcs);
  imageSrcsRef.current = upImages.imageSrcs;
  const localImageSet = useMemo(() => new Set(upImages.local), [upImages.local]);

  const sourceUrl = useMemo(() => {
    if (data.refImage) return String(data.refImage);
    return upImages.imageSrcs[0] || '';
  }, [data.refImage, upImages.imageSrcs]);

  const resultUrl = data.value ? String(data.value) : '';
  const previewUrl =
    resultUrl || (data.compositeUrl ? String(data.compositeUrl) : '') || sourceUrl || '';
  const lightboxUrls = useMemo(
    () => [resultUrl, sourceUrl].filter(Boolean),
    [resultUrl, sourceUrl],
  );

  const patchNode = useCallback(
    (patch: Record<string, unknown>) => {
      rf.setNodes((nds) =>
        nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)),
      );
    },
    [rf, id],
  );

  useEffect(() => {
    if (data.status === 'loading') {
      patchNode({ status: data.value ? 'done' : 'idle', error: '' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const openEditor = useCallback(() => {
    if (!sourceUrl) {
      setError('请先连接参考图片');
      return;
    }
    setError('');
    setFullscreen(true);
    log.info('openEditor', 'ok', { id });
  }, [id, sourceUrl]);

  const onPadsChange = useCallback((next: ExpandPads) => {
    const p = clampPads(next);
    setPads(p);
    patchNode({ pads: p });
  }, [patchNode]);

  const onModelChange = useCallback((v: string) => {
    setModel(v);
    patchNode({ model: v });
    log.info('onModelChange', 'select', { id, model: v });
  }, [id, patchNode]);

  const onStop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
    patchNode({ status: data.value ? 'done' : 'idle' });
    log.info('onStop', 'aborted', { id });
  }, [id, patchNode, data.value]);

  const onSubmit = useCallback(async () => {
    if (loading) return;
    await runOutpaintSubmit({
      id, rf, model, pads, userHint,
      refImage: data.refImage, sourceUrl, imageSrcsRef, abortRef,
      patchNode, setLoading, setError, setFullscreen,
    });
  }, [loading, id, rf, model, pads, userHint, data.refImage, sourceUrl, patchNode]);

  return (
    <div className="relative group w-full h-full flex flex-col gap-2">
      <div className="absolute left-0 bottom-full pb-1.5 flex items-center gap-1.5">
        <Expand className="size-3 text-muted-foreground" />
        <span className="text-[11px] text-muted-foreground font-medium tracking-wide">{label}</span>
      </div>

      <div className="relative w-full flex-1 min-h-40" ref={cardRef}>
        <div
          className={`relative bg-card border rounded-2xl w-full h-full overflow-hidden cursor-move transition-[box-shadow,border-color] duration-200 ${
            selected ? 'ring-2 ring-zinc-500' : 'border-border/80'
          }`}
          onDoubleClick={(e) => {
            e.stopPropagation();
            openEditor();
          }}
        >
          {loading ? (
            <div className="relative w-full h-full">
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={String(previewUrl)} alt="" className="absolute inset-0 w-full h-full object-cover opacity-50" draggable={false} />
              ) : null}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground bg-background/40">
                <Loader2 className="size-8 animate-spin" />
                <span className="text-xs">扩图生成中…</span>
              </div>
            </div>
          ) : resultUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={resultUrl}
              alt=""
              className="w-full h-full object-cover pointer-events-none select-none"
              draggable={false}
              onLoad={(e) => {
                const img = e.currentTarget;
                if (img.naturalWidth && img.naturalHeight) {
                  rf.setNodes((nds) => mapNodeMediaSize(nds, id, img.naturalWidth, img.naturalHeight));
                }
              }}
            />
          ) : sourceUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={sourceUrl} alt="" className="w-full h-full object-cover pointer-events-none select-none" draggable={false} />
          ) : (
            <div className="flex flex-col items-center justify-center gap-1.5 h-full px-3 text-center">
              <div className="flex items-center justify-center size-16 rounded-2xl bg-muted/50">
                <ImageIcon className="size-8 text-muted-foreground" />
              </div>
              <p className="text-[10px] text-muted-foreground">连接参考图后双击编辑扩图</p>
              {error ? <p className="text-[10px] text-red-500 line-clamp-3">{error}</p> : null}
            </div>
          )}

          {sourceUrl || resultUrl ? (
            <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2">
              <span className="rounded-full bg-foreground/70 px-3 py-1 text-xs text-background backdrop-blur-sm">
                拖动节点 · 双击进入编辑
              </span>
            </div>
          ) : null}

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
        urls={lightboxUrls.length ? lightboxUrls : previewUrl ? [previewUrl] : []}
        title={label}
        onClose={() => setLightboxOpen(false)}
      />

      <OutpaintNodePanel
        cardRef={cardRef}
        selected={selected}
        loading={loading}
        canEdit={!!sourceUrl}
        onOpenEditor={openEditor}
        onStop={onStop}
        onSubmit={onSubmit}
        images={upImages.imageSrcs}
        localImageSet={localImageSet}
        onAddFiles={upImages.addLocalFiles}
        onRemoveLocal={upImages.removeLocal}
        pads={pads}
        hasResult={!!resultUrl}
        error={error}
        model={model}
        modelOptions={modelOptions}
        defaultModel={defaultModel}
        onModelChange={onModelChange}
      />

      <OutpaintFullscreen
        open={fullscreen}
        title={label}
        imageUrl={sourceUrl}
        pads={pads}
        userHint={userHint}
        loading={loading}
        error={error}
        model={model}
        modelOptions={modelOptions}
        defaultModel={defaultModel}
        onModelChange={onModelChange}
        onPadsChange={onPadsChange}
        onUserHint={(v) => {
          setUserHint(v);
          patchNode({ userHint: v });
        }}
        onSubmit={onSubmit}
        onStop={onStop}
        onClose={() => {
          if (!loading) setFullscreen(false);
        }}
      />
    </div>
  );
}
