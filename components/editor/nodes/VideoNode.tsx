'use client';

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { Video as VideoIcon, Loader2 } from 'lucide-react';
import { Handle, Position, useFlow } from '../flow';
import { ModelIcon } from '../settings/ModelIcon';
import { useEnhancePrompt } from './useEnhancePrompt';
import { useVideoNodeGenerate } from './useVideoNodeGenerate';
import { useChannelModelOptions } from './useChannelModelOptions';
import { emptyCustomParams, type VideoCustomParams } from './VideoParamsBar';
import { mapNodeMediaSize } from './fitMediaNodeSize';
import { useUpstreamImages } from './useUpstreamImages';
import {
  VideoNodePanel,
  imagesForVideoMode,
  pickVideoMode,
  type VideoGenMode,
} from './VideoNodePanel';
import { VideoNodeToolbar } from './VideoNodeToolbar';
import { useAgentSubmitListener } from '../../../lib/useAgentSubmitListener';

interface NodeProps {
  id: string;
  data: {
    label?: string;
    prompt?: string;
    model?: string;
    res?: string;
    ratio?: string;
    duration?: string;
    qty?: string;
    width?: string;
    height?: string;
    fps?: string;
    seed?: string;
    negativePrompt?: string;
    /** 全能参考 / 文生视频 / 首帧 / 首尾帧 */
    videoMode?: VideoGenMode;
    value?: string;
    videoUrl?: string;
    promptHtml?: string;
    status?: 'idle' | 'loading' | 'done' | 'error';
    error?: string;
    progress?: string;
  };
  selected?: boolean;
}

