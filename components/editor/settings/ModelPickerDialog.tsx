'use client';

// 模型选择弹窗：获取到的模型列表让用户勾选后再添加，避免一次性塞入上千个

import { useMemo, useState } from 'react';
import type { ModelItem } from '../../../lib/settingsData';
import { groupName } from './ChannelBlock';
import { ModelIcon } from './ModelIcon';

const ISearch = () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>;
const IChevron = () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>;
const IClose = () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>;

interface Props {
  candidates: ModelItem[];
  initialSelected: string[];
  loading?: boolean;
  onConfirm: (selected: ModelItem[]) => void;
  onClose: () => void;
}

export function ModelPickerDialog({ candidates, initialSelected, loading, onConfirm, onClose }: Props) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialSelected));
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const groups = useMemo(() => {
    const map = new Map<string, ModelItem[]>();
    for (const m of candidates) {
      const g = groupName(m.name);
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(m);
    }
    return Array.from(map.entries());
  }, [candidates]);

  const filtered = useMemo(() => {
    if (!search.trim()) return groups;
    const q = search.toLowerCase();
    return groups
      .map(([g, items]) => [g, items.filter((m) => m.name.toLowerCase().includes(q))] as const)
      .filter(([, items]) => items.length > 0);
  }, [groups, search]);

  const visibleNames = useMemo(
    () => filtered.flatMap(([, items]) => items.map((m) => m.name)),
    [filtered],
  );
  const allVisibleSelected = visibleNames.length > 0 && visibleNames.every((n) => selected.has(n));

  const toggle = (name: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(name)) n.delete(name);
      else n.add(name);
      return n;
    });
  };

  const toggleGroup = (items: ModelItem[]) => {
    setSelected((prev) => {
      const n = new Set(prev);
      const allOn = items.every((m) => n.has(m.name));
      for (const m of items) {
        if (allOn) n.delete(m.name);
        else n.add(m.name);
      }
      return n;
    });
  };

  const toggleAllVisible = () => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (allVisibleSelected) visibleNames.forEach((name) => n.delete(name));
      else visibleNames.forEach((name) => n.add(name));
      return n;
    });
  };

  const toggleCollapse = (g: string) => {
    setCollapsed((prev) => {
      const n = new Set(prev);
      if (n.has(g)) n.delete(g);
      else n.add(g);
      return n;
    });
  };

  const onOk = () => {
    const picked = candidates.filter((m) => selected.has(m.name));
    onConfirm(picked);
  };

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-140 max-w-[90vw] max-h-[80vh] rounded-2xl bg-white border border-border/50 shadow-lg flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 h-14 border-b border-border/40 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold text-foreground">选择模型</span>
            <span className="text-[11px] text-muted-foreground">共 {candidates.length} 个</span>
          </div>
          <button type="button" onClick={onClose} className="size-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted/30 transition-colors" title="关闭"><IClose /></button>
        </div>

        <div className="px-5 py-3 border-b border-border/30 shrink-0 space-y-2">
          <div className="flex items-center gap-2 px-2.5 h-9 rounded-lg border border-border bg-muted/10">
            <ISearch />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索模型..." className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none" autoFocus />
          </div>
          <button type="button" onClick={toggleAllVisible} className="text-[11px] text-indigo-600 hover:text-indigo-700 transition-colors">
            {allVisibleSelected ? '取消全选' : `全选当前 ${visibleNames.length} 个`}
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto nice-scroll px-3 py-2">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm gap-2">
              <span className="inline-block w-4 h-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
              获取中…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-1">
              <p className="text-sm">未找到匹配的模型</p>
            </div>
          ) : (
            filtered.map(([group, items]) => {
              const groupAllOn = items.every((m) => selected.has(m.name));
              const groupSomeOn = !groupAllOn && items.some((m) => selected.has(m.name));
              const isCollapsed = collapsed.has(group);
              return (
                <div key={group} className="mb-1 rounded-lg border border-border/20 overflow-hidden">
                  <div className="flex items-center gap-2 px-3 h-9 bg-muted/10">
                    <input
                      type="checkbox"
                      checked={groupAllOn}
                      ref={(el) => { if (el) el.indeterminate = groupSomeOn; }}
                      onChange={() => toggleGroup(items)}
                      className="size-4 accent-indigo-600 cursor-pointer"
                    />
                    <button type="button" onClick={() => toggleCollapse(group)} className="flex-1 flex items-center gap-2 min-w-0">
                      <span className={`transition-transform text-[10px] ${isCollapsed ? '' : 'rotate-90'}`}><IChevron /></span>
                      <span className="text-xs font-medium text-foreground truncate">{group}</span>
                      <span className="text-[10px] text-muted-foreground ml-auto">{items.filter((m) => selected.has(m.name)).length}/{items.length}</span>
                    </button>
                  </div>
                  {!isCollapsed && (
                    <div>
                      {items.map((m) => (
                        <label key={m.name} className="flex items-center gap-2 px-3 h-9 border-t border-border/10 hover:bg-muted/5 transition-colors cursor-pointer">
                          <input type="checkbox" checked={selected.has(m.name)} onChange={() => toggle(m.name)} className="size-4 accent-indigo-600 cursor-pointer" />
                          <ModelIcon name={m.name} size={14} fallback={m.icon} />
                          <span className="text-xs text-foreground truncate flex-1">{m.name}</span>
                          {m.desc ? <span className="text-[10px] text-muted-foreground truncate max-w-40">{m.desc}</span> : null}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between px-5 h-14 border-t border-border/40 shrink-0">
          <span className="text-xs text-muted-foreground">已选 {selected.size} 个</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="h-9 px-4 rounded-lg border border-border bg-background text-sm text-foreground hover:bg-muted/30 transition-colors">取消</button>
            <button type="button" onClick={onOk} disabled={selected.size === 0} className="h-9 px-4 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">添加所选</button>
          </div>
        </div>
      </div>
    </div>
  );
}
