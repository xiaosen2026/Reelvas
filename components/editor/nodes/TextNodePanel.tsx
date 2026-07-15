'use client';

// 文本节点底部面板：模型 / 连接图条 / 提示词 / 发送

import { ArrowUp, BookOpen, Brain, Loader2, Sparkles, Square } from 'lucide-react';
import { Dropdown } from './Dropdown';
import { NodePanel } from './NodePanel';
import { UpstreamImageStrip } from './UpstreamImageStrip';
import { THINKING_LABEL, type ThinkingLevel } from './useTextNodeGenerate';

interface Opt {
  value: string;
  label: string;
  desc?: string;
  icon?: React.ReactNode;
}

interface TextNodePanelProps {
  cardRef: React.RefObject<HTMLDivElement | null>;
  selected?: boolean;
  model: string;
  modelOptions: Opt[];
  onModelChange: (v: string) => void;
  recipeId: string;
  recipeOptions: { value: string; label: string }[];
  onRecipeChange: (v: string) => void;
  images: string[];
  localImageSet: Set<string>;
  onAddFiles: (files: FileList) => void;
  onRemoveLocal: (src: string) => void;
  prompt: string;
  onPromptChange: (v: string) => void;
  placeholder: string;
  loading: boolean;
  enhancing: boolean;
  thinking: ThinkingLevel;
  onCycleThinking: () => void;
  onEnhance: () => void;
  onSubmit: () => void;
  onStop: () => void;
}

export function TextNodePanel({
  cardRef,
  selected,
  model,
  modelOptions,
  onModelChange,
  recipeId,
  recipeOptions,
  onRecipeChange,
  images,
  localImageSet,
  onAddFiles,
  onRemoveLocal,
  prompt,
  onPromptChange,
  placeholder,
  loading,
  enhancing,
  thinking,
  onCycleThinking,
  onEnhance,
  onSubmit,
  onStop,
}: TextNodePanelProps) {
  return (
    <NodePanel cardRef={cardRef} selected={selected} panelW={420}>
      <div className="flex items-center gap-1.5">
        <Dropdown value={model} options={modelOptions} onChange={onModelChange} size="md" wide />
        <Dropdown
          value={recipeId}
          options={recipeOptions}
          onChange={onRecipeChange}
          icon={<BookOpen className="size-3.5" />}
        />
      </div>
      {/* 连接识别到的图片：生成时随多模态请求一并提交 */}
      <UpstreamImageStrip
        images={images}
        localSet={localImageSet}
        onAddFiles={onAddFiles}
        onRemoveLocal={onRemoveLocal}
      />
      <div className="relative">
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
              if (loading) onStop();
              else onSubmit();
            }
          }}
          rows={3}
          placeholder={placeholder}
          className="w-full resize-none bg-transparent outline-none text-sm leading-relaxed px-1 placeholder:text-muted-foreground"
        />
        <button
          type="button"
          title="增强提示词"
          disabled={!prompt.trim() || loading || enhancing}
          onClick={onEnhance}
          className="absolute right-1 bottom-1 p-1 rounded-md text-muted-foreground hover:text-primary hover:bg-accent disabled:opacity-40"
        >
          {enhancing ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
        </button>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          title="思考控制：关闭 → 低 → 中 → 高"
          onClick={onCycleThinking}
          disabled={loading}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors disabled:opacity-50 ${
            thinking === 'off' ? 'hover:bg-accent text-muted-foreground' : 'bg-primary/10 text-primary'
          }`}
        >
          <Brain className="size-3.5" />
          <span>思考 · {THINKING_LABEL[thinking]}</span>
        </button>
        <div className="flex-1" />
        <button
          type="button"
          title={loading ? '停止生成' : '发送'}
          aria-label={loading ? '停止生成' : '发送'}
          onClick={() => {
            if (loading) onStop();
            else onSubmit();
          }}
          disabled={!loading && !prompt.trim()}
          className="p-1.5 rounded-full bg-primary text-primary-foreground disabled:opacity-40 hover:opacity-90"
        >
          {loading ? <Square className="size-3.5 fill-current" /> : <ArrowUp className="size-4" />}
        </button>
      </div>
    </NodePanel>
  );
}
