'use client';

// 音频/音乐节点底部面板：歌词/描述 · 风格标题 · 模型参数

import type { RefObject } from 'react';
import { ArrowUp, Loader2, Music, Sparkles, Square } from 'lucide-react';
import { Dropdown } from './Dropdown';
import { NodePanel } from './NodePanel';

type Opt = { value: string; label: string; desc?: string; icon?: React.ReactNode };

const QTY = ['1x', '2x', '3x', '4x'].map((v) => ({ value: v, label: v }));

type Props = {
  cardRef: RefObject<HTMLDivElement | null>;
  selected?: boolean;
  loading: boolean;
  onStop: () => void;
  onSubmit: () => void;
  lyrics: string;
  onLyricsChange: (v: string) => void;
  desc: string;
  onDescChange: (v: string) => void;
  style: string;
  onStyleChange: (v: string) => void;
  title: string;
  onTitleChange: (v: string) => void;
  instrumental: boolean;
  onInstrumentalChange: (v: boolean) => void;
  enhancing: boolean;
  onEnhance: () => void;
  statusError: string;
  model: string;
  modelOptions: Opt[];
  defaultModel: string;
  onModelChange: (v: string) => void;
  qty: string;
  onQtyChange: (v: string) => void;
};

export function AudioNodePanel({
  cardRef,
  selected,
  loading,
  onStop,
  onSubmit,
  lyrics,
  onLyricsChange,
  desc,
  onDescChange,
  style,
  onStyleChange,
  title,
  onTitleChange,
  instrumental,
  onInstrumentalChange,
  enhancing,
  onEnhance,
  statusError,
  model,
  modelOptions,
  defaultModel,
  onModelChange,
  qty,
  onQtyChange,
}: Props) {
  const hasLyrics = lyrics.trim().length > 0;
  const canEnhance = (hasLyrics || desc.trim().length > 0) && !enhancing && !loading;

  return (
    <NodePanel cardRef={cardRef} selected={selected} panelW={560}>
      <div className="flex items-center gap-1.5">
        <Dropdown
          value="audioGeneration"
          options={[{ value: 'audioGeneration', label: '音乐生成' }]}
          onChange={() => {}}
          icon={<Music className="size-4" />}
          size="md"
        />
        <div className="flex-1" />
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
            onClick={() => void onSubmit()}
            title="生成音乐"
            className="p-1.5 rounded-full bg-primary text-primary-foreground hover:opacity-90"
          >
            <ArrowUp className="size-4" />
          </button>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between px-0.5">
          <span className="text-[11px] font-medium text-foreground/80">歌词</span>
          <span className="text-[10px] text-muted-foreground">有歌词时优先使用</span>
        </div>
        <div className="relative rounded-xl border border-border/60 bg-muted/15 focus-within:border-foreground/25 transition-colors">
          <textarea
            value={lyrics}
            onChange={(e) => onLyricsChange(e.target.value)}
            rows={3}
            placeholder="逐行填写歌词，可含 [Verse] / [Chorus] 分段…"
            className="w-full resize-none bg-transparent outline-none text-sm leading-relaxed px-2.5 py-2 pr-10 placeholder:text-muted-foreground"
          />
          <button
            type="button"
            title="增强提示词"
            disabled={!canEnhance}
            onClick={() => void onEnhance()}
            className="absolute bottom-1.5 right-1.5 p-1.5 rounded-lg bg-accent/60 hover:bg-accent text-muted-foreground disabled:opacity-40"
          >
            {enhancing ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between px-0.5">
          <span className="text-[11px] font-medium text-foreground/80">描述</span>
          <span className="text-[10px] text-muted-foreground">
            {hasLyrics ? '已填写歌词，描述暂不可用' : '无歌词时用描述生成'}
          </span>
        </div>
        <textarea
          value={desc}
          onChange={(e) => onDescChange(e.target.value)}
          rows={2}
          disabled={hasLyrics}
          placeholder="例如：轻松流行、女声、适合短剧片尾…"
          className="w-full resize-none rounded-xl border border-border/60 bg-muted/15 outline-none text-sm leading-relaxed px-2.5 py-2 placeholder:text-muted-foreground disabled:opacity-40 disabled:bg-muted/10"
        />
      </div>

      <div className="rounded-xl border border-border/60 bg-muted/20 p-4 flex items-center gap-3">
        <label className="flex flex-col gap-1 flex-[3] min-w-0">
          <span className="text-[10px] font-medium text-muted-foreground px-0.5">风格标签</span>
          <input
            value={style}
            onChange={(e) => onStyleChange(e.target.value)}
            placeholder="pop, rock, cinematic"
            className="w-full min-w-0 rounded-lg border border-border/60 bg-card/70 outline-none text-sm px-3 py-2.5 placeholder:text-muted-foreground"
          />
        </label>
        <label className="flex flex-col gap-1 flex-[2] min-w-0">
          <span className="text-[10px] font-medium text-muted-foreground px-0.5">歌曲标题</span>
          <input
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="可选"
            className="w-full min-w-0 rounded-lg border border-border/60 bg-card/70 outline-none text-sm px-3 py-2.5 placeholder:text-muted-foreground"
          />
        </label>
        <button
          type="button"
          onClick={() => onInstrumentalChange(!instrumental)}
          title={instrumental ? '纯音乐已开 · 无人声' : '纯音乐关闭 · 可含人声'}
          className={`shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs transition-colors ${
            instrumental
              ? 'bg-foreground text-background'
              : 'border border-border/60 text-muted-foreground hover:bg-accent hover:text-foreground'
          }`}
        >
          <Music className="size-4 shrink-0" />
          <span className="whitespace-nowrap">纯音乐</span>
        </button>
        <span className="w-px h-8 bg-border/60 shrink-0" />
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] font-medium text-muted-foreground/70">模型</span>
          <Dropdown
            value={model}
            options={modelOptions.length ? modelOptions : [{ value: defaultModel, label: defaultModel }]}
            onChange={onModelChange}
            wide
          />
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] font-medium text-muted-foreground/70">数量</span>
          <Dropdown value={qty} options={QTY} onChange={onQtyChange} />
        </div>
      </div>

      {statusError && !loading ? (
        <p className="text-[11px] text-red-500 px-1 line-clamp-2">{statusError}</p>
      ) : null}
    </NodePanel>
  );
}
