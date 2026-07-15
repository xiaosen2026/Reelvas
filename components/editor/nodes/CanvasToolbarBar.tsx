'use client';

// 画板底部工具栏

import {
  Circle,
  MousePointer2,
  Pencil,
  Redo2,
  Square,
  Trash2,
  Type,
  Undo2,
} from 'lucide-react';
import type { CanvasTool } from './canvasDrawing';

const TOOLS: { id: CanvasTool; Icon: typeof Pencil; tip: string }[] = [
  { id: 'select', Icon: MousePointer2, tip: '选择' },
  { id: 'rect', Icon: Square, tip: '矩形' },
  { id: 'circle', Icon: Circle, tip: '圆' },
  { id: 'pen', Icon: Pencil, tip: '画笔' },
  { id: 'text', Icon: Type, tip: '文字' },
];

type Props = {
  tool: CanvasTool;
  color: string;
  canUndo: boolean;
  canRedo: boolean;
  selectedId: string | null;
  onTool: (t: CanvasTool) => void;
  onColor: (c: string) => void;
  onClear: () => void;
  onUndo: () => void;
  onRedo: () => void;
};

export function CanvasToolbarBar({
  tool,
  color,
  canUndo,
  canRedo,
  selectedId,
  onTool,
  onColor,
  onClear,
  onUndo,
  onRedo,
}: Props) {
  return (
    <div className="shrink-0 flex justify-center pb-4 pt-2">
      <div className="flex items-center gap-0.5 px-2 py-1.5 rounded-xl bg-card border border-border shadow-sm">
        {TOOLS.map((t) => {
          const Icon = t.Icon;
          return (
            <button
              key={t.id}
              type="button"
              title={t.tip}
              onClick={() => onTool(t.id)}
              className={`p-1.5 rounded-lg transition-colors ${
                tool === t.id ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-accent'
              }`}
            >
              <Icon className="size-4" />
            </button>
          );
        })}
        <label className="p-1.5 cursor-pointer" title="颜色">
          <span className="block size-4 rounded-full border border-black/10" style={{ background: color }} />
          <input
            type="color"
            value={color}
            onChange={(e) => onColor(e.target.value)}
            className="sr-only"
          />
        </label>
        <div className="w-px h-5 bg-border mx-0.5" />
        <button
          type="button"
          title={selectedId ? '删除选中' : '清空'}
          className="p-1.5 rounded-lg text-muted-foreground hover:bg-accent"
          onClick={onClear}
        >
          <Trash2 className="size-4" />
        </button>
        <button
          type="button"
          title="撤销"
          disabled={!canUndo}
          className="p-1.5 rounded-lg text-muted-foreground hover:bg-accent disabled:opacity-40"
          onClick={onUndo}
        >
          <Undo2 className="size-4" />
        </button>
        <button
          type="button"
          title="重做"
          disabled={!canRedo}
          className="p-1.5 rounded-lg text-muted-foreground hover:bg-accent disabled:opacity-40"
          onClick={onRedo}
        >
          <Redo2 className="size-4" />
        </button>
      </div>
    </div>
  );
}
