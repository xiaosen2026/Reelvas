'use client';

// 增强（放大）节点 — 双模式：网络 API / 本地模型（本地后续接入）

import { useCallback, useMemo, useRef, useState } from 'react';
import { Image as ImageIcon, Loader2, ZoomIn } from 'lucide-react';
import { Handle, Position, useFlow } from '../flow';
import { collectUpstreamInputs } from './collectUpstream';
import { useUpstreamImages } from './useUpstreamImages';
import { UpscaleNodePanel } from './UpscaleNodePanel';
import { createLogger } from '../../../lib/logger';

const log = createLogger('UpscaleNode');

interface NodeProps {
  id: string;
  data: Record<string, any>;
  selected?: boolean;
}

export function UpscaleNode({ id, data, selected }: NodeProps) {
  const rf = useFlow();
  const label = data.label || '增强';
  const cardRef = useRef<HTMLDivElement>(null);

  const [scale, setScale] = useState(String(data.scale || '2x'));
  const [style, setStyle] = useState(String(data.style || '通用'));
  const [mode, setMode] = useState<'api' | 'local'>(data.mode === 'local' ? 'local' : 'api');
  const [faceEnhance, setFaceEnhance] = useState(!!data.faceEnhance);
  const [faceCreativity, setFaceCreativity] = useState(Number(data.faceCreativity ?? 0));
  const [faceStrength, setFaceStrength] = useState(Number(data.faceStrength ?? 0));
  const [loading, setLoading] = useState(data.status === 'loading');
  const [error, setError] = useState(String(data.error || ''));
  const abortRef = useRef<AbortController | null>(null);

  const upImages = useUpstreamImages(id);
  const imageSrcsRef = useRef(upImages.imageSrcs);
  imageSrcsRef.current = upImages.imageSrcs;
  const localImageSet = useMemo(() => new Set(upImages.local), [upImages.local]);

  const previewUrl = useMemo(() => {
    if (data.value) return String(data.value);
    if (data.refImage) return String(data.refImage);
    return upImages.imageSrcs[0] || '';
  }, [data.value, data.refImage, upImages.imageSrcs]);

  const patchNode = useCallback(
    (patch: Record<string, unknown>) => {
      rf.setNodes((nds) =>
        nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)),
      );
    },
    [rf, id],
  );

  const onStop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
    patchNode({ status: 'idle' });
    log.info('onStop', 'aborted', { id });
  }, [id, patchNode]);

  const onSubmit = useCallback(async () => {
    const { imageSrcs } = collectUpstreamInputs(id, rf.getNodes(), rf.getEdges());
    const merged = imageSrcsRef.current.length ? imageSrcsRef.current : imageSrcs;
    const src = data.refImage || data.value || merged[0] || '';
    if (!src) {
      setError('请先连接参考图片');
      patchNode({ error: '请先连接参考图片', status: 'error' });
      return;
    }

    log.info('onSubmit', 'start', { id, mode, scale, style, faceEnhance, imgs: merged.length });
    setLoading(true);
    setError('');
    patchNode({
      status: 'loading',
      error: '',
      scale,
      style,
      mode,
      faceEnhance,
      faceCreativity,
      faceStrength,
      refImage: src,
    });

    if (mode === 'local') {
      setLoading(false);
      const msg = '本地模型放大尚未接入，请切换「网络 API 放大」或等待后续版本';
      setError(msg);
      patchNode({ status: 'error', error: msg });
      log.warn('onSubmit', 'local_not_ready', { id });
      return;
    }

    try {
      abortRef.current = new AbortController();
      await new Promise((r) => setTimeout(r, 200));
      if (abortRef.current.signal.aborted) return;

      const msg =
        '网络 API 放大通道已预留（mode=api）。请在后续版本绑定具体放大模型；当前已保存参数与参考图。';
      setLoading(false);
      setError(msg);
      patchNode({
        status: 'error',
        error: msg,
        value: '',
        refImage: src,
        scale,
        mode: 'api',
      });
      log.info('onSubmit', 'api_stub', { id, scale });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setLoading(false);
      setError(msg);
      patchNode({ status: 'error', error: msg });
      log.error('onSubmit', 'fail', { id, error: msg });
    }
  }, [
    id,
    rf,
    data.refImage,
    data.value,
    mode,
    scale,
    style,
    faceEnhance,
    faceCreativity,
    faceStrength,
    patchNode,
  ]);

  return (
    <div className="relative group w-full h-full flex flex-col gap-2">
      <div className="absolute left-0 bottom-full pb-1.5 flex items-center gap-1.5">
        <ZoomIn className="size-3 text-muted-foreground" />
        <span className="text-[11px] text-muted-foreground font-medium tracking-wide">{label}</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded-md border border-border text-muted-foreground">
          {mode === 'local' ? '本地' : 'API'} · {scale}
        </span>
      </div>

      <div className="relative w-full flex-1 min-h-40" ref={cardRef}>
        <div
          className={`bg-card border rounded-2xl w-full h-full overflow-hidden flex items-center justify-center transition-[box-shadow,border-color] duration-200 cursor-move ${
            selected ? 'ring-2 ring-zinc-500' : 'border-border/80'
          }`}
        >
          {loading ? (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Loader2 className="size-8 animate-spin" />
              <span className="text-xs">放大中…</span>
            </div>
          ) : data.value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={String(data.value)} alt="" className="w-full h-full object-cover" draggable={false} />
          ) : previewUrl ? (
            <div className="flex flex-col items-center gap-2 px-4 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="" className="w-20 h-20 object-cover rounded-lg opacity-80" draggable={false} />
              <p className="text-xs text-muted-foreground">已连接参考图片</p>
              <p className="text-[10px] text-muted-foreground/80">选中节点后在下方配置并生成</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1.5 px-3 text-center">
              <div className="flex items-center justify-center size-16 rounded-2xl bg-muted/50">
                <ImageIcon className="size-8 text-muted-foreground" />
              </div>
              <p className="text-[10px] text-muted-foreground">连接参考图后放大</p>
              {error ? <p className="text-[10px] text-red-500 line-clamp-3">{error}</p> : null}
            </div>
          )}
        </div>
        <Handle type="target" position={Position.Left} style={{ left: -6, top: '50%', transform: 'translateY(-50%)' }} />
        <Handle type="source" position={Position.Right} style={{ right: -6, top: '50%', transform: 'translateY(-50%)' }} />
      </div>

      <UpscaleNodePanel
        cardRef={cardRef}
        selected={selected}
        loading={loading}
        onStop={onStop}
        onSubmit={onSubmit}
        images={upImages.imageSrcs}
        localImageSet={localImageSet}
        onAddFiles={upImages.addLocalFiles}
        onRemoveLocal={upImages.removeLocal}
        scale={scale}
        onScale={(v) => {
          setScale(v);
          patchNode({ scale: v });
        }}
        mode={mode}
        onMode={(m) => {
          setMode(m);
          patchNode({ mode: m });
        }}
        style={style}
        onStyle={(v) => {
          setStyle(v);
          patchNode({ style: v });
        }}
        faceEnhance={faceEnhance}
        onFaceEnhance={(v) => {
          setFaceEnhance(v);
          patchNode({ faceEnhance: v });
        }}
        faceCreativity={faceCreativity}
        onFaceCreativity={(v) => {
          setFaceCreativity(v);
          patchNode({ faceCreativity: v });
        }}
        faceStrength={faceStrength}
        onFaceStrength={(v) => {
          setFaceStrength(v);
          patchNode({ faceStrength: v });
        }}
        error={error}
      />
    </div>
  );
}
