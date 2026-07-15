'use client';

// 图片节点底部面板：配方 / 连接图条 / 提示词 / 模型参数

import type { RefObject } from 'react';
import { ArrowUp, BookOpen, Image as ImageIcon, Loader2, Sparkles, Square, Video } from 'lucide-react';
import { Dropdown } from './Dropdown';
import { NodePanel } from './NodePanel';
import { UpstreamImageStrip } from './UpstreamImageStrip';
import { ImageSizePicker, type ImageSizeValue } from './ImageSizePicker';
import { CameraPickerDialog } from './CameraPickerDialog';
import {
  formatCameraSummary,
  hasCameraPick,
  type CameraPick,
} from './cameraPresets';

type Opt = { value: string; label: string; desc?: string; icon?: React.ReactNode };

type Props = {
  cardRef: RefObject<HTMLDivElement | null>;
  selected?: boolean;
  recipeId: string;
  recipeOptions: { value: string; label: string }[];
  onRecipeChange: (v: string) => void;
  loading: boolean;
  onStop: () => void;
  onSubmit: () => void;
  images: string[];
  localImageSet: Set<string>;
  onAddFiles: (files: FileList) => void;
  onRemoveLocal: (src: string) => void;
  prompt: string;
  onPromptChange: (v: string) => void;
  placeholder: string;
  enhancing: boolean;
  onEnhance: () => void;
  statusError: string;
  model: string;
  modelOptions: Opt[];
  defaultModel: string;
  onModelChange: (v: string) => void;
  sizeVal: ImageSizeValue;
  onSizeChange: (v: ImageSizeValue) => void;
  qty: string;
  qtyOptions: Opt[];
  onQtyChange: (v: string) => void;
  camera: CameraPick;
  cameraOpen: boolean;
  onCameraOpenChange: (open: boolean) => void;
  onCameraApply: (next: CameraPick) => void;
};

export function ImageNodePanel({
  cardRef,
  selected,
  recipeId,
  recipeOptions,
  onRecipeChange,
  loading,
  onStop,
  onSubmit,
  images,
  localImageSet,
  onAddFiles,
  onRemoveLocal,
  prompt,
  onPromptChange,
  placeholder,
  enhancing,
  onEnhance,
  statusError,
  model,
  modelOptions,
  defaultModel,
  onModelChange,
  sizeVal,
  onSizeChange,
  qty,
  qtyOptions,
  onQtyChange,
  camera,
  cameraOpen,
  onCameraOpenChange,
  onCameraApply,
}: Props) {
  return (
    <NodePanel cardRef={cardRef} selected={selected} panelW={520}>
      <div className="flex items-center gap-1.5">
        <Dropdown
          value="imageGeneration"
          options={[{ value: 'imageGeneration', label: '图像生成' }]}
          onChange={() => {}}
          icon={<ImageIcon className="size-4" />}
          size="md"
        />
        <Dropdown
          value={recipeId}
          options={recipeOptions}
          onChange={onRecipeChange}
          icon={<BookOpen className="size-3.5" />}
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
            title="本地描述可空：将合并上游文本；有上游图则图生图"
            className="p-1.5 rounded-full bg-primary text-primary-foreground hover:opacity-90"
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

      <div className="relative">
        <textarea
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          rows={2}
          placeholder={placeholder}
          className="w-full resize-none bg-transparent outline-none text-sm leading-relaxed px-1 placeholder:text-muted-foreground"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void onSubmit();
            }
          }}
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

      <div className="flex items-center gap-1.5 flex-nowrap min-w-0">
        <Dropdown
          value={model}
          options={modelOptions.length ? modelOptions : [{ value: defaultModel, label: defaultModel }]}
          onChange={onModelChange}
        />
        <ImageSizePicker value={sizeVal} onChange={onSizeChange} />
        <Dropdown value={qty} options={qtyOptions} onChange={onQtyChange} />
        <div className="flex-1 min-w-2" />
        <div className="relative shrink-0">
          <button
            type="button"
            data-camera-trigger
            title="选择机身/镜头/胶片，提交时追加到提示词尾巴"
            onClick={() => onCameraOpenChange(!cameraOpen)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs transition-opacity hover:opacity-90 max-w-40 ${
              hasCameraPick(camera) || cameraOpen
                ? 'bg-foreground text-background'
                : 'border border-border text-muted-foreground hover:bg-muted/30'
            }`}
          >
            <Video className="size-3.5 shrink-0" />
            <span className="truncate">{formatCameraSummary(camera)}</span>
          </button>
          <CameraPickerDialog
            open={cameraOpen}
            value={camera}
            onClose={() => onCameraOpenChange(false)}
            onApply={onCameraApply}
          />
        </div>
      </div>
    </NodePanel>
  );
}
