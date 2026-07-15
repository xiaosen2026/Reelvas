'use client';

// 创建脚本底部面板：模式 / 模型 / 输入 / 思考 / 提交

import type { RefObject } from 'react';
import {
  ArrowUp,
  Brain,
  PencilLine,
  ScrollText,
  Sparkles,
  Square,
} from 'lucide-react';
import { Dropdown } from './Dropdown';
import { NodePanel } from './NodePanel';
import { UpstreamImageStrip } from './UpstreamImageStrip';
import {
  SCRIPT_MODE_LABEL,
  scriptPlaceholderForMode,
  type ScriptWorkMode,
} from './scriptPrompt';
import {
  THINKING_LABEL,
  type ThinkingLevel,
} from './useTextNodeGenerate';

export type ScriptModelOption = {
  value: string;
  label: string;
  desc?: string;
  icon?: React.ReactNode;
};

type Props = {
  cardRef: RefObject<HTMLDivElement | null>;
  selected?: boolean;
  model: string;
  modelOptions: ScriptModelOption[];
  onModelChange: (v: string) => void;
  mode: ScriptWorkMode;
  onModeChange: (m: ScriptWorkMode) => void;
  images: string[];
  localImageSet: Set<string>;
  onAddFiles: (files: FileList) => void;
  onRemoveLocal: (src: string) => void;
  prompt: string;
  onPromptChange: (v: string) => void;
  thinking: ThinkingLevel;
  onCycleThinking: () => void;
  loading: boolean;
  actionLabel: string;
  onGenerate: () => void;
  onStop: () => void;
};

export function ScriptNodePanel({
  cardRef,
  selected,
  model,
  modelOptions,
  onModelChange,
  mode,
  onModeChange,
  images,
  localImageSet,
  onAddFiles,
  onRemoveLocal,
  prompt,
  onPromptChange,
  thinking,
  onCycleThinking,
  loading,
  actionLabel,
  onGenerate,
  onStop,
}: Props) {
  return (
    <NodePanel cardRef={cardRef} selected={selected} panelW={440}>
      <div className="flex items-center gap-1.5 px-1">
        <ScrollText className="size-4 text-muted-foreground shrink-0" />
        <span className="text-sm font-medium shrink-0">创建脚本</span>
        <Dropdown value={model} options={modelOptions} onChange={onModelChange} size="md" wide />
      </div>
      <div className="flex items-center gap-1 px-1">
        <button
          type="button"
          disabled={loading}
          onClick={() => onModeChange('create')}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors disabled:opacity-50 ${
            mode === 'create' ? 'bg-primary/10 text-primary' : 'hover:bg-accent text-muted-foreground'
          }`}
        >
          <Sparkles className="size-3.5" />
          {SCRIPT_MODE_LABEL.create}
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => onModeChange('revise')}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors disabled:opacity-50 ${
            mode === 'revise' ? 'bg-primary/10 text-primary' : 'hover:bg-accent text-muted-foreground'
          }`}
        >
          <PencilLine className="size-3.5" />
          {SCRIPT_MODE_LABEL.revise}
        </button>
      </div>
      <UpstreamImageStrip
        images={images}
        localSet={localImageSet}
        onAddFiles={onAddFiles}
        onRemoveLocal={onRemoveLocal}
      />
      <div className="relative px-1">
        <textarea
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && loading) {
              e.preventDefault();
              onStop();
              return;
            }
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onGenerate();
            }
          }}
          rows={4}
          placeholder={scriptPlaceholderForMode(mode)}
          className="nodrag w-full resize-none bg-transparent outline-none text-sm leading-relaxed placeholder:text-muted-foreground"
        />
      </div>
      <div className="flex items-center gap-1.5 px-1">
        <button
          type="button"
          title="思考控制：关闭 → 低 → 中 → 高"
          onClick={onCycleThinking}
          disabled={loading}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors disabled:opacity-50 ${
            thinking === 'off'
              ? 'hover:bg-accent text-muted-foreground'
              : 'bg-primary/10 text-primary'
          }`}
        >
          <Brain className="size-3.5" />
          <span>思考 · {THINKING_LABEL[thinking]}</span>
        </button>
        <div className="flex-1" />
        <button
          type="button"
          title={loading ? '停止' : actionLabel}
          aria-label={loading ? '停止' : actionLabel}
          onClick={onGenerate}
          disabled={!loading && !prompt.trim()}
          className="h-8 px-3 rounded-full bg-primary text-primary-foreground text-xs font-medium disabled:opacity-40 hover:opacity-90 flex items-center gap-1"
        >
          {loading ? (
            <>
              <Square className="size-3.5 fill-current" />
              停止
            </>
          ) : (
            <>
              <ArrowUp className="size-3.5" />
              {actionLabel}
            </>
          )}
        </button>
      </div>
    </NodePanel>
  );
}
