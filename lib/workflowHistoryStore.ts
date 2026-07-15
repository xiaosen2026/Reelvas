// 工作流历史版本（localStorage，每工作流最多 20 条）

import type { FlowNode, FlowEdge } from '../components/editor/flow';
import { createLogger } from './logger';

const log = createLogger('workflowHistoryStore');

const PREFIX = 'reelvas_hist_';
export const HISTORY_LIMIT = 20;

export interface WorkflowHistoryEntry {
  id: string;
  name: string;
  savedAt: number;
  nodes: FlowNode[];
  edges: FlowEdge[];
  /** 节点/连线数量摘要，列表展示用 */
  nodeCount: number;
  edgeCount: number;
  /** 内容签名，相同则跳过重复入栈 */
  signature: string;
}

function storageKey(name: string): string {
  return PREFIX + name;
}

/** 忽略选中态，仅比较会写入工作流的内容 */
export function historySignature(nodes: FlowNode[], edges: FlowEdge[]): string {
  const n = nodes.map((node) => ({
    id: node.id,
    type: node.type,
    x: node.position.x,
    y: node.position.y,
    data: node.data,
    w: node.style?.width,
    h: node.style?.height,
    group: node.group,
  }));
  const e = edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
  }));
  return JSON.stringify({ n, e });
}

function readList(name: string): WorkflowHistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(storageKey(name));
    if (!raw) return [];
    const list = JSON.parse(raw) as WorkflowHistoryEntry[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writeList(name: string, list: WorkflowHistoryEntry[]): void {
  const key = storageKey(name);
  const trimmed = list.slice(0, HISTORY_LIMIT);
  // 大图 dataURL 快照会撑爆配额；逐级丢旧版本，仍失败则清空历史
  for (let keep = trimmed.length; keep >= 0; keep--) {
    try {
      if (keep === 0) {
        localStorage.removeItem(key);
        return;
      }
      localStorage.setItem(key, JSON.stringify(trimmed.slice(0, keep)));
      if (keep < trimmed.length) {
        log.warn('writeList', 'quota shrink', { name, keep, wanted: trimmed.length });
      }
      return;
    } catch (err) {
      log.warn('writeList', 'quota retry', {
        name,
        keep,
        msg: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

export function listHistory(name: string): WorkflowHistoryEntry[] {
  return readList(name);
}

export function getHistoryEntry(name: string, id: string): WorkflowHistoryEntry | null {
  return readList(name).find((e) => e.id === id) ?? null;
}

/**
 * 推入一条历史。与栈顶签名相同则跳过。
 * 返回是否实际写入。
 */
export function pushHistory(
  name: string,
  nodes: FlowNode[],
  edges: FlowEdge[],
  opts?: { savedAt?: number },
): boolean {
  if (!name) return false;
  const signature = historySignature(nodes, edges);
  const prev = readList(name);
  if (prev[0]?.signature === signature) {
    log.debug('pushHistory', 'skip duplicate', { name });
    return false;
  }

  // 深拷贝，避免后续编辑污染历史
  const snapshotNodes = JSON.parse(JSON.stringify(nodes)) as FlowNode[];
  const snapshotEdges = JSON.parse(JSON.stringify(edges)) as FlowEdge[];
  const entry: WorkflowHistoryEntry = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    savedAt: opts?.savedAt ?? Date.now(),
    nodes: snapshotNodes.map((n) => ({ ...n, selected: false })),
    edges: snapshotEdges.map((e) => ({ ...e, selected: false })),
    nodeCount: snapshotNodes.length,
    edgeCount: snapshotEdges.length,
    signature,
  };

  writeList(name, [entry, ...prev].slice(0, HISTORY_LIMIT));
  log.info('pushHistory', 'pushed', {
    name,
    id: entry.id,
    nodes: entry.nodeCount,
    edges: entry.edgeCount,
    total: Math.min(prev.length + 1, HISTORY_LIMIT),
  });
  return true;
}

export function clearHistory(name: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(storageKey(name));
  log.info('clearHistory', 'cleared', { name });
}

export function formatHistoryTime(ts: number): string {
  try {
    return new Date(ts).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return String(ts);
  }
}
