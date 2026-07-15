'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { X, History, Eye, RotateCcw, Layers } from 'lucide-react';
import type { FlowNode, FlowEdge } from './flow';
import {
  HISTORY_LIMIT,
  formatHistoryTime,
  getHistoryEntry,
  listHistory,
  type WorkflowHistoryEntry,
} from '../../lib/workflowHistoryStore';
import { createLogger } from '../../lib/logger';

const log = createLogger('HistoryPanel');

interface HistoryPanelProps {
  onClose: () => void;
  workflowName: string;
  /** 预览：临时加载到画布，不关闭面板 */
  onPreview: (nodes: FlowNode[], edges: FlowEdge[], meta: { id: string; savedAt: number }) => void;
  /** 确认回退：正式应用并关闭 */
  onRestore: (nodes: FlowNode[], edges: FlowEdge[], meta: { id: string; savedAt: number }) => void;
  /** 退出预览，恢复打开面板前的画布 */
  onExitPreview: () => void;
  /** 当前是否处于预览态 */
  previewingId: string | null;
}

export function HistoryPanel({
  onClose,
  workflowName,
  onPreview,
  onRestore,
  onExitPreview,
  previewingId,
}: HistoryPanelProps) {
  const [entries, setEntries] = useState<WorkflowHistoryEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    const list = listHistory(workflowName);
    setEntries(list);
    log.debug('refresh', 'loaded', { name: workflowName, count: list.length });
  }, [workflowName]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const selected = useMemo(
    () => entries.find((e) => e.id === selectedId) ?? null,
    [entries, selectedId],
  );

  const handleClose = () => {
    if (previewingId) onExitPreview();
    onClose();
  };

  const handlePreview = (entry: WorkflowHistoryEntry) => {
    setSelectedId(entry.id);
    const full = getHistoryEntry(workflowName, entry.id) ?? entry;
    onPreview(full.nodes, full.edges, { id: full.id, savedAt: full.savedAt });
    log.info('handlePreview', 'preview', { id: full.id, name: workflowName });
  };

  const handleRestore = (entry: WorkflowHistoryEntry) => {
    const full = getHistoryEntry(workflowName, entry.id) ?? entry;
    onRestore(full.nodes, full.edges, { id: full.id, savedAt: full.savedAt });
    log.info('handleRestore', 'restore', { id: full.id, name: workflowName });
  };

  return (
    <>
      <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm" onClick={handleClose} />
      <div className="fixed inset-0 z-[110] flex items-center justify-center pointer-events-none">
        <div className="pointer-events-auto w-[80vw] max-w-5xl h-[80vh] rounded-xl bg-card border border-border shadow-sm flex flex-col overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
            <History className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium text-foreground">历史版本</span>
            <span className="text-xs text-muted-foreground truncate">
              {workflowName} · 最近 {HISTORY_LIMIT} 次自动保存
            </span>
            <div className="flex-1" />
            {previewingId && (
              <span className="text-xs text-amber-700 dark:text-amber-400 shrink-0">预览中 · 未正式回退</span>
            )}
            <button
              type="button"
              onClick={handleClose}
              className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-1 min-h-0">
            {/* 版本列表 */}
            <div className="w-72 shrink-0 border-r border-border overflow-y-auto">
              {entries.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground px-4 py-12">
                  <History className="w-12 h-12 opacity-30" strokeWidth={1} />
                  <p className="text-sm mt-4 text-center">暂无历史版本</p>
                  <p className="text-xs mt-2 text-center opacity-80">编辑画布并自动保存后会出现在这里</p>
                </div>
              ) : (
                <ul className="py-2">
                  {entries.map((entry, idx) => {
                    const active = entry.id === selectedId || entry.id === previewingId;
                    return (
                      <li key={entry.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(entry.id)}
                          className={`w-full text-left px-3 py-2.5 transition-colors border-l-2 ${
                            active
                              ? 'bg-primary/10 border-primary text-foreground'
                              : 'border-transparent hover:bg-muted/40 text-foreground'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs tabular-nums text-muted-foreground w-6">#{entries.length - idx}</span>
                            <span className="text-sm font-medium truncate flex-1">
                              {formatHistoryTime(entry.savedAt)}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground pl-8">
                            <Layers className="w-3 h-3" />
                            <span>
                              {entry.nodeCount} 节点 · {entry.edgeCount} 连线
                            </span>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* 详情 / 操作 */}
            <div className="flex-1 flex flex-col min-w-0">
              {!selected ? (
                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                  <Eye className="w-12 h-12 opacity-30" strokeWidth={1} />
                  <p className="text-sm mt-4">选择左侧版本以预览或回退</p>
                </div>
              ) : (
                <>
                  <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    <div>
                      <p className="text-xs text-muted-foreground">保存时间</p>
                      <p className="text-base font-medium text-foreground mt-1">
                        {formatHistoryTime(selected.savedAt)}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 max-w-sm">
                      <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                        <p className="text-[11px] text-muted-foreground">节点</p>
                        <p className="text-lg tabular-nums font-medium">{selected.nodeCount}</p>
                      </div>
                      <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                        <p className="text-[11px] text-muted-foreground">连线</p>
                        <p className="text-lg tabular-nums font-medium">{selected.edgeCount}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">节点类型概览</p>
                      <TypeSummary nodes={selected.nodes} />
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed max-w-md">
                      先点「预览」在画布上查看该版本（可随时退出预览）。确认无误后再点「回退到此版本」正式恢复。
                    </p>
                  </div>
                  <div className="shrink-0 border-t border-border px-4 py-3 flex items-center justify-end gap-2">
                    {previewingId === selected.id ? (
                      <button
                        type="button"
                        onClick={onExitPreview}
                        className="h-9 px-3 rounded-md text-sm border border-border text-foreground hover:bg-muted/50 transition-colors"
                      >
                        退出预览
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handlePreview(selected)}
                        className="h-9 px-3 rounded-md text-sm border border-border text-foreground hover:bg-muted/50 transition-colors inline-flex items-center gap-1.5"
                      >
                        <Eye className="w-4 h-4" />
                        预览
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRestore(selected)}
                      className="h-9 px-3 rounded-md text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors inline-flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-4 h-4" />
                      回退到此版本
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function TypeSummary({ nodes }: { nodes: FlowNode[] }) {
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const n of nodes) {
      const t = n.type || 'unknown';
      map.set(t, (map.get(t) || 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [nodes]);

  if (counts.length === 0) {
    return <p className="text-sm text-muted-foreground">空画布</p>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {counts.map(([type, count]) => (
        <span
          key={type}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-xs text-foreground"
        >
          <span className="text-muted-foreground">{type}</span>
          <span className="tabular-nums font-medium">{count}</span>
        </span>
      ))}
    </div>
  );
}
