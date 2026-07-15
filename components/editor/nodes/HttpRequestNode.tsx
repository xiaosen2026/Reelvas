'use client';

// HTTP 请求节点骨架 — 外部 API / Webhook / 内部服务
// TODO: 补齐编辑面板（URL / Method / Headers / Body / 响应映射）

import { useMemo, useRef } from 'react';
import { Globe } from 'lucide-react';
import { Handle, Position } from '../flow';
import { NodePanel } from './NodePanel';
import { UpstreamImageStrip } from './UpstreamImageStrip';
import { useUpstreamImages } from './useUpstreamImages';

interface NodeProps {
  id: string;
  data: Record<string, any>;
  selected?: boolean;
}

export function HttpRequestNode({ id, data, selected }: NodeProps) {
  const label = data['label'] || 'HTTP';
  const cardRef = useRef<HTMLDivElement>(null);
  const upImages = useUpstreamImages(id);
  const localImageSet = useMemo(() => new Set(upImages.local), [upImages.local]);

  return (
    <div className="relative group w-full h-full flex flex-col gap-2">
      <div className="absolute left-0 bottom-full pb-1.5 flex items-center gap-1.5">
        <span className="text-[11px] text-muted-foreground font-medium tracking-wider uppercase">{label}</span>
        <button className="text-muted-foreground hover:text-foreground text-sm leading-none">+</button>
      </div>

      <div className="relative w-full flex-1 min-h-40" ref={cardRef}>
        <div className={`bg-card border rounded-2xl w-full h-full overflow-hidden flex items-center justify-center transition-[box-shadow,border-color] duration-200 cursor-move ${selected ? 'ring-2 ring-zinc-500' : 'border-border/80'}`}>
          <div className="flex items-center justify-center size-16 rounded-2xl bg-muted/50">
            <Globe className="size-8 text-muted-foreground" />
          </div>
        </div>
        <Handle type="target" position={Position['Left']} style={{ left: -6, top: '50%', transform: 'translateY(-50%)' }} />
        <Handle type="source" position={Position['Right']} style={{ right: -6, top: '50%', transform: 'translateY(-50%)' }} />
      </div>

      <NodePanel cardRef={cardRef} selected={selected} panelW={420}>
        <div className="flex items-center gap-2 px-1 py-1">
          <Globe className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">HTTP 请求</span>
        </div>
        <UpstreamImageStrip
          images={upImages.imageSrcs}
          localSet={localImageSet}
          onAddFiles={upImages.addLocalFiles}
          onRemoveLocal={upImages.removeLocal}
        />
        <p className="px-1 text-xs text-muted-foreground">骨架节点 — URL / Method / Headers / Body 待实现</p>
      </NodePanel>
    </div>
  );
}
