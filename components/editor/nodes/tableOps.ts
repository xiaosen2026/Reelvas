// 表格编辑纯函数：行列增删、TSV 粘贴

import { emptyRow, renumberRows, type TableData } from './tableData';

export function insertRow(data: TableData, at?: number, mode: 'after' | 'before' = 'after'): TableData {
  const rows = data.rows.map((r) => [...r]);
  const idx = at === undefined ? rows.length : mode === 'after' ? at + 1 : at;
  rows.splice(idx, 0, emptyRow(data.cols.length, idx));
  return { ...data, rows: renumberRows(rows) };
}

export function deleteRow(data: TableData, idx: number): TableData {
  return {
    ...data,
    rows: renumberRows(data.rows.filter((_, i) => i !== idx)),
  };
}

export function insertCol(data: TableData, at?: number, mode: 'after' | 'before' = 'after'): TableData {
  const idx = at === undefined ? data.cols.length : mode === 'after' ? at + 1 : at;
  const cols = [...data.cols];
  const colWidths = [...data.colWidths];
  cols.splice(idx, 0, `列${data.cols.length + 1}`);
  colWidths.splice(idx, 0, 120);
  const rows = data.rows.map((row) => {
    const next = [...row];
    next.splice(idx, 0, '');
    return next;
  });
  return { cols, colWidths, rows };
}

export function deleteCol(data: TableData, idx: number): TableData {
  if (data.cols.length <= 1) return data;
  return {
    cols: data.cols.filter((_, i) => i !== idx),
    colWidths: data.colWidths.filter((_, i) => i !== idx),
    rows: data.rows.map((row) => row.filter((_, i) => i !== idx)),
  };
}

export function setCell(data: TableData, r: number, c: number, value: string): TableData {
  return {
    ...data,
    rows: data.rows.map((row, ri) =>
      ri === r ? row.map((cell, ci) => (ci === c ? value : cell)) : row,
    ),
  };
}

export function setColName(data: TableData, idx: number, name: string): TableData {
  return {
    ...data,
    cols: data.cols.map((c, i) => (i === idx ? name : c)),
  };
}

export function setColWidth(data: TableData, idx: number, width: number): TableData {
  const w = Math.max(40, width);
  return {
    ...data,
    colWidths: data.colWidths.map((cw, i) => (i === idx ? w : cw)),
  };
}

/** 从 (r,c) 铺开 TSV；第 0 列（镜号）不覆盖，事后 renumber */
export function applyTsvPaste(data: TableData, r: number, c: number, text: string): TableData {
  const lines = text.replace(/\r/g, '').split('\n');
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  const matrix = lines.map((l) => l.split('\t'));
  if (matrix.length === 0) return data;

  let next: TableData = {
    cols: [...data.cols],
    colWidths: [...data.colWidths],
    rows: data.rows.map((row) => [...row]),
  };

  const needRows = r + matrix.length;
  const needCols = c + Math.max(...matrix.map((row) => row.length), 0);
  while (next.cols.length < needCols) {
    next = insertCol(next);
  }
  while (next.rows.length < needRows) {
    next = insertRow(next);
  }
  for (let i = 0; i < matrix.length; i++) {
    for (let j = 0; j < matrix[i].length; j++) {
      if (c + j === 0) continue;
      next.rows[r + i][c + j] = matrix[i][j];
    }
  }
  next.rows = renumberRows(next.rows);
  return next;
}
