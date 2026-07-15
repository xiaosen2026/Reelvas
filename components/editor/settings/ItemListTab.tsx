'use client';

import { useState, ReactNode } from 'react';

const IRefresh = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M8 16H3v5" /></svg>
);
const IImport = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><path d="M12 3v12" /><path d="m8 11 4 4 4-4" /><path d="M8 5H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-4" /></svg>
);
const IExport = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><path d="M12 15V3" /><path d="m8 7 4-4 4 4" /><path d="M8 5H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-4" /></svg>
);
const IPlus = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
);
const IEdit = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
);
const ITrash = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
);
const ISearch = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"><path d="m21 21-4.34-4.34" /><circle cx="11" cy="11" r="8" /></svg>
);

export interface ListEntry {
  id: string;
  badges: { text: string; cls: string }[]; // version / category / type 等
  secondary: string; // 描述 或 标题
}

interface Props {
  subtitle: string;
  searchPlaceholder: string;
  items: ListEntry[];
  editDialog?: (id: string, onClose: () => void) => ReactNode; // 编辑弹窗渲染器
}

const GRAY_BADGE = 'text-muted-foreground border-border bg-muted/50';

// Skills / Recipes 共用的列表管理页
export function ItemListTab({ subtitle, searchPlaceholder, items, editDialog }: Props) {
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const filtered = items.filter((it) => it.id.includes(query) || it.secondary.includes(query));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{subtitle}</p>
        <div className="flex items-center gap-2 shrink-0">
          <button className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"><IRefresh /></button>
          <button className="h-8 px-3 rounded-md border border-border text-xs text-foreground flex items-center gap-1.5 hover:bg-muted/50 transition-colors"><IImport /> 导入</button>
          <button className="h-8 px-3 rounded-md bg-foreground text-background text-xs font-medium flex items-center gap-1.5 hover:bg-foreground/90 transition-colors"><IPlus /> 新增</button>
        </div>
      </div>

      <div className="relative">
        <ISearch />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full h-10 pl-9 pr-3 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring transition-colors"
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-2">
        <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
          <input type="checkbox" className="w-4 h-4 rounded border-border accent-primary" />
          全选 <span className="text-muted-foreground">（共 {items.length} 项）</span>
        </label>
        <button className="h-7 px-3 rounded-md border border-border text-xs text-muted-foreground flex items-center gap-1.5 hover:bg-muted/50 transition-colors"><IExport /> 导出</button>
      </div>

      <div className="space-y-2">
        {filtered.map((it) => (
          <div key={it.id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5">
            <input type="checkbox" className="w-4 h-4 rounded border-border accent-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-mono text-sm text-foreground">{it.id}</span>
                <span className={`inline-flex items-center rounded-full border text-[11px] px-1.5 py-0 ${GRAY_BADGE}`}>内置</span>
                {it.badges.map((b, i) => (
                  <span key={i} className={`inline-flex items-center rounded-full border text-[11px] px-1.5 py-0 ${b.cls}`}>{b.text}</span>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1 truncate">{it.secondary}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <span className="relative inline-flex h-5 w-9 items-center rounded-full bg-primary"><span className="block h-4 w-4 rounded-full bg-white shadow translate-x-[18px]" /></span>
              <button onClick={() => setEditingId(it.id)} className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"><IEdit /></button>
              <button className="w-7 h-7 rounded-md flex items-center justify-center text-destructive hover:bg-destructive/10 transition-colors"><ITrash /></button>
            </div>
          </div>
        ))}
      </div>

      {editingId && editDialog && editDialog(editingId, () => setEditingId(null))}
    </div>
  );
}
