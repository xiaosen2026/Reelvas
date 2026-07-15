'use client';

// 视频节点底部面板：模式 Tab · 连接图条 · 提示词 · 模型参数

import { useMemo, useRef, useState, type RefObject } from 'react';
import { ArrowUp, Loader2, Sparkles, Square, Video as VideoIcon } from 'lucide-react';
import { Dropdown } from './Dropdown';
import { NodePanel } from './NodePanel';
import { UpstreamImageStrip } from './UpstreamImageStrip';
import { VideoParamsBar, type VideoCustomParams } from './VideoParamsBar';
import { VideoMentionDropdown, type MentionImage } from './VideoMentionDropdown';
import { VideoPromptInput, replaceAtCursor } from './VideoPromptInput';

export type VideoGenMode = '全能参考' | '文生视频' | '首帧' | '首尾帧';

export const VIDEO_GEN_MODES: VideoGenMode[] = ['全能参考', '文生视频', '首帧', '首尾帧'];

/** 按图片数量判断模式是否可用（对齐 cava） */
export function videoModeAllowed(mode: VideoGenMode, imageCount: number): boolean {
  if (mode === '文生视频') return imageCount === 0;
  if (mode === '首帧') return imageCount === 1;
  if (mode === '首尾帧') return imageCount === 2;
  if (mode === '全能参考') return imageCount >= 1;
  return false;
}

/** 图片数量变化时回落到合法模式 */
export function pickVideoMode(imageCount: number, preferred?: VideoGenMode): VideoGenMode {
  if (preferred && videoModeAllowed(preferred, imageCount)) return preferred;
  if (imageCount === 0) return '文生视频';
  if (imageCount === 1) return '首帧';
  if (imageCount === 2) return '首尾帧';
  return '全能参考';
}

/** 按模式裁剪提交用的图片列表 */
export function imagesForVideoMode(mode: VideoGenMode, images: string[]): string[] {
  if (mode === '文生视频') return [];
  if (mode === '首帧') return images.slice(0, 1);
  if (mode === '首尾帧') return images.slice(0, 2);
  return images;
}

type Opt = { value: string; label: string; desc?: string; icon?: React.ReactNode };

type Props = {
  cardRef: RefObject<HTMLDivElement | null>;
  selected?: boolean;
  loading: boolean;
  onStop: () => void;
  onSubmit: () => void;
  images: string[];
  localImageSet: Set<string>;
  onAddFiles: (files: FileList) => void;
  onRemoveLocal: (src: string) => void;
  mode: VideoGenMode;
  onModeChange: (m: VideoGenMode) => void;
  prompt: string;
  promptHtml?: string;
  onPromptChange: (v: string) => void;
  onPromptHtmlChange?: (html: string) => void;
  enhancing: boolean;
  onEnhance: () => void;
  statusError: string;
  model: string;
  modelOptions: Opt[];
  defaultModel: string;
  onModelChange: (v: string) => void;
  res: string;
  ratio: string;
  qty: string;
  custom: VideoCustomParams;
  onRes: (v: string) => void;
  onRatio: (v: string) => void;
  onQty: (v: string) => void;
  onCustom: (next: VideoCustomParams) => void;
};

