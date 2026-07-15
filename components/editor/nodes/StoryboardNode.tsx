'use client';

// 分镜格子：上游入图 / 本地填格 / 邻格交换 / 合成发送

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  ArrowUpDown,
  Eraser,
  LayoutGrid,
  Plus,
  Send,
} from 'lucide-react';
import { Handle, Position, useFlow } from '../flow';
import { NodePanel } from './NodePanel';
import { spawnUploadCaptures } from './spawnUploadCaptures';
import {
  ASPECT_OPTIONS,
  GRID_OPTIONS,
  buildStoryboardFileName,
  gridDims,
  mergeStoryboardPng,
  type StoryAspect,
  type StoryGrid,
} from './storyboardGrid';
import { useStoryboardSlots } from './useStoryboardSlots';
import { createLogger } from '@/lib/logger';

const log = createLogger('StoryboardNode');

interface NodeProps {
  id: string;
  data: Record<string, any>;
  selected?: boolean;
}

export function StoryboardNode({ id, data, selected }: NodeProps) {
  const rf = useFlow();
  const label = data.label || '分镜格子';
  const cardRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pickSlotRef = useRef<number | null>(null);

  const {
    aspect, grid, n, slots, localUrls,
    setAspect, setGrid, onSwap, clearAll, fillLocal,
  } = useStoryboardSlots(id, data);

  const { cols, rows } = useMemo(() => gridDims(grid), [grid]);
  const [sending, setSending] = useState(false);
  const [tip, setTip] = useState('');

  const pickSlot = useCallback((i: number) => {
    pickSlotRef.current = i;
    fileRef.current?.click();
  }, []);

  const onFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      const i = pickSlotRef.current;
      pickSlotRef.current = null;
      if (!file || i == null || i < 0 || i >= n) return;
      if (!file.type.startsWith('image/')) {
        setTip('仅支持图片文件');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const url = String(reader.result || '');
        if (!url) return;
        fillLocal(i, url);
        log.info('localFill', 'ok', { id, i, name: file.name });
      };
      reader.readAsDataURL(file);
    },
    [fillLocal, id, n],
  );

  const onClear = useCallback(() => {
    if (!window.confirm('清空全部分镜格子？')) return;
    clearAll();
    setTip('');
  }, [clearAll]);

  const sendMerge = useCallback(async () => {
    if (sending) return;
    if (!slots.some(Boolean)) {
      setTip('请先连入图片节点或点击格子上传');
      return;
    }
    setSending(true);
    setTip('');
    try {
      const dataUrl = await mergeStoryboardPng({ slots, grid, aspect });
      const fileName = buildStoryboardFileName();
      const withLocal = rf.getNodes().map((node) =>
        node.id === id
          ? {
              ...node,
              data: {
                ...node.data,
                slots,
                localUrls,
                aspect,
                grid,
                imageUrl: dataUrl,
                thumbnailUrl: dataUrl,
                value: dataUrl,
                content: fileName,
              },
            }
          : node,
      );
      const result = spawnUploadCaptures({
        sourceId: id,
        captures: [{ dataUrl, fileName }],
        nodes: withLocal,
        edges: rf.getEdges(),
      });
      if (!result) {
        rf.setNodes(() => withLocal);
        setTip('已合成，创建上传节点失败');
        return;
      }
      rf.setNodes(() => result.nodes);
      rf.setEdges(() => result.edges);
      setTip('');
      log.info('sendMerge', 'ok', { id, filled: slots.filter(Boolean).length, fileName });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setTip(`合成失败：${msg}`);
      log.error('sendMerge', 'fail', { id, error: msg });
    } finally {
      setSending(false);
    }
  }, [sending, slots, grid, aspect, id, rf, localUrls]);

  return (
    <div className="relative group w-full h-full flex flex-col gap-2">
      <div className="absolute left-0 bottom-full pb-1.5 flex items-center gap-1.5">
        <LayoutGrid className="size-3 text-muted-foreground" />
        <span className="text-[11px] text-muted-foreground font-medium tracking-wide">{label}</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded-md border border-border text-muted-foreground">
          {grid} · {aspect}
        </span>
      </div>

      <div className="relative w-full flex-1 min-h-40" ref={cardRef}>
        <div
          className={`relative bg-card border rounded-2xl w-full h-full overflow-hidden flex flex-col transition-[box-shadow,border-color] duration-200 cursor-move ${
            selected ? 'ring-2 ring-zinc-500' : 'border-border/80'
          }`}
        >
          <div className="flex-1 min-h-0 p-2">
            <div
              className="relative w-full h-full rounded-xl border border-teal-400/70 bg-zinc-900/90 overflow-hidden"
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${cols}, 1fr)`,
                gridTemplateRows: `repeat(${rows}, 1fr)`,
              }}
            >
              {slots.map((src, i) => {
                const col = i % cols;
                const row = Math.floor(i / cols);
                return (
                  <div key={`c-${i}`} className="relative border border-white/5 min-h-0 min-w-0">
                    {src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={src} alt="" className="absolute inset-0 w-full h-full object-cover pointer-events-none" draggable={false} />
                    ) : (
                      <button
                        type="button"
                        className="nodrag absolute inset-0 flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/5"
                        onClick={(e) => { e.stopPropagation(); pickSlot(i); }}
                        title="上传到此格"
                      >
                        <Plus className="size-5" />
                      </button>
                    )}
                    {col < cols - 1 ? (
                      <button
                        type="button"
                        title="与右格交换"
                        className="nodrag absolute z-10 top-1/2 -translate-y-1/2 right-0 translate-x-1/2 size-5 rounded-full bg-card border border-border text-muted-foreground hover:text-foreground flex items-center justify-center shadow-sm"
                        onClick={(e) => { e.stopPropagation(); onSwap(i, i + 1); }}
                      >
                        <ArrowLeftRight className="size-3" />
                      </button>
                    ) : null}
                    {row < rows - 1 ? (
                      <button
                        type="button"
                        title="与下格交换"
                        className="nodrag absolute z-10 left-1/2 -translate-x-1/2 bottom-0 translate-y-1/2 size-5 rounded-full bg-card border border-border text-muted-foreground hover:text-foreground flex items-center justify-center shadow-sm"
                        onClick={(e) => { e.stopPropagation(); onSwap(i, i + cols); }}
                      >
                        <ArrowUpDown className="size-3" />
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <Handle type="target" position={Position.Left} style={{ left: -6, top: '50%', transform: 'translateY(-50%)' }} />
        <Handle type="source" position={Position.Right} style={{ right: -6, top: '50%', transform: 'translateY(-50%)' }} />
      </div>

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />

      <NodePanel cardRef={cardRef} selected={selected} panelW={400}>
        <div className="flex items-center gap-2 px-1 py-0.5 flex-wrap">
          <LayoutGrid className="size-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium">分镜格子</span>
          <select
            className="nodrag h-7 rounded-lg border border-border bg-background px-1.5 text-xs"
            value={aspect}
            onChange={(e) => setAspect(e.target.value as StoryAspect)}
          >
            {ASPECT_OPTIONS.map((a) => (
              <option key={a} value={a}>比例 {a}</option>
            ))}
          </select>
          <select
            className="nodrag h-7 rounded-lg border border-border bg-background px-1.5 text-xs"
            value={grid}
            onChange={(e) => setGrid(e.target.value as StoryGrid)}
          >
            {GRID_OPTIONS.map((g) => (
              <option key={g} value={g}>网格 {g}</option>
            ))}
          </select>
          <div className="flex-1" />
          <button type="button" className="h-7 px-2 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground flex items-center gap-1" onClick={onClear}>
            <Eraser className="size-3.5" />清空
          </button>
          <button
            type="button"
            disabled={sending}
            className="h-7 px-2.5 rounded-lg bg-foreground text-background text-xs font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-1"
            onClick={() => void sendMerge()}
          >
            <Send className="size-3.5" />
            {sending ? '合成中…' : '发送合并'}
          </button>
        </div>
        <p className="px-1 text-xs text-muted-foreground">
          左侧连入图片自动填格；格边界双向箭头交换位置；发送合并输出一张图。
        </p>
        {tip ? <p className="px-1 text-xs text-amber-600">{tip}</p> : null}
      </NodePanel>
    </div>
  );
}