export function VideoNode({ id, data, selected }: NodeProps) {
  const rf = useFlow();
  const channelModels = useChannelModelOptions('video');
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
  const defaultModel = modelOptions[0]?.value ?? 'grok-video-1.5-preview';

  const [prompt, setPrompt] = useState(data.prompt || '');
  // Agent build_workflow 写入 data.prompt 后同步到输入框
  useEffect(() => {
    if (typeof data.prompt === 'string' && data.prompt !== prompt) {
      setPrompt(data.prompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.prompt]);
  const [model, setModel] = useState(data.model || defaultModel);
  const [res, setRes] = useState(data.res || '720p');
  const [ratio, setRatio] = useState(data.ratio || '16:9');
  const [qty, setQty] = useState(data.qty || '1x');
  const [videoMode, setVideoMode] = useState<VideoGenMode>(data.videoMode || '文生视频');
  const [custom, setCustom] = useState<VideoCustomParams>(() =>
    emptyCustomParams({
      duration: data.duration || '6秒',
      width: data.width || '',
      height: data.height || '',
      fps: data.fps || '',
      seed: data.seed || '',
      negativePrompt: data.negativePrompt || '',
    }),
  );
  const label = data.label || '视频节点';
  const cardRef = useRef<HTMLDivElement>(null);

  const { enhancing, enhance } = useEnhancePrompt('video');
  const upImages = useUpstreamImages(id);
  const imageSrcsRef = useRef(upImages.imageSrcs);
  imageSrcsRef.current = upImages.imageSrcs;
  const videoModeRef = useRef(videoMode);
  videoModeRef.current = videoMode;
  // 提交时按模式裁剪图片（首帧 1 张 / 首尾帧 2 张 / 全能全部 / 文生无图）
  const getImageSrcs = useCallback(
    () => imagesForVideoMode(videoModeRef.current, imageSrcsRef.current),
    [],
  );
  const localImageSet = useMemo(() => new Set(upImages.local), [upImages.local]);

  const patchNode = useCallback(
    (patch: Record<string, unknown>) => {
      rf.setNodes((nds) =>
        nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)),
      );
    },
    [rf, id],
  );

  // 图片数量变化时自动回落合法模式
  useEffect(() => {
    const next = pickVideoMode(upImages.imageSrcs.length, videoMode);
    if (next !== videoMode) {
      setVideoMode(next);
      patchNode({ videoMode: next });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅随图片数量与模式联动
  }, [upImages.imageSrcs.length]);

  const persist = useCallback(
    (over: Record<string, unknown> = {}) => {
      patchNode({
        prompt,
        model,
        res,
        ratio,
        qty,
        videoMode,
        duration: custom.duration,
        width: custom.width,
        height: custom.height,
        fps: custom.fps,
        seed: custom.seed,
        negativePrompt: custom.negativePrompt,
        ...over,
      });
    },
    [patchNode, prompt, model, res, ratio, qty, videoMode, custom],
  );

  const getGraph = useCallback(
    () => ({ nodes: rf.getNodes(), edges: rf.getEdges() }),
    [rf],
  );

  const initialUrl = data.videoUrl || data.value || '';

  const { loading, error, url, progress, onSubmit, onStop } = useVideoNodeGenerate({
    id,
    prompt,
    model,
    res,
    ratio,
    duration: custom.duration,
    qty,
    width: custom.width,
    height: custom.height,
    fps: custom.fps,
    seed: custom.seed,
    negativePrompt: custom.negativePrompt,
    getGraph,
    patchNode,
    getImageSrcs,
    // 视频/音频由 useVideoNodeGenerate 从 collectUpstream 自动收集
    initialUrl,
    initialStatus: data.status,
    initialError: data.error,
  });

  useAgentSubmitListener(id, onSubmit);

  const onEnhance = useCallback(async () => {
    if (!prompt.trim() || enhancing) return;
    try {
      const next = await enhance(prompt);
      if (next) {
        setPrompt(next);
        persist({ prompt: next });
      }
    } catch {
      /* 渠道未配置等 */
    }
  }, [prompt, enhancing, enhance, persist]);

  const previewUrl = url || data.videoUrl || data.value || '';
  const statusError = error || data.error || '';
  const progressLabel = progress || (typeof data.progress === 'string' ? data.progress : '') || '';

  return (
    <div className="relative group w-full h-full flex flex-col gap-2">
      <div className="absolute left-0 bottom-full pb-1.5 flex items-center gap-1.5">
        <span className="text-[11px] text-muted-foreground font-medium tracking-wide">{label}</span>
      </div>

      <div className="relative w-full flex-1 min-h-40" ref={cardRef}>
        <div
          className={`bg-card border rounded-2xl w-full h-full overflow-hidden flex items-center justify-center transition-[box-shadow,border-color] duration-200 cursor-move ${
            selected ? 'ring-2 ring-zinc-500' : 'border-border/80'
          }`}
        >
          {loading ? (
            <div className="flex flex-col items-center gap-2 text-muted-foreground px-3 text-center">
              <Loader2 className="size-8 animate-spin" />
              <span className="text-xs tabular-nums">
                {progressLabel ? `生成中 ${progressLabel}` : '生成中…'}
              </span>
            </div>
          ) : previewUrl ? (
            <video
              src={previewUrl}
              className="w-full h-full object-cover"
              controls
              playsInline
              muted
              loop
              onLoadedMetadata={(e) => {
                const v = e.currentTarget;
                rf.setNodes((nds) => mapNodeMediaSize(nds, id, v.videoWidth, v.videoHeight));
              }}
            />
          ) : (
            <div className="flex flex-col items-center gap-1.5 px-3 text-center">
              <div className="flex items-center justify-center size-16 rounded-2xl bg-muted/50">
                <VideoIcon className="size-8 text-muted-foreground" />
              </div>
              {statusError ? (
                <p className="text-[10px] text-red-500 line-clamp-3 max-w-[90%]">{statusError}</p>
              ) : null}
            </div>
          )}
        </div>
        <VideoNodeToolbar
          nodeId={id}
          selected={selected}
          cardRef={cardRef}
          videoUrl={previewUrl}
          hasVideo={!!previewUrl}
        />
        <Handle type="target" position={Position.Left} style={{ left: -6, top: '50%', transform: 'translateY(-50%)' }} />
        <Handle type="source" position={Position.Right} style={{ right: -6, top: '50%', transform: 'translateY(-50%)' }} />
      </div>

      <VideoNodePanel
        cardRef={cardRef}
        selected={selected}
        loading={loading}
        onStop={onStop}
        onSubmit={onSubmit}
        images={upImages.imageSrcs}
        localImageSet={localImageSet}
        onAddFiles={upImages.addLocalFiles}
        onRemoveLocal={upImages.removeLocal}
        mode={videoMode}
        onModeChange={(m) => {
          setVideoMode(m);
          persist({ videoMode: m });
        }}
        prompt={prompt}
        promptHtml={data.promptHtml || ''}
        onPromptChange={(v) => { setPrompt(v); patchNode({ prompt: v }); }}
        onPromptHtmlChange={(html) => { patchNode({ promptHtml: html }); }}
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
        res={res}
        ratio={ratio}
        qty={qty}
        custom={custom}
        onRes={(v) => {
          setRes(v);
          persist({ res: v });
        }}
        onRatio={(v) => {
          setRatio(v);
          persist({ ratio: v });
        }}
        onQty={(v) => {
          setQty(v);
          persist({ qty: v });
        }}
        onCustom={(next) => {
          setCustom(next);
          patchNode({
            prompt,
            model,
            res,
            ratio,
            qty,
            videoMode,
            duration: next.duration,
            width: next.width,
            height: next.height,
            fps: next.fps,
            seed: next.seed,
            negativePrompt: next.negativePrompt,
          });
        }}
      />
    </div>
  );
}
