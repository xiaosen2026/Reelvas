'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import {
  Type, Image, Film, Music, AudioLines, Box, PenLine, PaintBucket, StickyNote, Upload,
  ScrollText, Table2, Globe2, LayoutGrid, Workflow, Globe, ZoomIn, Expand,
} from 'lucide-react';

interface Props {
  x: number;
  y: number;
  onClose: () => void;
  onSelectNode: (type: string) => void;
  onSelectResource: (type: string) => void;
  /** true：相对锚点垂直居中（侧栏 +）；false：从锚点向下展开（右键） */
  centerY?: boolean;
}

// 普通生成节点
const nodeTypes = [
  { type: 'text', label: '创建文本', Icon: Type },
  { type: 'image', label: '创建图片', Icon: Image },
  { type: 'video', label: '创建视频', Icon: Film },
  { type: 'audio', label: '创建音频', Icon: Music },
  { type: 'tts', label: '创建 TTS', Icon: AudioLines },
  { type: '3d', label: '创建 3D 导演台', Icon: Box },
  { type: 'script', label: '创建脚本', Icon: ScrollText },
  { type: 'table', label: '创建表格', Icon: Table2 },
  { type: 'panorama', label: '创建全景', Icon: Globe2 },
  { type: 'upscale', label: '创建增强', Icon: ZoomIn },
  { type: 'outpaint', label: '创建扩图', Icon: Expand },
  { type: 'storyboard', label: '创建分镜', Icon: LayoutGrid },
];

// 资源节点
const resourceTypes = [
  { type: 'input', label: '输入文本', Icon: PenLine },
  { type: 'board', label: '画板', Icon: PaintBucket },
  { type: 'note', label: '便签', Icon: StickyNote },
  { type: 'upload', label: '上传', Icon: Upload },
];

// 高级节点
const advancedTypes = [
  { type: 'comfyui', label: 'ComfyUI', Icon: Workflow },
  { type: 'http', label: 'HTTP 请求', Icon: Globe },
];

const PAD = 12; // 视口边距，防止贴边/裁切

export function ContextMenu({ x, y, onClose, onSelectNode, onSelectResource, centerY = false }: Props) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y, maxH: window.innerHeight - PAD * 2 });

  // 测量后垂直居中 + 视口夹紧，保证底部条目可见
  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const rect = el.getBoundingClientRect();
    const maxH = Math.max(160, vh - PAD * 2);

    let left = x;
    let top = centerY ? y - Math.min(rect.height, maxH) / 2 : y;

    // 水平：优先右侧，不够则翻到左侧
    if (left + rect.width + PAD > vw) {
      left = Math.max(PAD, x - rect.width);
    }
    left = Math.min(Math.max(PAD, left), vw - rect.width - PAD);

    // 垂直：夹在 [PAD, vh - height - PAD]
    const h = Math.min(rect.height, maxH);
    top = Math.min(Math.max(PAD, top), vh - h - PAD);

    setPos({ left, top, maxH });
  }, [x, y, centerY]);

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        ref={menuRef}
        className="fixed z-50 w-52 overflow-y-auto rounded-xl bg-card border border-border shadow-sm py-2"
        style={{ left: pos.left, top: pos.top, maxHeight: pos.maxH }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-3 py-1.5 text-xs text-muted-foreground">添加节点</div>
        {nodeTypes.map((item) => {
          const IconComponent = item.Icon;
          return (
            <button
              key={item.type}
              onClick={() => {
                onSelectNode(item.type);
                onClose();
              }}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-foreground hover:bg-accent transition-colors"
            >
              <span className="text-muted-foreground">
                <IconComponent className="size-4" />
              </span>
              <span>{item.label}</span>
            </button>
          );
        })}
        <div className="h-px bg-border my-1" />
        <div className="px-3 py-1.5 text-xs text-muted-foreground">添加资源</div>
        {resourceTypes.map((item) => {
          const IconComponent = item.Icon;
          return (
            <button
              key={item.type}
              onClick={() => {
                onSelectResource(item.type);
                onClose();
              }}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-foreground hover:bg-accent transition-colors"
            >
              <span className="text-muted-foreground">
                <IconComponent className="size-4" />
              </span>
              <span>{item.label}</span>
            </button>
          );
        })}
        <div className="h-px bg-border my-1" />
        <div className="px-3 py-1.5 text-xs text-muted-foreground">高级节点</div>
        {advancedTypes.map((item) => {
          const IconComponent = item.Icon;
          return (
            <button
              key={item.type}
              onClick={() => {
                onSelectNode(item.type);
                onClose();
              }}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-foreground hover:bg-accent transition-colors"
            >
              <span className="text-muted-foreground">
                <IconComponent className="size-4" />
              </span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}
