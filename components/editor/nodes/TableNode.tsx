'use client';

// 表格节点 — 卡片只读预览 + 双击全屏编辑（对齐 cava 剧本表）

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, Table2 } from 'lucide-react';
import { Handle, Position, useFlow } from '../flow';
import { NodePanel } from './NodePanel';
import { TableFullscreen } from './TableFullscreen';
import {
  serializeTableData,
  tableDataFromNodeData,
  type TableData,
} from './tableData';
import { createLogger } from '@/lib/logger';

const log = createLogger('TableNode');

interface NodeProps {
  id: string;
  data: Record<string, any>;
  selected?: boolean;
}

export function TableNode({ id, data, selected }: NodeProps) {
  const rf = useFlow();
  const label = data.label || '表格';
  const cardRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);

  const table = useMemo(() => tableDataFromNodeData(data), [data]);

  const openEditor = useCallback(() => {
    setFullscreen(true);
    log.info('openEditor', 'ok', { id, rows: table.rows.length });
  }, [id, table.rows.length]);

  const saveTable = useCallback(
    (next: TableData) => {
      const payload = serializeTableData(next);
      const sep = '| ' + payload.cols.map(() => '---').join(' | ') + ' |';
      const head = '| ' + payload.cols.join(' | ') + ' |';
      const body = payload.rows.map((r) => '| ' + payload.cols.map((_, i) => r[i] || '').join(' | ') + ' |').join('\n');
      const md = head + '\n' + sep + '\n' + body;
      rf.setNodes((nds) =>
        nds.map((n) =>
          n.id === id
            ? {
                ...n,
                data: {
                  ...n.data,
                  table: payload,
                  cols: payload.cols,
                  colWidths: payload.colWidths,
                  rows: payload.rows,
                  value: md,
                },
              }
            : n,
        ),
      );
      setFullscreen(false);
      log.info('saveTable', 'ok', { id, rows: payload.rows.length, cols: payload.cols.length });
    },
    [id, rf],
  );

  const previewCols = table.cols;
  const displayRows = table.rows;
  const contentRef = useRef<HTMLDivElement>(null);
  const cardInnerRef = useRef<HTMLDivElement>(null);

  // 输出 markdown 表格（方便 LLM 解析）
  const tableMarkdown = useMemo(() => {
    if (table.cols.length === 0) return '';
    const sep = '| ' + table.cols.map(() => '---').join(' | ') + ' |';
    const head = '| ' + table.cols.join(' | ') + ' |';
    const body = table.rows.map((r) => '| ' + table.cols.map((_, i) => r[i] || '').join(' | ') + ' |').join('\n');
    return head + '\n' + sep + '\n' + body;
  }, [table]);

  // 同步 data.value 为 markdown 表格（输出给上游）
  useEffect(() => {
    const cur = rf.getNodes().find((n) => n.id === id)?.data?.value;
    if (tableMarkdown && tableMarkdown !== cur) {
      rf.setNodes((nds) =>
        nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, value: tableMarkdown } } : n)),
      );
    }
  }, [id, rf, tableMarkdown]);

  const fitSize = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    const sw = el.scrollWidth;
    const sh = el.scrollHeight + 36;
    const node = rf.getNodes().find((n) => n.id === id);
    const cw = node?.style?.width;
    const ch = node?.style?.height;
    const nw = Math.max(sw, 320);
    const nh = Math.max(sh, 80);
    if (Math.abs(nw - (cw ?? 0)) > 2 || Math.abs(nh - (ch ?? 0)) > 2) {
      rf.setNodes((nds) =>
        nds.map((n) =>
          n.id === id ? { ...n, style: { ...n.style, width: nw, height: nh } } : n,
        ),
      );
    }
  }, [id, rf]);

  useEffect(() => {
    fitSize();
    const t = setTimeout(fitSize, 80);
    return () => clearTimeout(t);
  }, [fitSize, table]);

  return (
    <div className="relative group w-full h-full flex flex-col gap-2">
      <div className="absolute left-0 bottom-full pb-1.5 flex items-center gap-1.5">
        <Table2 className="size-3 text-muted-foreground" />
        <span className="text-[11px] text-muted-foreground font-medium tracking-wide">{label}</span>
        {table.rows.length > 0 ? (
          <span className="text-[10px] px-1.5 py-0.5 rounded-md border border-border text-muted-foreground">
            {table.rows.length}×{table.cols.length}
          </span>
        ) : null}
      </div>

      <div className="relative w-full" ref={cardRef}>
        <div
          className={`relative bg-card border rounded-2xl w-full flex flex-col cursor-move transition-[box-shadow,border-color] duration-200 ${
            selected ? 'ring-2 ring-zinc-500' : 'border-border/80'
          }`}
          ref={cardInnerRef}
          onDoubleClick={(e) => {
            e.stopPropagation();
            openEditor();
          }}
        >
          {table.rows.length === 0 && table.cols.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground py-8" ref={contentRef}>
              <div className="flex items-center justify-center size-16 rounded-2xl bg-muted/50">
                <Table2 className="size-8" />
              </div>
              <p className="text-xs px-4 text-center">双击进入编辑表格</p>
            </div>
          ) : (
            <div className="p-2 pointer-events-none select-none" ref={contentRef}>
              <table className="min-w-max border-collapse text-[10px]">
                <thead>
                  <tr>
                    {previewCols.map((c, i) => (
                      <th
                        key={`pc-${i}`}
                        className="border border-border bg-muted/40 px-1.5 py-0.5 text-left font-medium text-muted-foreground whitespace-nowrap"
                      >
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayRows.map((row, ri) => (
                    <tr
                      key={`pr-${ri}`}
                      className={(ri + 1) % 2 === 1 ? 'bg-muted/30' : 'bg-background'}
                    >
                      {previewCols.map((_, ci) => (
                        <td
                          key={`pd-${ri}-${ci}`}
                          className="border border-border px-1.5 py-0.5 text-foreground/80 whitespace-nowrap"
                        >
                          {row[ci] || ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {table.rows.length === 0 ? (
                <p className="mt-3 text-center text-xs text-muted-foreground">双击进入编辑 · 添加行数据</p>
              ) : null}
            </div>
          )}
          <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2">
            <span className="rounded-full bg-foreground/70 px-3 py-1 text-xs text-background backdrop-blur-sm">
              拖动节点 · 双击全屏编辑
            </span>
          </div>
          <button
            type="button"
            className="nodrag absolute top-2 right-2 z-10 flex items-center gap-1 rounded-full border border-border bg-background/80 px-2.5 py-1 text-xs text-muted-foreground shadow-sm backdrop-blur-sm hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              openEditor();
            }}
          >
            <Maximize2 className="size-3.5" />
            <span>编辑</span>
          </button>
        </div>
        <Handle type="target" position={Position.Left} style={{ left: -6, top: '50%', transform: 'translateY(-50%)' }} />
        <Handle type="source" position={Position.Right} style={{ right: -6, top: '50%', transform: 'translateY(-50%)' }} />
      </div>

      <NodePanel cardRef={cardRef} selected={selected} panelW={360}>
        <div className="flex items-center gap-2 px-1 py-0.5">
          <Table2 className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">表格</span>
          <span className="text-[11px] text-muted-foreground">
            {table.rows.length} 行 · {table.cols.length} 列
          </span>
          <div className="flex-1" />
          <button
            type="button"
            onClick={openEditor}
            className="h-7 px-2.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 flex items-center gap-1"
          >
            <Maximize2 className="size-3.5" />
            全屏编辑
          </button>
        </div>
        <p className="px-1 text-xs text-muted-foreground">
          双击卡片进入编辑；Esc 关闭，Ctrl+S 保存。支持 Excel TSV 粘贴。
        </p>
      </NodePanel>

      <TableFullscreen
        open={fullscreen}
        title={label}
        initial={table}
        onSave={saveTable}
        onClose={() => setFullscreen(false)}
      />
    </div>
  );
}
