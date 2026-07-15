'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { Box, Camera, ArrowUp } from 'lucide-react';
import { Handle, Position, useFlow } from '../flow';
import type { FlowEdge, FlowNode } from '../flow/types';
import { Dropdown } from './Dropdown';
import { NodePanel } from './NodePanel';
import { UpstreamImageStrip } from './UpstreamImageStrip';
import { useUpstreamImages } from './useUpstreamImages';
import {
  DirectorDeskEmbed,
  type DirectorDeskCapture,
} from '../DirectorDeskEmbed';
import { buildLinkedSpawn, mergeSpawnEdge, mergeSpawnNode } from './spawnLinkedNode';
import { nodeConfigs } from './index';
import { createLogger } from '@/lib/logger';

const log = createLogger('ThreeDNode');

function mimeFromDataUrl(url: string): string {
  const m = /^data:([^;,]+)/i.exec(url);
  return m?.[1] || 'image/png';
}

interface NodeProps {
  id: string;
  data: {
    label?: string;
    content?: string;
    thumbnailUrl?: string;
    value?: string;
  };
  selected?: boolean;
}

/** 3D 导演台节点：卡片预览 + 嵌入开源 storyai-3d-director-desk（iframe） */
export function ThreeDNode({ id, data, selected }: NodeProps) {
  const rawLabel = data.label || '3D导演台';
  const label = /^3D(?:节点)?(\d+)$/i.test(rawLabel)
    ? rawLabel.replace(/^3D(?:节点)?/i, '3D导演台')
    : rawLabel;
  const cardRef = useRef<HTMLDivElement>(null);
  const rf = useFlow();
  const [open, setOpen] = useState(false);
  const thumb = data.thumbnailUrl || '';
  const upImages = useUpstreamImages(id);
  const localImageSet = useMemo(() => new Set(upImages.local), [upImages.local]);

  const openDesk = useCallback(() => {
    setOpen(true);
    log.info('openDesk', '打开开源 3D 导演台', { id });
  }, [id]);

  const handleCaptures = useCallback(
    (captures: DirectorDeskCapture[]) => {
      const list = captures.filter((c) => Boolean(c?.dataUrl));
      if (!list.length) return;

      const first = list[0];
      const source = rf.getNodes().find((n) => n.id === id);
      if (!source) {
        log.warn('handleCaptures', '源节点不存在', { id });
        return;
      }

      const uploadH = nodeConfigs.upload?.height ?? 240;
      const gapY = 16;
      const usedN = new Set(rf.getNodes().map((n) => n.id));
      const usedE = new Set(rf.getEdges().map((e) => e.id));
      let nextNodes: FlowNode[] = rf.getNodes();
      let nextEdges: FlowEdge[] = rf.getEdges();
      let spawned = 0;

      list.forEach((cap, i) => {
        const fileName = cap.fileName || `director-desk-capture-${i + 1}.png`;
        const fileType = mimeFromDataUrl(cap.dataUrl);
        const result = buildLinkedSpawn({
          source,
          menuType: 'upload',
          gapY: i * (uploadH + gapY),
          data: {
            label: fileName.replace(/\.[^.]+$/, '') || '上传',
            fileUrl: cap.dataUrl,
            fileType,
            fileName,
            mediaKind: fileType.startsWith('image/')
              ? 'image'
              : fileType.startsWith('video/')
                ? 'video'
                : fileType.startsWith('audio/')
                  ? 'audio'
                  : 'file',
            value: cap.dataUrl,
            imageUrl: fileType.startsWith('image/') ? cap.dataUrl : undefined,
          },
          existingNodeIds: usedN,
          existingEdgeIds: usedE,
          selectNew: i === list.length - 1,
        });
        if (!result) return;
        usedN.add(result.node.id);
        usedE.add(result.edge.id);
        nextNodes = mergeSpawnNode(nextNodes, result.node, i === list.length - 1);
        nextEdges = mergeSpawnEdge(nextEdges, result.edge);
        spawned += 1;
      });

      nextNodes = nextNodes.map((n) =>
        n.id === id
          ? {
              ...n,
              data: {
                ...n.data,
                thumbnailUrl: first.dataUrl,
                value: first.dataUrl,
                content: first.fileName || 'director-desk-capture.png',
              },
            }
          : n,
      );

      rf.setNodes(() => nextNodes);
      rf.setEdges(() => nextEdges);
      setOpen(false);
      log.info('handleCaptures', '已发送到画布上传节点', {
        id,
        n: spawned,
        fileName: first.fileName,
      });
    },
    [id, rf],
  );

  return (
    <div className="relative group flex h-full w-full flex-col gap-2">
      <div className="absolute bottom-full left-0 flex items-center gap-1.5 pb-1.5">
        <span className="text-[11px] font-medium tracking-wide text-muted-foreground">{label}</span>
      </div>

      <div className="relative min-h-50 w-full flex-1" ref={cardRef}>
        <div
          className={`relative h-full w-full cursor-grab overflow-hidden rounded-2xl border bg-card transition-[box-shadow,border-color] duration-200 active:cursor-grabbing ${
            selected ? 'ring-2 ring-zinc-500' : 'border-border/80'
          }`}
          onDoubleClick={(e) => {
            e.stopPropagation();
            openDesk();
          }}
          onDragStart={(e) => e.preventDefault()}
        >
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumb}
              alt="3D 预览"
              draggable={false}
              className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover"
            />
          ) : (
            <>
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  backgroundImage:
                    'linear-gradient(to right, rgba(120,150,200,0.15) 1px, transparent 1px), linear-gradient(to bottom, rgba(120,150,200,0.15) 1px, transparent 1px)',
                  backgroundSize: '32px 32px',
                }}
              />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <Box className="size-16 text-sky-400/70" strokeWidth={1.2} />
              </div>
            </>
          )}

          <button
            type="button"
            className="nodrag absolute top-2 right-2 z-10 flex items-center gap-1 rounded-full border border-border bg-background/80 px-2.5 py-1 text-xs text-muted-foreground shadow-sm backdrop-blur-sm hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              openDesk();
            }}
          >
            <Camera className="size-3.5" />
            <span>打开导演台</span>
          </button>

          <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2">
            <span className="rounded-full bg-foreground/70 px-3 py-1 text-xs text-background backdrop-blur-sm">
              双击进入开源 3D 导演台
            </span>
          </div>
        </div>

        <Handle type="target" position={Position.Left} style={{ left: -6, top: '50%', transform: 'translateY(-50%)' }} />
        <Handle type="source" position={Position.Right} style={{ right: -6, top: '50%', transform: 'translateY(-50%)' }} />
      </div>

      <NodePanel cardRef={cardRef} selected={selected} panelW={420}>
        <div className="flex items-center gap-1.5">
          <Dropdown
            value="director"
            options={[{ value: 'director', label: '3D 导演台' }]}
            onChange={() => {}}
            icon={<Box className="size-4" />}
            size="md"
          />
          <div className="flex-1" />
          <button
            type="button"
            className="rounded-full bg-muted p-1.5 text-muted-foreground hover:bg-accent"
            onClick={openDesk}
            title="打开导演台"
          >
            <ArrowUp className="size-4" />
          </button>
        </div>
        <UpstreamImageStrip
          images={upImages.imageSrcs}
          localSet={localImageSet}
          onAddFiles={upImages.addLocalFiles}
          onRemoveLocal={upImages.removeLocal}
        />
        <p className="px-1 text-[10px] text-muted-foreground">
          连接/添加参考图，便于后续导入导演台（当前仅预览识别）。
        </p>
      </NodePanel>

      <DirectorDeskEmbed
        open={open}
        instanceId={id}
        onClose={() => setOpen(false)}
        onCaptures={handleCaptures}
      />
    </div>
  );
}
