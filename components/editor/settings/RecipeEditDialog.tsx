'use client';

import { useState } from 'react';
import { EditDialogShell, FieldLabel } from './EditDialogShell';
import { TagInput } from './TagInput';
import { RecipeItem } from '../../../lib/settingsData';

const IChevron = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0 opacity-50"><path d="m6 9 6 6 6-6" /></svg>
);

// 编辑 Recipe 弹窗（结构复刻自原版）
// 注：成员访问使用 obj['prop'] 形式，规避构建工具对 word.word 记号的改写
export function RecipeEditDialog({ recipe, onClose }: { recipe: RecipeItem; onClose: () => void }) {
  const [name, setName] = useState(recipe['title']);
  const [genType, setGenType] = useState<string>(recipe['type']);
  const [typeOpen, setTypeOpen] = useState(false);
  const [opTypes, setOpTypes] = useState<string[]>(recipe['operationTypes']);
  const [sysPrompt, setSysPrompt] = useState(recipe['systemPrompt']);
  const [required, setRequired] = useState<string[]>(recipe['requiredElements']);
  const [plannerHint, setPlannerHint] = useState(recipe['plannerHint']);

  return (
    <EditDialogShell title={`编辑 Recipe: ${recipe['id']}`} onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel>ID</FieldLabel>
          <input value={recipe['id']} disabled className="w-full h-10 rounded-lg border border-border bg-muted/30 px-3 text-sm font-mono text-muted-foreground" />
        </div>
        <div>
          <FieldLabel required>名称</FieldLabel>
          <input value={name} onChange={(ev) => setName(ev['currentTarget']['value'])} className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:border-ring transition-colors" />
        </div>
      </div>

      <div>
        <FieldLabel required>生成类型</FieldLabel>
        <div className="relative w-40">
          {typeOpen && <div className="fixed inset-0 z-40" onClick={() => setTypeOpen(false)} />}
          <button type="button" onClick={() => setTypeOpen((v) => !v)} className="h-9 w-full px-3 rounded-lg border border-border bg-background text-sm text-foreground flex items-center justify-between hover:border-ring transition-colors">
            {genType} <IChevron />
          </button>
          {typeOpen && (
            <div className="absolute z-50 top-full left-0 mt-1 w-full rounded-lg bg-popover border border-border shadow-md py-1">
              {['文本', '图片', '视频']['map']((o) => (
                <button key={o} type="button" onClick={() => { setGenType(o); setTypeOpen(false); }} className={`w-full text-left px-3 py-1.5 text-sm hover:bg-muted/50 transition-colors ${o === genType ? 'text-primary font-medium' : 'text-foreground'}`}>{o}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div>
        <FieldLabel required>Operation Types</FieldLabel>
        <TagInput value={opTypes} onChange={setOpTypes} placeholder="输入操作类型后回车添加" />
        <p className="text-xs text-muted-foreground mt-1.5">Agent 规划时用于匹配此 Recipe 的操作类型标识符</p>
      </div>

      <div>
        <FieldLabel required>System Prompt</FieldLabel>
        <textarea value={sysPrompt} onChange={(ev) => setSysPrompt(ev['currentTarget']['value'])} rows={6} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:border-ring transition-colors resize-none" />
      </div>

      <div>
        <FieldLabel>Required Elements（可选）</FieldLabel>
        <TagInput value={required} onChange={setRequired} placeholder="输入必需要素后回车添加" />
        <p className="text-xs text-muted-foreground mt-1.5">生成结果必须包含的关键要素</p>
      </div>

      <div>
        <FieldLabel>Planner Hint（可选）</FieldLabel>
        <input value={plannerHint} onChange={(ev) => setPlannerHint(ev['currentTarget']['value'])} className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:border-ring transition-colors" />
      </div>
    </EditDialogShell>
  );
}
