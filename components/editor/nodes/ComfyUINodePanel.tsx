'use client';

// ComfyUI 节点面板：选择工作流 → 自动识别变量 → 提交

import type { RefObject } from 'react';
import { ArrowUp, Square, Workflow, Variable, Image, FileText, Video, Music } from 'lucide-react';
import { NodePanel } from './NodePanel';
import { Dropdown } from './Dropdown';
import type { ComfyWorkflowItem } from '@/lib/comfyWorkflowStore';

type Props = {
  cardRef: RefObject<HTMLDivElement | null>;
  selected?: boolean;
  loading: boolean;
  onStop: () => void;
  onSubmit: () => void;
  selectedWfId: string;
  workflows: ComfyWorkflowItem[];
  onSelectWorkflow: (id: string) => void;
  discoveredVars: string[];
  varValues: Record<string, string>;
  onVarValueChange: (key: string, val: string) => void;
  outputType: 'image' | 'text' | 'video' | 'audio' | 'unknown';
  statusError: string;
};

const outputIcons: Record<string, React.ReactNode> = {
  image: <Image className="size-3.5" />,
  text: <FileText className="size-3.5" />,
  video: <Video className="size-3.5" />,
  audio: <Music className="size-3.5" />,
};

export function ComfyUINodePanel({
  cardRef,
  selected,
  loading,
  onStop,
  onSubmit,
  selectedWfId,
  workflows,
  onSelectWorkflow,
  discoveredVars,
  varValues,
  onVarValueChange,
  outputType,
  statusError,
}: Props) {
  const wfOptions = workflows.map((w) => ({ value: w.id, label: w.name }));

  return (
    <NodePanel cardRef={cardRef} selected={selected} panelW={480}>
      <div className="flex items-center gap-1.5">
        <Workflow className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium">ComfyUI</span>
        {outputType !== 'unknown' && outputIcons[outputType] ? (
          <span className="inline-flex items-center gap-0.5 rounded-full border border-border/60 bg-muted/30 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {outputIcons[outputType]}
            {outputType}
          </span>
        ) : null}
        <div className="flex-1" />
        {loading ? (
          <button type="button" title="停止" onClick={onStop} className="p-1.5 rounded-full border border-border text-muted-foreground hover:text-foreground">
            <Square className="size-3.5 fill-current" />
          </button>
        ) : (
          <button type="button" onClick={() => void onSubmit()} title="提交到 ComfyUI" className="p-1.5 rounded-full bg-primary text-primary-foreground hover:opacity-90">
            <ArrowUp className="size-4" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-muted/15 px-2 py-1">
        <Workflow className="size-3.5 text-muted-foreground shrink-0" />
        <Dropdown
          value={selectedWfId}
          options={wfOptions.length ? wfOptions : [{ value: '', label: '暂无工作流' }]}
          onChange={onSelectWorkflow}
          wide
        />
      </div>

      {discoveredVars.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1 px-0.5">
            <Variable className="size-3 text-muted-foreground" />
            <span className="text-[11px] font-medium text-foreground/80">输入变量</span>
            <span className="text-[10px] text-muted-foreground">{discoveredVars.length} 个</span>
          </div>
          {discoveredVars.map((key) => (
            <div key={key} className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-right text-[11px] font-semibold text-foreground">{key}</span>
              <input
                value={varValues[key] || ''}
                onChange={(e) => onVarValueChange(key, e.target.value)}
                placeholder="请输入你的内容"
                className="flex-1 min-w-0 rounded-lg border border-border/60 bg-muted/15 px-2.5 py-1.5 outline-none text-xs placeholder:text-muted-foreground focus:border-foreground/25 transition-colors"
              />
            </div>
          ))}
        </div>
      ) : selectedWfId ? (
        <p className="text-xs text-muted-foreground px-0.5">该工作流无需输入变量</p>
      ) : null}

      {statusError ? (
        <p className="text-[11px] text-red-500 px-1 line-clamp-2">{statusError}</p>
      ) : null}
    </NodePanel>
  );
}
