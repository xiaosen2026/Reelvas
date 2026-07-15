'use client';

// 图像增强节点底部面板

import type { RefObject } from 'react';
import { ArrowUp, Square, ZoomIn } from 'lucide-react';
import { Dropdown } from './Dropdown';
import { NodePanel } from './NodePanel';
import { UpstreamImageStrip } from './UpstreamImageStrip';

const SCALE_OPTS = [
  { value: '2x', label: '2倍' },
  { value: '4x', label: '4倍' },
  { value: '6x', label: '6倍' },
];

const STYLE_OPTS = [
  { value: '通用', label: '通用' },
  { value: '人像', label: '人像' },
  { value: '风景', label: '风景' },
  { value: '动漫', label: '动漫' },
  { value: '产品', label: '产品' },
];

const MODE_OPTS = [
  { value: 'api', label: '网络 API 放大' },
  { value: 'local', label: '本地模型放大' },
];

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
  scale: string;
  onScale: (v: string) => void;
  mode: 'api' | 'local';
  onMode: (v: 'api' | 'local') => void;
  style: string;
  onStyle: (v: string) => void;
  faceEnhance: boolean;
  onFaceEnhance: (v: boolean) => void;
  faceCreativity: number;
  onFaceCreativity: (v: number) => void;
  faceStrength: number;
  onFaceStrength: (v: number) => void;
  error: string;
};

export function UpscaleNodePanel({
  cardRef,
  selected,
  loading,
  onStop,
  onSubmit,
  images,
  localImageSet,
  onAddFiles,
  onRemoveLocal,
  scale,
  onScale,
  mode,
  onMode,
  style,
  onStyle,
  faceEnhance,
  onFaceEnhance,
  faceCreativity,
  onFaceCreativity,
  faceStrength,
  onFaceStrength,
  error,
}: Props) {
  return (
    <NodePanel cardRef={cardRef} selected={selected} panelW={400}>
      <div className="flex items-center gap-2 px-1">
        <ZoomIn className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium">图像增强 / 放大</span>
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
            title="开始放大"
            onClick={() => void onSubmit()}
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

      <div className="flex items-center justify-between gap-2 px-1">
        <span className="text-xs text-muted-foreground">放大倍数</span>
        <div className="flex gap-1">
          {SCALE_OPTS.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => onScale(s.value)}
              className={`h-7 px-2.5 rounded-full text-xs border transition-colors ${
                scale === s.value
                  ? 'bg-foreground text-background border-foreground'
                  : 'border-border text-muted-foreground hover:bg-muted/30'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 px-1 flex-wrap">
        <span className="text-xs text-muted-foreground shrink-0">模式</span>
        <Dropdown
          value={mode}
          options={MODE_OPTS}
          onChange={(v) => onMode(v === 'local' ? 'local' : 'api')}
        />
        <span className="text-xs text-muted-foreground shrink-0">风格</span>
        <Dropdown value={style} options={STYLE_OPTS} onChange={onStyle} />
      </div>

      <div className="flex items-center justify-between gap-2 px-1">
        <span className="text-xs text-muted-foreground">面部增强</span>
        <button
          type="button"
          onClick={() => onFaceEnhance(!faceEnhance)}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            faceEnhance ? 'bg-emerald-500' : 'bg-muted'
          }`}
        >
          <span
            className={`block size-4 rounded-full bg-white shadow-sm transition-transform ${
              faceEnhance ? 'translate-x-4' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      {faceEnhance ? (
        <div className="space-y-2 px-1">
          <label className="block space-y-1">
            <span className="text-[10px] text-muted-foreground">
              面部增强创意度 {faceCreativity.toFixed(1)}
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.1}
              value={faceCreativity}
              onChange={(e) => onFaceCreativity(Number(e.target.value))}
              className="w-full accent-foreground"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[10px] text-muted-foreground">
              面部增强强度 {faceStrength.toFixed(1)}
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.1}
              value={faceStrength}
              onChange={(e) => onFaceStrength(Number(e.target.value))}
              className="w-full accent-foreground"
            />
          </label>
        </div>
      ) : null}

      {error && !loading ? (
        <p className="text-[11px] text-amber-600 px-1 leading-relaxed">{error}</p>
      ) : (
        <p className="text-[10px] text-muted-foreground px-1">
          双模式：网络 API 放大 / 本地模型放大（本地待接入）。不自动调用未配置的云端计费接口。
        </p>
      )}
    </NodePanel>
  );
}
