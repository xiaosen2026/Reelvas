'use client';

// 全景图节点 — 卡片静态图（同图片节点可拖动）+ 全屏旋转发送

import { useCallback, useMemo, useRef, useState } from 'react';
import { Camera, Globe2 } from 'lucide-react';
import { Handle, Position, useFlow } from '../flow';
import { NodePanel } from './NodePanel';
import { buildPanoramaCaptureFileName } from './panoramaCapture';
import { PanoramaFullscreen } from './PanoramaFullscreen';
import { spawnUploadCaptures } from './spawnUploadCaptures';
import { usePanoramaScenes } from './usePanoramaScenes';
import { usePanoramaViewer } from './usePanoramaViewer';
import type { PanoramaScene } from './panoramaScenes';
import { createLogger } from '@/lib/logger';

const log = createLogger('PanoramaNode');

interface NodeProps {
  id: string;
  data: {
    label?: string;
    value?: string;
    refImage?: string;
    prompt?: string;
    scenes?: PanoramaScene[];
    active?: number;
    status?: string;
    thumbnailUrl?: string;
  };
  selected?: boolean;
}

export function PanoramaNode({ id, data, selected }: NodeProps) {
  const rf = useFlow();
  const label = data.label || '全景图';
  const cardRef = useRef<HTMLDivElement>(null);
  const fsPanoRef = useRef<HTMLDivElement>(null);

  const { scenes, active, setActive } = usePanoramaScenes(id, data);
  const [fullscreen, setFullscreen] = useState(false);
  const [sending, setSending] = useState(false);
  const [tip, setTip] = useState('');

  const activeUrl = useMemo(
    () => scenes[active]?.url || data.value || data.refImage || data.thumbnailUrl || '',
    [scenes, active, data.value, data.refImage, data.thumbnailUrl],
  );

  // 仅全屏挂 Pannellum；卡片用静态 img，拖动=移动节点
  const { captureCurrentView } = usePanoramaViewer(fsPanoRef, fullscreen ? activeUrl : '', {
    hfov: 100,
  });

  const selectScene = useCallback(
    (i: number) => {
      if (i < 0 || i >= scenes.length) return;
      setActive(i);
      const outUrl = scenes[i]?.url || '';
      rf.setNodes((nds) =>
        nds.map((n) =>
          n.id === id
            ? {
                ...n,
                data: {
                  ...n.data,
                  active: i,
                  value: outUrl || n.data?.value,
                  scenes,
                },
              }
            : n,
        ),
      );
      log.info('selectScene', 'ok', { id, i });
    },
    [id, rf, scenes, setActive],
  );

  const sendCurrentView = useCallback(() => {
    if (sending) return;
    setSending(true);
    setTip('');
    try {
      const dataUrl = captureCurrentView();
      if (!dataUrl) {
        setTip('截取失败：跨域图需 CORS，或等全景加载完成后再试');
        log.warn('sendCurrentView', 'capture null', { id });
        return;
      }
      const fileName = buildPanoramaCaptureFileName(scenes[active]?.name, 1);
      const result = spawnUploadCaptures({
        sourceId: id,
        captures: [{ dataUrl, fileName }],
        nodes: rf.getNodes(),
        edges: rf.getEdges(),
      });
      if (!result) {
        setTip('发送失败：无法创建上传节点');
        return;
      }
      rf.setNodes(() => result.nodes);
      rf.setEdges(() => result.edges);
      setFullscreen(false);
      setTip('');
      log.info('sendCurrentView', '已发送到画布', { id, fileName, n: result.spawned });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setTip(`发送失败：${msg}`);
      log.error('sendCurrentView', 'fail', { id, error: msg });
    } finally {
      setSending(false);
    }
  }, [active, captureCurrentView, id, rf, scenes, sending]);

  return (
    <div className="relative group w-full h-full flex flex-col gap-2">
      <div className="absolute left-0 bottom-full pb-1.5 flex items-center gap-1.5">
        <Globe2 className="size-3 text-muted-foreground" />
        <span className="text-[11px] text-muted-foreground font-medium tracking-wide">{label}</span>
        {scenes.length > 0 ? (
          <span className="text-[10px] px-1.5 py-0.5 rounded-md border border-border text-muted-foreground">
            {scenes.length} 场景
          </span>
        ) : null}
      </div>

      <div className="relative w-full flex-1 min-h-40" ref={cardRef}>
        <div
          className={`relative bg-black border rounded-2xl w-full h-full overflow-hidden flex items-center justify-center cursor-move transition-[box-shadow,border-color] duration-200 ${
            selected ? 'ring-2 ring-zinc-500' : 'border-border/80'
          }`}
          onDoubleClick={(e) => {
            e.stopPropagation();
            if (activeUrl) setFullscreen(true);
          }}
        >
          {activeUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={activeUrl}
              alt={scenes[active]?.name || label}
              className="w-full h-full object-cover pointer-events-none select-none"
              draggable={false}
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <div className="flex items-center justify-center size-16 rounded-2xl bg-muted/40">
                <Globe2 className="size-8" />
              </div>
              <p className="text-xs px-4 text-center">连线图片节点或从图片工具栏生成全景图</p>
            </div>
          )}
          {activeUrl ? (
            <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2">
              <span className="rounded-full bg-foreground/70 px-3 py-1 text-xs text-background backdrop-blur-sm">
                拖动节点 · 双击进入编辑
              </span>
            </div>
          ) : null}
          <button
            type="button"
            className="nodrag absolute top-2 right-2 z-10 flex items-center gap-1 rounded-full border border-border bg-background/80 px-2.5 py-1 text-xs text-muted-foreground shadow-sm backdrop-blur-sm hover:text-foreground disabled:opacity-40"
            disabled={!activeUrl}
            onClick={(e) => {
              e.stopPropagation();
              setFullscreen(true);
            }}
          >
            <Camera className="size-3.5" />
            <span>进入全景</span>
          </button>
        </div>
        <Handle type="target" position={Position.Left} style={{ left: -6, top: '50%', transform: 'translateY(-50%)' }} />
        <Handle type="source" position={Position.Right} style={{ right: -6, top: '50%', transform: 'translateY(-50%)' }} />
      </div>

      <NodePanel cardRef={cardRef} selected={selected} panelW={420}>
        <div className="flex items-center gap-2 px-1 py-0.5">
          <Globe2 className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">全景图</span>
          <span className="text-[11px] text-muted-foreground">{scenes.length} 个场景</span>
          <div className="flex-1" />
          <button
            type="button"
            title="进入全景旋转并发送"
            disabled={!activeUrl}
            onClick={() => setFullscreen(true)}
            className="h-7 px-2.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 disabled:opacity-40 flex items-center gap-1"
          >
            <Camera className="size-3.5" />
            进入
          </button>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto px-1 pb-1">
          {scenes.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">拖线连接图片 / 上传节点</p>
          ) : (
            scenes.map((s, i) => (
              <button
                key={s.edgeId || `${s.url}-${i}`}
                type="button"
                onClick={() => selectScene(i)}
                className="shrink-0 text-left"
              >
                <div
                  className={`w-16 h-10 rounded-lg overflow-hidden border-2 transition-colors ${
                    active === i ? 'border-foreground' : 'border-border'
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.url} alt={s.name} className="w-full h-full object-cover" draggable={false} />
                </div>
                <span
                  className={`block text-[10px] text-center mt-0.5 truncate w-16 ${
                    active === i ? 'text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  {s.name}
                </span>
              </button>
            ))
          )}
        </div>
      </NodePanel>

      <PanoramaFullscreen
        open={fullscreen}
        title={scenes[active]?.name || '全景预览'}
        tip={tip}
        sending={sending}
        canSend={Boolean(activeUrl)}
        containerRef={fsPanoRef}
        onSend={sendCurrentView}
        onClose={() => setFullscreen(false)}
      />
    </div>
  );
}
