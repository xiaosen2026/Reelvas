'use client';

import { useState, useRef, useEffect } from 'react';
import { Handle, Position, useFlow } from '../flow';


interface NodeProps {
  id: string;
  data: { label?: string; value?: string };
  selected?: boolean;
}

// 输入文本资源节点 — 对照 57400 "输入文本"(text-input)
// 纯可编辑文本框 + 右侧 source handle，无模型/发送等生成控件
export function TextInputNode({ id, data, selected }: NodeProps) {
  const rf = useFlow();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(data['value'] || '');
  const taRef = useRef<HTMLTextAreaElement>(null);
  const label = data['label'] || 'TEXT';

  useEffect(() => {
    if (editing && taRef['current']) taRef['current']['focus']();
  }, [editing]);

  const persistValue = (next: string) => {
    rf.setNodes((nds) =>
      nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, value: next } } : n)),
    );
  };

  const onBlur = () => {
    setEditing(false);
    persistValue(value);
  };

  return (
    <div className="relative group w-full h-full">
      <div className="absolute left-0 bottom-full pb-1.5 flex items-center gap-1.5">
        <span className="text-[11px] text-muted-foreground font-medium tracking-wider uppercase">{label}</span>
        <button className="text-muted-foreground hover:text-foreground text-sm leading-none">+</button>
      </div>

      {/* 可编辑文本卡片 */}
      <div className={`bg-card border rounded-2xl w-full h-full overflow-hidden transition-[box-shadow,border-color] duration-200 ${selected ? 'ring-2 ring-zinc-500' : 'border-border/80'}`}>
        <div className="w-full h-full px-5 py-4">
          {editing ? (
            <textarea
              ref={taRef}
              value={value}
              onChange={(e) => {
                const next = e.target.value;
                setValue(next);
                // 即时写回，保证连到图片节点时 value 已在图数据中
                persistValue(next);
              }}
              onBlur={onBlur}
              placeholder="请输入文本，/ 引用提示词，@ 引用节点..."
              className="w-full h-full resize-none bg-transparent outline-none text-sm leading-relaxed nodrag nowheel placeholder:text-muted-foreground"
            />
          ) : (
            <div
              onDoubleClick={() => setEditing(true)}
              className="w-full h-full text-sm leading-relaxed cursor-text whitespace-pre-wrap break-words"
            >
              {value || <span className="text-muted-foreground">请输入文本，/ 引用提示词，@ 引用节点...</span>}
            </div>
          )}
        </div>
      </div>

      {/* 右侧 source handle */}
      <Handle type="source" position={Position['Right']} style={{ right: -6, top: '50%', transform: 'translateY(-50%)' }} />
    </div>
  );
}
