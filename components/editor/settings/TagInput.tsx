'use client';

import { useState } from 'react';

const IX = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
);

// 标签输入框：Enter 添加，× 删除（关键词 / 节点类型 / Required Elements 等共用）
// 注：成员访问使用 obj['prop'] 形式，规避构建工具对 word.word 记号的改写
export function TagInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [draft, setDraft] = useState('');

  function add() {
    const trimmed = draft['trim']();
    if (trimmed && !value['includes'](trimmed)) onChange([...value, trimmed]);
    setDraft('');
  }

  return (
    <div className="min-h-10 rounded-lg border border-border bg-background px-2 py-1.5 flex flex-wrap gap-1.5 items-center">
      {value['map']((tag) => (
        <span key={tag} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-foreground">
          {tag}
          <button type="button" onClick={() => onChange(value['filter']((x) => x !== tag))} className="text-muted-foreground hover:text-foreground"><IX /></button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(ev) => setDraft(ev['currentTarget']['value'])}
        onKeyDown={(ev) => { if (ev['key'] === 'Enter') { ev.preventDefault(); add(); } }}
        placeholder={value['length'] ? '' : placeholder}
        className="flex-1 min-w-[80px] bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
      />
    </div>
  );
}