export function VideoNodePanel({
  cardRef,
  selected,
  loading,
  onStop,
  onSubmit,
  images,
  localImageSet,
  onAddFiles,
  onRemoveLocal,
  mode,
  onModeChange,
  prompt,
  promptHtml,
  onPromptChange,
  onPromptHtmlChange,
  enhancing,
  onEnhance,
  statusError,
  model,
  modelOptions,
  defaultModel,
  onModelChange,
  res,
  ratio,
  qty,
  custom,
  onRes,
  onRatio,
  onQty,
  onCustom,
}: Props) {
  const n = images.length;
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  /** 打开菜单时的文本 + 光标（用于插入时定位 @） */
  const snapRef = useRef({ text: '', cursor: 0 });

  const mentionImages: MentionImage[] = useMemo(
    () =>
      images.map((src, i) => ({
        index: i,
        name: `图片${i + 1}`,
        src,
        source: 'connected' as const,
      })),
    [images],
  );

  const handleMention = (filter: string | null, plain: string, cursor: number) => {
    if (filter === null) {
      setMentionOpen(false);
      setMentionFilter('');
      return;
    }
    snapRef.current = { text: plain, cursor };
    setMentionFilter(filter);
    setMentionOpen(true);
  };

  const insertMention = (img: MentionImage) => {
    const name =
      img.source === 'asset'
        ? img.name || `资产${(img.index ?? 0) + 1}`
        : img.name || `图片${img.index + 1}`;
    const called = (window as any).__insertMention?.({
      ...img,
      name,
    });
    if (called != null) {
      onPromptChange(called);
    } else {
      const { text, cursor } = snapRef.current;
      const { plain } = replaceAtCursor(text, cursor, name);
      onPromptChange(plain);
    }
    setMentionOpen(false);
    setMentionFilter('');
  };

  return (
    <NodePanel cardRef={cardRef} selected={selected} panelW={680}>
      <div className="flex items-center gap-1.5">
        <Dropdown
          value="videoGeneration"
          options={[{ value: 'videoGeneration', label: '视频生成' }]}
          onChange={() => {}}
          icon={<VideoIcon className="size-4" />}
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
            title="生成视频"
            className="p-1.5 rounded-full bg-primary text-primary-foreground hover:opacity-90"
          >
            <ArrowUp className="size-4" />
          </button>
        )}
      </div>

      {/* 模式 Tab：全能参考 / 文生视频 / 首帧 / 首尾帧 */}
      <div className="flex items-center gap-1 px-0.5">
        {VIDEO_GEN_MODES.map((m) => {
          const ok = videoModeAllowed(m, n);
          const active = mode === m;
          return (
            <button
              key={m}
              type="button"
              disabled={!ok || loading}
              onClick={() => onModeChange(m)}
              title={
                ok
                  ? m
                  : m === '文生视频'
                    ? '需要 0 张图'
                    : m === '首帧'
                      ? '需要恰好 1 张图'
                      : m === '首尾帧'
                        ? '需要恰好 2 张图'
                        : '需要至少 1 张图'
              }
              className={`px-2 py-1 rounded-lg text-[11px] transition-colors ${
                !ok
                  ? 'text-muted-foreground/35 cursor-not-allowed'
                  : active
                    ? 'bg-foreground text-background font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              {m}
            </button>
          );
        })}
      </div>

      <UpstreamImageStrip
        images={images}
        localSet={localImageSet}
        onAddFiles={onAddFiles}
        onRemoveLocal={onRemoveLocal}
      />

      <div className="relative">
        {mentionOpen && (
          <VideoMentionDropdown
            images={mentionImages}
            filter={mentionFilter}
            onSelect={insertMention}
          />
        )}
        <VideoPromptInput
          initialHtml={promptHtml}
          images={mentionImages}
          placeholder={`描述你想生成的内容；输入 @ 可引用图片/资产`}
          onChange={(v, html) => {
            onPromptChange(v);
            if (onPromptHtmlChange && html) onPromptHtmlChange(html);
          }}
          onMention={handleMention}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && mentionOpen) {
              e.preventDefault();
              setMentionOpen(false);
              return;
            }
            if (e.key === 'Enter' && !e.shiftKey && !mentionOpen) {
              e.preventDefault();
              void onSubmit();
            }
          }}
          className="pr-8"
        />
        <button
          type="button"
          title="增强提示词 (Ctrl+K)"
          disabled={!prompt.trim() || enhancing || loading}
          onClick={() => void onEnhance()}
          className="absolute bottom-1 right-1 p-1.5 rounded-lg bg-accent/60 hover:bg-accent text-muted-foreground disabled:opacity-40"
        >
          {enhancing ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
        </button>
      </div>

      {statusError && !loading ? (
        <p className="text-[11px] text-red-500 px-1 line-clamp-2">{statusError}</p>
      ) : null}

      <VideoParamsBar
        model={model}
        modelOptions={modelOptions}
        defaultModel={defaultModel}
        onModelChange={onModelChange}
        res={res}
        ratio={ratio}
        qty={qty}
        custom={custom}
        disabled={loading}
        onRes={onRes}
        onRatio={onRatio}
        onQty={onQty}
        onCustom={onCustom}
      />
    </NodePanel>
  );
}
