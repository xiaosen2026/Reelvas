'use client';

// ComfyUI 工作流管理面板（侧边栏）— 新增/编辑/删除工作流 JSON

import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Plus, Trash2, Check, Workflow } from 'lucide-react';
import { listComfyWorkflows, addComfyWorkflow, deleteComfyWorkflow, updateComfyWorkflow, type ComfyWorkflowItem } from '@/lib/comfyWorkflowStore';

interface Props {
  onClose: () => void;
}

/** 手写 JSON；{{变量名}} 自动高亮（textarea 叠 pre） */
function JsonEditor({ value, onChange, rows, placeholder }: {
  value: string;
  onChange: (v: string) => void;
  rows: number;
  placeholder?: string;
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);

  const escapeHtml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // {{变量名}} 高亮；兼容旧 $xxx
  const highlighted = escapeHtml(value)
    .replace(
      /(\{\{[^}]+\}\})/g,
      '<mark class="rounded px-0.5 font-semibold" style="background:#fef3c7;color:#92400e">$1</mark>',
    )
    .replace(
      /(\$[A-Za-z_]\w*)/g,
      '<mark class="rounded px-0.5 font-semibold" style="background:#fef3c7;color:#92400e">$1</mark>',
    );

  const syncScroll = () => {
    const ta = taRef.current;
    const pre = preRef.current;
    if (!ta || !pre) return;
    pre.scrollTop = ta.scrollTop;
    pre.scrollLeft = ta.scrollLeft;
  };

  return (
    <div className="rounded-lg border border-border/60 overflow-hidden bg-card">
      <div className="flex items-center gap-1.5 px-2 py-1 border-b border-border/40 bg-muted/20">
        <span className="text-[10px] text-muted-foreground">
          手写 JSON · 用 <code className="font-mono text-foreground/80">{'{{变量名}}'}</code> 标记变量（自动高亮）
        </span>
      </div>
      <div className="relative bg-card">
        <pre
          ref={preRef}
          aria-hidden
          className="absolute inset-0 m-0 overflow-hidden pointer-events-none text-xs font-mono px-3 py-2 leading-relaxed whitespace-pre-wrap break-all text-foreground bg-card"
          dangerouslySetInnerHTML={{ __html: (highlighted || '') + '\n' }}
        />
        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={syncScroll}
          rows={rows}
          placeholder={placeholder}
          spellCheck={false}
          className="relative z-10 w-full resize-none outline-none text-xs font-mono px-3 py-2 leading-relaxed whitespace-pre-wrap break-all bg-transparent caret-foreground placeholder:text-muted-foreground"
          style={{ color: 'transparent', WebkitTextFillColor: 'transparent' }}
        />
      </div>
    </div>
  );
}

const tabs = ['一键同款', '灵感库', '我的收藏', '我的工作流'];

export function WorkflowPanel({ onClose }: Props) {
  const [activeTab, setActiveTab] = useState('我的工作流');
  const [items, setItems] = useState<ComfyWorkflowItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editJson, setEditJson] = useState('');
  const [adding, setAdding] = useState(false);
  const [addName, setAddName] = useState('');
  const [addJson, setAddJson] = useState('');

  const refresh = useCallback(() => setItems(listComfyWorkflows()), []);
  useEffect(refresh, [refresh]);

  const startEdit = (item: ComfyWorkflowItem) => {
    setEditingId(item.id);
    setEditName(item.name);
    setEditJson(item.json);
  };

  const doSaveEdit = () => {
    if (!editingId || !editName.trim() || !editJson.trim()) return;
    updateComfyWorkflow(editingId, { name: editName.trim(), json: editJson.trim() });
    setEditingId(null);
    refresh();
  };

  const doDelete = (id: string) => {
    deleteComfyWorkflow(id);
    refresh();
  };

  const doAdd = () => {
    if (!addName.trim() || !addJson.trim()) return;
    addComfyWorkflow(addName.trim(), addJson.trim());
    setAddName('');
    setAddJson('');
    setAdding(false);
    refresh();
  };

  return (
    <>
      <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-[110] flex items-center justify-center pointer-events-none">
        <div className="pointer-events-auto w-[80vw] max-w-5xl h-[80vh] rounded-xl bg-card border border-border shadow-2xl flex flex-col overflow-hidden">
          {/* 顶栏 */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
            {tabs.map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  activeTab === t
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                {t}
              </button>
            ))}
            <div className="flex-1" />
            <button onClick={onClose} className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 内容 */}
          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === '我的工作流' ? (
              <div className="max-w-2xl mx-auto space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">ComfyUI 工作流</h3>
                  <button
                    onClick={() => setAdding(true)}
                    className="h-8 px-3 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 flex items-center gap-1"
                  >
                    <Plus className="size-3.5" />
                    新增
                  </button>
                </div>

                {/* 新增表单 */}
                {adding && (
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-2">
                    <input
                      value={addName}
                      onChange={(e) => setAddName(e.target.value)}
                      placeholder="工作流名称"
                      className="w-full rounded-lg border border-border/60 bg-background/80 outline-none text-sm px-3 py-1.5"
                    />
                    <JsonEditor
                      value={addJson}
                      onChange={setAddJson}
                      rows={6}
                      placeholder='{ "3": { "class_type": "KSampler", "inputs": { "prompt": "{{提示词}}", "seed": "{{seed}}" } } }'
                    />
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => setAdding(false)} className="px-3 py-1 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground">取消</button>
                      <button onClick={doAdd} className="px-3 py-1 rounded-lg bg-primary text-primary-foreground text-xs hover:opacity-90">保存</button>
                    </div>
                  </div>
                )}

                {/* 列表 */}
                {items.length === 0 && !adding && (
                  <p className="text-sm text-muted-foreground text-center py-8">暂无工作流</p>
                )}
                {items.map((item) => (
                  <div key={item.id} className="rounded-xl border border-border/60 bg-background overflow-hidden">
                    {editingId === item.id ? (
                      <div className="p-3 space-y-2">
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full rounded-lg border border-border/60 bg-muted/20 outline-none text-sm px-3 py-1.5"
                        />
                        <JsonEditor
                          value={editJson}
                          onChange={setEditJson}
                          rows={6}
                        />
                        <div className="flex items-center gap-2 justify-end">
                          <button onClick={() => setEditingId(null)} className="px-3 py-1 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground">取消</button>
                          <button onClick={doSaveEdit} className="px-3 py-1 rounded-lg bg-primary text-primary-foreground text-xs hover:opacity-90">
                            <Check className="size-3 inline mr-1" />保存
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 px-3 py-2.5">
                        <Workflow className="size-4 text-muted-foreground shrink-0" />
                        <span className="flex-1 text-sm font-medium text-foreground truncate">{item.name}</span>
                        <span className="text-[10px] text-muted-foreground">{item.json.length} 字符</span>
                        <button onClick={() => startEdit(item)} className="p-1 rounded hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-colors" title="编辑">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                        </button>
                        <button onClick={() => doDelete(item.id)} className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-500 transition-colors" title="删除">
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center text-muted-foreground min-h-0">
                <p className="text-sm">暂无内容</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
