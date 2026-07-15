'use client';

// 表格全屏编辑：行列 CRUD、列宽、TSV 粘贴、Esc/Ctrl+S

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Save, X } from 'lucide-react';
import type { TableData } from './tableData';
import {
  applyTsvPaste,
  deleteCol,
  deleteRow,
  insertCol,
  insertRow,
  setCell,
  setColName,
  setColWidth,
} from './tableOps';
import { createLogger } from '@/lib/logger';

const log = createLogger('TableFullscreen');

type Props = {
  open: boolean;
  title: string;
  initial: TableData;
  onSave: (data: TableData) => void;
  onClose: () => void;
};

export function TableFullscreen({ open, title, initial, onSave, onClose }: Props) {
  const [data, setData] = useState<TableData>(initial);
  const [editing, setEditing] = useState<{ r: number; c: number } | null>(null);
  const resizeRef = useRef<{ ci: number; startX: number; startW: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    setData(initial);
    setEditing(null);
    log.info('open', 'load', { rows: initial.rows.length, cols: initial.cols.length });
  }, [open, initial]);

  const handleSave = useCallback(() => {
    onSave(data);
    log.info('save', 'ok', { rows: data.rows.length, cols: data.cols.length });
  }, [data, onSave]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, handleSave]);

  const onResizePointerDown = useCallback(
    (ci: number, e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      resizeRef.current = { ci, startX: e.clientX, startW: data.colWidths[ci] || 120 };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [data.colWidths],
  );

  const onResizePointerMove = useCallback((e: React.PointerEvent) => {
    const st = resizeRef.current;
    if (!st) return;
    setData((prev) => setColWidth(prev, st.ci, st.startW + e.clientX - st.startX));
  }, []);

  const onResizePointerUp = useCallback(() => {
    resizeRef.current = null;
  }, []);

  if (!open || typeof document === 'undefined') return null;

  const { cols, colWidths, rows } = data;

  return createPortal(
    <div
      className="fixed inset-0 z-300 flex flex-col bg-background text-foreground"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-border shrink-0">
        <span className="text-sm text-muted-foreground truncate">
          {title} — {rows.length} 行 × {cols.length} 列
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            className="h-8 px-3 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 flex items-center gap-1"
            onClick={() => setData((d) => insertRow(d, editing?.r, editing ? 'after' : 'after'))}
          >
            <Plus className="size-3.5" /> 行
          </button>
          <button
            type="button"
            className="h-8 px-3 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 flex items-center gap-1"
            onClick={() => setData((d) => insertCol(d, editing?.c, editing ? 'after' : 'after'))}
          >
            <Plus className="size-3.5" /> 列
          </button>
          <button
            type="button"
            className="h-8 px-3 rounded-lg bg-foreground text-background text-xs font-medium hover:opacity-90 flex items-center gap-1.5"
            onClick={handleSave}
          >
            <Save className="size-3.5" />
            保存 Ctrl+S
          </button>
          <button
            type="button"
            className="h-8 px-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
            onClick={onClose}
          >
            <X className="size-4" />
            关闭 Esc
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto min-h-0 pt-4">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="p-1 text-muted-foreground text-[10px] w-10 border-r border-border">#</th>
              {cols.map((col, ci) => (
                <th
                  key={`h-${ci}`}
                  className="p-1 border-r border-border text-left relative group overflow-visible"
                  style={{ width: colWidths[ci] || 120, minWidth: colWidths[ci] || 120 }}
                >
                  <input
                    value={col}
                    onChange={(e) => setData((d) => setColName(d, ci, e.target.value))}
                    className="bg-transparent text-muted-foreground text-xs font-medium outline-none w-full p-0.5 rounded hover:bg-muted/40"
                  />
                  <button
                    type="button"
                    className="absolute right-1 top-1/2 -translate-y-1/2 w-4 h-4 rounded text-muted-foreground/40 hover:text-red-500 text-[10px] opacity-0 group-hover:opacity-100"
                    title="删除列"
                    onClick={() => setData((d) => deleteCol(d, ci))}
                  >
                    ×
                  </button>
                  {/* 列分割线顶部（列右边界上端），非标题中心 */}
                  <button
                    type="button"
                    className="absolute right-0 -top-2.5 translate-x-1/2 w-5 h-5 rounded-full border border-border bg-card text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 text-xs flex items-center justify-center z-30 shadow-sm pointer-events-auto"
                    title="右侧插入列"
                    onClick={(e) => {
                      e.stopPropagation();
                      setData((d) => insertCol(d, ci, 'after'));
                    }}
                  >
                    +
                  </button>
                  <div
                    className="absolute right-0 top-3 bottom-0 w-2 cursor-col-resize hover:bg-foreground/10 z-10"
                    onPointerDown={(e) => onResizePointerDown(ci, e)}
                    onPointerMove={onResizePointerMove}
                    onPointerUp={onResizePointerUp}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr
                key={`r-${ri}`}
                className={`group transition-colors hover:bg-muted/40 ${(ri + 1) % 2 === 1 ? 'bg-muted/30 shadow-sm' : 'bg-background'}`}
              >
                <td className="p-1 text-muted-foreground text-[10px] text-center border-r border-border align-top relative">
                  <div className="flex flex-col items-center gap-0.5">
                    <span>{ri + 1}</span>
                    <button
                      type="button"
                      className="w-4 h-4 rounded text-muted-foreground/40 hover:text-red-500 text-[10px] opacity-0 group-hover:opacity-100"
                      title="删除行"
                      onClick={() => setData((d) => deleteRow(d, ri))}
                    >
                      ×
                    </button>
                  </div>
                  <button
                    type="button"
                    className="absolute left-1/2 -translate-x-1/2 -bottom-2.5 w-5 h-5 rounded-full border border-border bg-card text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 text-xs flex items-center justify-center z-10 shadow-sm"
                    title="下方插入行"
                    onClick={() => setData((d) => insertRow(d, ri, 'after'))}
                  >
                    +
                  </button>
                </td>
                {row.map((cell, ci) => {
                  const isShot = ci === 0;
                  const isEdit = !isShot && editing?.r === ri && editing?.c === ci;
                  return (
                    <td
                      key={`c-${ri}-${ci}`}
                      className={`p-0 border-r border-border ${isShot ? 'cursor-default' : 'cursor-text'}`}
                      onClick={() => {
                        if (!isShot) setEditing({ r: ri, c: ci });
                      }}
                    >
                      {isEdit ? (
                        <textarea
                          autoFocus
                          defaultValue={cell}
                          onBlur={(e) => {
                            setData((d) => setCell(d, ri, ci, e.target.value));
                            setEditing(null);
                          }}
                          onPaste={(e) => {
                            const text = e.clipboardData.getData('text') || '';
                            if (!text.includes('\t') && !text.includes('\n')) return;
                            e.preventDefault();
                            setData((d) => applyTsvPaste(d, ri, ci, text));
                            setEditing(null);
                            log.info('paste', 'tsv', { r: ri, c: ci });
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                              e.preventDefault();
                              setData((d) => setCell(d, ri, ci, (e.target as HTMLTextAreaElement).value));
                              setEditing(null);
                            }
                          }}
                          className="w-full bg-muted/50 text-foreground text-sm outline-none p-2 resize-y min-h-16 border border-border"
                        />
                      ) : (
                        <div
                          className={`p-1.5 text-sm whitespace-pre-wrap min-h-8 ${
                            isShot ? 'text-muted-foreground' : 'text-foreground/80'
                          }`}
                        >
                          {cell || '\u00a0'}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            暂无数据，点「+ 行」或从 Excel 粘贴 TSV
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
