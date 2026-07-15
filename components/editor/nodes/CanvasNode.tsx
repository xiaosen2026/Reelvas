'use client';

// 画板节点 — 卡片只读预览 + 双击全屏作画 + 发送输出 PNG

import { useCallback, useMemo, useRef, useState } from 'react';
import { Maximize2, PaintBucket, Send } from 'lucide-react';
import { Handle, Position, useFlow } from '../flow';
import { NodePanel } from './NodePanel';
import { UpstreamImageStrip } from './UpstreamImageStrip';
import { useUpstreamImages } from './useUpstreamImages';
import { CanvasFullscreen } from './CanvasFullscreen';
import {
  buildCanvasFileName,
  exportPngDataUrl,
  parseCanvasEls,
  type CanvasEl,
} from './canvasDrawing';
import { spawnUploadCaptures } from './spawnUploadCaptures';
import { createLogger } from '@/lib/logger';

const log = createLogger('CanvasNode');

interface NodeProps {
  id: string;
  data: {
    label?: string;
    value?: string;
    imageUrl?: string;
    thumbnailUrl?: string;
    strokes?: unknown;
    content?: string;
  };
  selected?: boolean;
}

export function CanvasNode({ id, data, selected }: NodeProps) {
  const rf = useFlow();
  const label = data.label || 'CANVAS';
  const cardRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [sending, setSending] = useState(false);
  const [tip, setTip] = useState('');

  const strokes = useMemo(() => parseCanvasEls(data.strokes), [data.strokes]);
  const previewUrl = data.imageUrl || data.thumbnailUrl || data.value || '';
  const upImages = useUpstreamImages(id);
  const localImageSet = useMemo(() => new Set(upImages.local), [upImages.local]);

  const openEditor = useCallback(() => {
    setTip('');
    setFullscreen(true);
    log.info('openEditor', 'ok', { id, strokes: strokes.length });
  }, [id, strokes.length]);

  const persistStrokesAndImage = useCallback(
    (els: CanvasEl[], imageDataUrl: string) => {
      rf.setNodes((nds) =>
        nds.map((n) =>
          n.id === id
            ? {
                ...n,
                data: {
                  ...n.data,
                  strokes: els,
                  imageUrl: imageDataUrl,
                  thumbnailUrl: imageDataUrl,
                  value: imageDataUrl,
                  content: buildCanvasFileName(),
                },
              }
            : n,
        ),
      );
    },
    [id, rf],
  );

  const sendDrawing = useCallback(
    (els: CanvasEl[]) => {
      if (sending) return;
      setSending(true);
      setTip('');
      try {
        if (!els.length) {
          setTip('请先作画再发送');
          log.warn('sendDrawing', 'empty', { id });
          return;
        }
        const dataUrl = exportPngDataUrl(els);
        if (!dataUrl) {
          setTip('导出失败');
          log.warn('sendDrawing', 'export empty', { id });
          return;
        }
        const fileName = buildCanvasFileName();
        const withLocal = rf.getNodes().map((n) =>
          n.id === id
            ? {
                ...n,
                data: {
                  ...n.data,
                  strokes: els,
                  imageUrl: dataUrl,
                  thumbnailUrl: dataUrl,
                  value: dataUrl,
                  content: fileName,
                },
              }
            : n,
        );
        const result = spawnUploadCaptures({
          sourceId: id,
          captures: [{ dataUrl, fileName }],
          nodes: withLocal,
          edges: rf.getEdges(),
          thumbField: 'thumbnailUrl',
        });
        if (!result) {
          persistStrokesAndImage(els, dataUrl);
          setTip('已保存预览，但创建上传节点失败');
          log.warn('sendDrawing', 'spawn null', { id });
          return;
        }
        rf.setNodes(() => result.nodes);
        rf.setEdges(() => result.edges);
        setFullscreen(false);
        setTip('');
        log.info('sendDrawing', 'ok', { id, fileName, n: result.spawned, strokes: els.length });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setTip(`发送失败：${msg}`);
        log.error('sendDrawing', 'fail', { id, error: msg });
      } finally {
        setSending(false);
      }
    },
    [id, persistStrokesAndImage, rf, sending],
  );

  return (
    <div className="relative group w-full h-full flex flex-col gap-2">
      <div className="absolute left-0 bottom-full pb-1.5 flex items-center gap-1.5">
        <PaintBucket className="size-3 text-muted-foreground" />
        <span className="text-[11px] text-muted-foreground font-medium tracking-wider uppercase">
          {label}
        </span>
        {previewUrl ? (
          <span className="text-[10px] px-1.5 py-0.5 rounded-md border border-border text-muted-foreground">
            已输出
          </span>
        ) : null}
      </div>

      <div className="relative w-full flex-1 min-h-40" ref={cardRef}>
        <div
          className={`relative bg-card border rounded-2xl w-full h-full overflow-hidden flex flex-col cursor-move transition-[box-shadow,border-color] duration-200 ${
            selected ? 'ring-2 ring-zinc-500' : 'border-border/80'
          }`}
          onDoubleClick={(e) => {
            e.stopPropagation();
            openEditor();
          }}
        >
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="画板预览"
              className="absolute inset-0 w-full h-full object-contain bg-white pointer-events-none select-none"
              draggable={false}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <div className="flex items-center justify-center size-16 rounded-2xl bg-muted/50">
                <PaintBucket className="size-8" />
              </div>
              <p className="text-xs px-4 text-center">双击进入作画 · 发送输出图片</p>
            </div>
          )}
          <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2">
            <span className="rounded-full bg-foreground/70 px-3 py-1 text-xs text-background backdrop-blur-sm">
              拖动节点 · 双击全屏作画
            </span>
          </div>
          <button
            type="button"
            className="nodrag absolute top-2 right-2 z-10 flex items-center gap-1 rounded-full border border-border bg-background/80 px-2.5 py-1 text-xs text-muted-foreground shadow-sm backdrop-blur-sm hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              openEditor();
            }}
          >
            <Maximize2 className="size-3.5" />
            <span>编辑</span>
          </button>
        </div>
        <Handle type="target" position={Position.Left} style={{ left: -6, top: '50%', transform: 'translateY(-50%)' }} />
        <Handle type="source" position={Position.Right} style={{ right: -6, top: '50%', transform: 'translateY(-50%)' }} />
      </div>

      <NodePanel cardRef={cardRef} selected={selected} panelW={320}>
        <div className="flex items-center gap-2 px-1 py-0.5">
          <PaintBucket className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">画板</span>
          <span className="text-[11px] text-muted-foreground">
            {strokes.length ? `${strokes.length} 笔迹` : '空白'}
          </span>
          <div className="flex-1" />
          <button
            type="button"
            onClick={openEditor}
            className="h-7 px-2.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 flex items-center gap-1"
          >
            <Maximize2 className="size-3.5" />
            全屏作画
          </button>
        </div>
        <UpstreamImageStrip
          images={upImages.imageSrcs}
          localSet={localImageSet}
          onAddFiles={upImages.addLocalFiles}
          onRemoveLocal={upImages.removeLocal}
        />
        <p className="px-1 text-xs text-muted-foreground">
          双击卡片进入编辑；画完后点「发送到画布」导出 PNG（上传节点）。
        </p>
        {previewUrl ? (
          <button
            type="button"
            onClick={openEditor}
            className="mx-1 mt-1 h-8 rounded-lg bg-foreground text-background text-xs font-medium hover:opacity-90 flex items-center justify-center gap-1.5"
          >
            <Send className="size-3.5" />
            继续编辑 / 再发送
          </button>
        ) : null}
      </NodePanel>

      <CanvasFullscreen
        open={fullscreen}
        title={label}
        initialEls={strokes}
        tip={tip}
        sending={sending}
        onSend={sendDrawing}
        onClose={() => {
          setFullscreen(false);
          setTip('');
        }}
      />
    </div>
  );
}
