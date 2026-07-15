'use client';

// 连接资源条：展示上游识别到的图片，确认会随请求提交

import { useRef } from 'react';
import { Plus, ScanSearch, X } from 'lucide-react';

interface UpstreamImageStripProps {
  images: string[];
  /** 仅本地附加可移除；上游连线图不提供 X */
  localSet?: Set<string>;
  onAddFiles?: (files: FileList) => void;
  onRemoveLocal?: (src: string) => void;
  className?: string;
}

export function UpstreamImageStrip({
  images,
  localSet,
  onAddFiles,
  onRemoveLocal,
  className = '',
}: UpstreamImageStripProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  if (!images.length && !onAddFiles) return null;

  return (
    <div
      className={`flex items-center gap-2 px-1 py-0.5 overflow-x-auto nowheel nodrag ${className}`}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        className="shrink-0 flex flex-col items-center justify-center size-12 rounded-xl border border-border/70 bg-muted/40 text-muted-foreground"
        title="已识别连接资源，生成时一并提交"
      >
        <ScanSearch className="size-4" />
        <span className="text-[9px] mt-0.5 leading-none">识别</span>
      </div>

      {images.map((src, i) => {
        const isLocal = localSet?.has(src);
        return (
          <div
            key={`${i}-${src.slice(0, 48)}`}
            className="relative shrink-0 size-12 rounded-xl overflow-hidden border border-border/80 bg-muted group/thumb"
            title={`图片${i + 1}${isLocal ? '（本地）' : '（连线）'}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={`图片${i + 1}`} className="size-full object-cover" draggable={false} />
            <span className="absolute inset-x-0 bottom-0 bg-black/55 text-white text-[9px] text-center py-0.5 leading-none">
              图片{i + 1}
            </span>
            {isLocal && onRemoveLocal && (
              <button
                type="button"
                title="移除本地图"
                onClick={() => onRemoveLocal(src)}
                className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-black/60 text-white opacity-0 group-hover/thumb:opacity-100 transition"
              >
                <X className="size-2.5" />
              </button>
            )}
          </div>
        );
      })}

      {onAddFiles && (
        <>
          <button
            type="button"
            title="添加本地图片一并提交"
            onClick={() => inputRef.current?.click()}
            className="shrink-0 flex flex-col items-center justify-center size-12 rounded-xl border border-dashed border-border text-muted-foreground hover:bg-accent hover:text-foreground transition"
          >
            <Plus className="size-4" />
            <span className="text-[9px] mt-0.5 leading-none">添加</span>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) onAddFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </>
      )}
    </div>
  );
}
