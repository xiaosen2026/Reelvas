'use client';

// 扩图节点底部面板：模型 / 打开全屏编辑 / 摘要 / 生成

import type { RefObject } from 'react';
import { ArrowUp, Expand, Square } from 'lucide-react';
import { NodePanel } from './NodePanel';
import { Dropdown, type DropdownOption } from './Dropdown';
import { UpstreamImageStrip } from './UpstreamImageStrip';
import { formatPadsLabel, type ExpandPads } from './buildGreenScreenCanvas';

type Props = {
  cardRef: RefObject<HTMLDivElement | null>;
  selected?: boolean;
  loading: boolean;
  canEdit: boolean;
  onOpenEditor: () => void;
  onStop: () => void;
  onSubmit: () => void;
  images: string[];
  localImageSet: Set<string>;
  onAddFiles: (files: FileList) => void;
  onRemoveLocal: (src: string) => void;
  pads: ExpandPads;
  hasResult: boolean;
  error: string;
  model: string;
  modelOptions: DropdownOption[];
  defaultModel: string;
  onModelChange: (v: string) => void;
};

export function OutpaintNodePanel({
  cardRef,
  selected,
  loading,
  canEdit,
  onOpenEditor,
  onStop,
  onSubmit,
  images,
  localImageSet,
  onAddFiles,
  onRemoveLocal,
  pads,
  hasResult,
  error,
  model,
  modelOptions,
  defaultModel,
  onModelChange,
}: Props) {
  return (
    <NodePanel cardRef={cardRef} selected={selected} panelW={360}>
      <div className="flex items-center gap-2 px-1">
        <Expand className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium">扩图</span>
        <div className="flex-1" />
        <button
          type="button"
          title="进入扩图编辑（也可双击卡片）"
          disabled={!canEdit}
          onClick={onOpenEditor}
          className="h-7 px-2.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 disabled:opacity-40 flex items-center gap-1"
        >
          <Expand className="size-3.5" />
          扩图编辑
        </button>
        {loading ? (
          <button
            type="button"
            title="停止"
            onClick={onStop}
            className="p-1.5 rounded-full border border-border text-muted-foreground hover:text-foreground"
          >
            <Square className="size-3.5 fill-current" />
          </button>
        ) : (
          <button
            type="button"
            title="生成扩图"
            disabled={!canEdit}
            onClick={() => void onSubmit()}
            className="p-1.5 rounded-full bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40"
          >
            <ArrowUp className="size-4" />
          </button>
        )}
      </div>

      <UpstreamImageStrip
        images={images}
        localSet={localImageSet}
        onAddFiles={onAddFiles}
        onRemoveLocal={onRemoveLocal}
      />

      <div className="flex items-center gap-2 px-1 min-w-0">
        <Dropdown
          value={model}
          options={modelOptions.length ? modelOptions : [{ value: defaultModel, label: defaultModel }]}
          onChange={onModelChange}
          wide
        />
        <div className="flex-1" />
        <span className="shrink-0 text-[11px] font-mono text-foreground/80">{formatPadsLabel(pads)}</span>
      </div>

      <p className="px-1 text-[10px] text-muted-foreground leading-relaxed">
        右上角「放大」仅预览；双击卡片或点「扩图编辑」才进入拖边绿幕编辑。
        {hasResult ? ' 已有生成结果。' : ''}
      </p>

      {error ? <p className="px-1 text-[10px] text-red-500 line-clamp-4">{error}</p> : null}
    </NodePanel>
  );
}
