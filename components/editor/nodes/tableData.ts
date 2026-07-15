// 表格节点数据：默认列 / 解析 / 序列化 / 行号

export type TableData = {
  cols: string[];
  colWidths: number[];
  rows: string[][];
};

/** 与 cava ScriptEditorModal 对齐的默认剧本分镜列 */
export const DEFAULT_TABLE_COLS = [
  '镜号',
  '时长',
  '画面描述',
  '角色1',
  '角色描述1',
  '角色图1参考',
  '景别',
  '角色动作',
  '情绪',
  '场景标签',
  '光影氛围',
  '音效',
  '对白',
  '分镜提示词',
  '视频运动提示词',
] as const;

export function defaultTableData(): TableData {
  const cols = [...DEFAULT_TABLE_COLS];
  return {
    cols,
    colWidths: cols.map(() => 120),
    rows: [],
  };
}

export function parseTableData(raw: unknown): TableData {
  const base = defaultTableData();
  if (!raw || typeof raw !== 'object') return base;
  const d = raw as Partial<TableData>;
  const cols = Array.isArray(d.cols) && d.cols.length > 0
    ? d.cols.map((c) => String(c ?? ''))
    : base.cols;
  const colWidths = Array.isArray(d.colWidths) && d.colWidths.length === cols.length
    ? d.colWidths.map((w) => Math.max(40, Number(w) || 120))
    : cols.map((_, i) => Math.max(40, Number(d.colWidths?.[i]) || 120));
  const rows = Array.isArray(d.rows)
    ? d.rows.map((row) => {
        const cells = Array.isArray(row) ? row.map((c) => String(c ?? '')) : [];
        while (cells.length < cols.length) cells.push('');
        return cells.slice(0, cols.length);
      })
    : [];
  return { cols, colWidths, rows };
}

/** 从 data.table / 顶层 cols·rows / content JSON 解析 */
export function tableDataFromNodeData(data: Record<string, unknown> | undefined): TableData {
  if (!data) return defaultTableData();
  if (data.table && typeof data.table === 'object') {
    return parseTableData(data.table);
  }
  if (Array.isArray(data.cols) || Array.isArray(data.rows)) {
    return parseTableData({
      cols: data.cols,
      colWidths: data.colWidths,
      rows: data.rows,
    });
  }
  if (typeof data.content === 'string' && data.content.trim()) {
    try {
      return parseTableData(JSON.parse(data.content));
    } catch {
      return defaultTableData();
    }
  }
  return defaultTableData();
}

export function renumberRows(rows: string[][]): string[][] {
  return rows.map((row, i) => {
    const next = [...row];
    if (next.length > 0) next[0] = String(i + 1);
    return next;
  });
}

export function emptyRow(colCount: number, rowIndex: number): string[] {
  const row = new Array(colCount).fill('');
  if (colCount > 0) row[0] = String(rowIndex + 1);
  return row;
}

export function serializeTableData(t: TableData): TableData {
  return {
    cols: [...t.cols],
    colWidths: t.colWidths.map((w) => Math.max(40, w || 120)),
    rows: t.rows.map((r) => [...r]),
  };
}
