'use client';

import { useState, useRef, useEffect } from 'react';
import { Minus, Plus } from 'lucide-react';
import { useFlow } from '../flow';


interface NodeProps {
  id: string;
  data: { value?: string; color?: string; fontSize?: number };
  selected?: boolean;
}

// 便签可选颜色（对照 globals.css --node-* 系列）
const COLORS = [
  'var(--node-pink)',
  'var(--node-yellow)',
  'var(--node-green)',
  'var(--node-blue)',
  'var(--node-purple)',
];

// 便签资源节点 — 对照 57400 "便签"(stickyNote)
// 粉色便签 + 顶部颜色圆点 + 字号调节(− N +) + 可编辑文字，无 handle
export function StickyNoteNode({ id, data, selected }: NodeProps) {
  const rf = useFlow();
  const zoom = rf.zoom;
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(data['value'] || '');
  const [color, setColor] = useState(data['color'] || COLORS[0]);
  const [fontSize, setFontSize] = useState(data['fontSize'] || 20);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && taRef['current']) taRef['current']['focus']();
  }, [editing]);

  const onBlur = () => {
    setEditing(false);
    rf['setNodes']((nds: any[]) =>
      nds['map']((n) => (n['id'] === id ? { ...n, data: { ...n['data'], value, color, fontSize } } : n)),
    );
  };

  // 便签底色：node 颜色变量是 "R G B" 格式，用 rgb() 包裹 + 低透明度
  const bg = `rgb(${color} / 0.35)`;

  return (
    <div className="relative group w-full h-full flex flex-col gap-1">
      {/* 顶部工具条：颜色圆点 + 字号调节 — 仅选中时可见 */}
      <div className={`nodrag flex items-center gap-2 px-1 ${selected ? '' : 'invisible pointer-events-none'}`}
        style={{ transform: zoom !== 1 ? `scale(${1 / zoom})` : undefined, transformOrigin: 'top left' }}>
        <button
          onClick={() => {
            const idx = COLORS.indexOf(color);
            setColor(COLORS[(idx + 1) % COLORS.length]);
          }}
          className="size-4 rounded-full border border-black/10"
          style={{ background: `rgb(${color})` }}
          title="切换颜色"
        />
        <div className="flex items-center gap-1 text-muted-foreground">
          <button onClick={() => setFontSize((s) => Math.max(12, s - 2))} className="hover:text-foreground"><Minus className="size-3.5" /></button>
          <span className="text-xs tabular-nums w-5 text-center">{fontSize}</span>
          <button onClick={() => setFontSize((s) => Math.min(48, s + 2))} className="hover:text-foreground"><Plus className="size-3.5" /></button>
        </div>
      </div>

      {/* 便签本体 */}
      <div
        className={`rounded-2xl w-full flex-1 overflow-hidden transition-shadow duration-200 shadow-sm ${selected ? 'ring-2 ring-zinc-500' : ''}`}
        style={{ background: bg }}
      >
        <div className="w-full h-full p-4">
          {editing ? (
            <textarea
              ref={taRef}
              value={value}
              onChange={(e) => setValue(e['target']['value'])}
              onBlur={onBlur}
              style={{ fontSize: `${fontSize}px` }}
              className="w-full h-full resize-none bg-transparent outline-none leading-relaxed text-foreground nodrag nowheel"
            />
          ) : (
            <div
              onDoubleClick={() => setEditing(true)}
              style={{ fontSize: `${fontSize}px` }}
              className="w-full h-full leading-relaxed cursor-text whitespace-pre-wrap break-words text-foreground"
            >
              {value || <span className="opacity-40">双击输入便签...</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
