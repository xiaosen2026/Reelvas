'use client';

import { useState } from 'react';

// 提示词库弹窗 —— 严格对照原版 57400 截图复刻
// 宽弹窗、顶部对齐、默认空状态（原版打开即无提示词）
const IX = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
);
const ISearch = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"><path d="m21 21-4.34-4.34" /><circle cx="11" cy="11" r="8" /></svg>
);
const IImport = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M12 15V3" /><path d="m8 11 4 4 4-4" /><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /></svg>
);
// 空状态文档图标
const IDoc = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-12 w-12 text-muted-foreground/40"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M10 9H8" /><path d="M16 13H8" /><path d="M16 17H8" /></svg>
);
const ITrash = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
);

interface Prompt {
  id: number;
  title: string;
  content: string;
}

let pid = 1;

export function PromptLibrary({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [prompts, setPrompts] = useState<Prompt[]>([]); // 原版初始为空
  const [creating, setCreating] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftContent, setDraftContent] = useState('');

  const q = query['trim']();
  const filtered = prompts['filter']((p) => !q || p['title']['includes'](q) || p['content']['includes'](q));

  const saveDraft = () => {
    if (!draftTitle['trim']()) return; // 仅前端校验
    setPrompts((list) => [{ id: pid++, title: draftTitle['trim'](), content: draftContent['trim']() }, ...list]);
    setDraftTitle('');
    setDraftContent('');
    setCreating(false);
  };
  const cancelDraft = () => {
    setDraftTitle('');
    setDraftContent('');
    setCreating(false);
  };
  const remove = (id: number) => setPrompts((list) => list['filter']((p) => p['id'] !== id));

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center pt-[15vh] px-4 bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-3xl rounded-2xl bg-card border border-border/50 shadow-xl flex flex-col overflow-hidden" onClick={(e) => e['stopPropagation']()}>
        {/* 标题 + 关闭 */}
        <div className="flex items-start justify-between px-6 pt-5 pb-1 shrink-0">
          <div>
            <h3 className="text-lg font-semibold text-foreground">提示词库</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              管理你保存的提示词，在输入框中输入 <span className="text-foreground">/</span> 即可快速引用。
            </p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"><IX /></button>
        </div>

        {/* 搜索 + 计数 + 导入 + 新建 */}
        <div className="flex items-center gap-3 px-6 pt-3 pb-4 shrink-0">
          <div className="relative flex-1">
            <ISearch />
            <input value={query} onChange={(ev) => setQuery(ev['currentTarget']['value'])} placeholder="搜索提示词..." className="w-full h-10 pl-9 pr-3 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 transition-shadow" />
          </div>
          <span className="text-sm text-muted-foreground shrink-0">{prompts['length']} 个</span>
          <button className="flex items-center gap-1.5 h-10 px-3 rounded-lg border border-border text-sm text-foreground hover:bg-muted/50 transition-colors shrink-0">
            <IImport /><span>导入</span>
          </button>
          <button onClick={() => setCreating(true)} className="flex items-center gap-1.5 h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity shrink-0">
            <span className="text-base leading-none">+</span><span>新建提示词</span>
          </button>
        </div>

        {/* 新建表单（内联展开） */}
        {creating && (
          <div className="mx-6 mb-4 rounded-xl border border-border bg-background p-4 flex flex-col gap-3 shrink-0">
            <input autoFocus value={draftTitle} onChange={(ev) => setDraftTitle(ev['currentTarget']['value'])} placeholder="提示词标题" className="w-full h-10 px-3 rounded-lg border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 transition-shadow" />
            <textarea value={draftContent} onChange={(ev) => setDraftContent(ev['currentTarget']['value'])} rows={3} placeholder="提示词内容" className="w-full resize-none px-3 py-2 rounded-lg border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 transition-shadow" />
            <div className="flex items-center justify-end gap-2">
              <button onClick={cancelDraft} className="h-9 px-4 rounded-lg border border-border text-sm text-foreground hover:bg-muted/50 transition-colors">取消</button>
              <button onClick={saveDraft} disabled={!draftTitle['trim']()} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-opacity">保存</button>
            </div>
          </div>
        )}

        {/* 列表 / 空状态 */}
        {prompts['length'] === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <IDoc />
            <p className="mt-4 text-sm font-medium text-muted-foreground">暂无提示词</p>
            <p className="mt-1 text-xs text-muted-foreground/70">点击右上角“新建提示词”，或在画布选中文本后右键添加</p>
          </div>
        ) : filtered['length'] === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <p className="text-sm font-medium text-muted-foreground">没有匹配的提示词</p>
            <p className="mt-1 text-xs text-muted-foreground/70">换个关键词试试</p>
          </div>
        ) : (
          <div className="px-6 pb-6 max-h-[50vh] overflow-y-auto space-y-2">
            {filtered['map']((p) => (
              <div key={p['id']} className="group rounded-lg border border-border px-4 py-3 hover:bg-muted/40 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{p['title']}</p>
                    {p['content'] && <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{p['content']}</p>}
                  </div>
                  <button onClick={() => remove(p['id'])} aria-label="删除" className="shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground/60 opacity-0 group-hover:opacity-100 hover:text-destructive transition-all"><ITrash /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
