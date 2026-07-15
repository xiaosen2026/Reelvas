// 工作流本地镜像 + 最近列表（localStorage）
// 真实磁盘读写见 workflowDisk.ts；镜像失败也必须保留最近列表

import type { FlowNode, FlowEdge } from '../components/editor/flow';
import { createLogger } from './logger';

const log = createLogger('workflowStore');
const RECENT_KEY = 'reelvas_recent_files';
const LAST_KEY = 'reelvas_last_workflow';
const LAST_DISK_KEY = 'reelvas_last_disk_snapshot';
const PREFIX = 'reelvas_wf_';

export interface WorkflowFile {
  name: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  savedAt: number;
  /** 上次落盘文件名（含 .json），仅作展示 */
  diskFileName?: string;
}

export interface RecentEntry {
  name: string;
  savedAt: number;
  diskFileName?: string;
}

/** 上次磁盘/自动保存快照元数据（冷启动优先读盘） */
export interface LastDiskSnapshot {
  name: string;
  diskFileName?: string;
  /** 绝对路径（Electron）或展示路径 */
  path?: string;
  source: 'file' | 'autosave';
  savedAt: number;
}

/** 启动时要恢复的上次工作流 */
export interface StartupWorkflow {
  name: string;
  file: WorkflowFile | null;
  isNew: boolean;
  /** 若从 FSA 文件句柄恢复，供后续保存复用 */
  handle?: FileSystemFileHandle | null;
  source?: 'mirror' | 'file' | 'autosave' | 'new';
}

export interface SaveMirrorResult {
  mirrored: boolean;
  name: string;
  savedAt: number;
}

function readRecent(): RecentEntry[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as RecentEntry[]) : [];
  } catch {
    return [];
  }
}

function writeRecent(list: RecentEntry[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 30)));
  } catch (err) {
    log.warn('writeRecent', 'failed', {
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

/** 推到最近列表首位并记上次打开（不依赖镜像是否成功） */
function pushRecent(name: string, savedAt: number, diskFileName?: string): void {
  const n = name.trim();
  if (!n) return;
  const prev = readRecent().find((r) => r.name === n);
  const recent = readRecent().filter((r) => r.name !== n);
  recent.unshift({
    name: n,
    savedAt,
    diskFileName: diskFileName ?? prev?.diskFileName,
  });
  writeRecent(recent);
  setLastOpened(n);
}

export function getRecent(): RecentEntry[] {
  return readRecent();
}

export function getLastOpened(): string | null {
  try {
    const n = localStorage.getItem(LAST_KEY);
    return n && n.trim() ? n.trim() : null;
  } catch {
    return null;
  }
}

export function setLastOpened(name: string | null): void {
  try {
    if (!name?.trim()) {
      localStorage.removeItem(LAST_KEY);
      return;
    }
    localStorage.setItem(LAST_KEY, name.trim());
  } catch {
    /* ignore quota */
  }
}

export function getLastDiskSnapshot(): LastDiskSnapshot | null {
  try {
    const raw = localStorage.getItem(LAST_DISK_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as LastDiskSnapshot;
    if (!data?.name) return null;
    return data;
  } catch {
    return null;
  }
}

export function setLastDiskSnapshot(snap: LastDiskSnapshot | null): void {
  try {
    if (!snap) {
      localStorage.removeItem(LAST_DISK_KEY);
      return;
    }
    localStorage.setItem(LAST_DISK_KEY, JSON.stringify(snap));
  } catch (err) {
    log.warn('setLastDiskSnapshot', 'failed', {
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

/** 仅更新「最近/上次打开」，不改镜像内容（用于打开最近） */
export function touchOpened(name: string): void {
  const n = name.trim();
  if (!n) return;
  const prev = readRecent().find((r) => r.name === n);
  pushRecent(n, Date.now(), prev?.diskFileName);
  log.info('touchOpened', 'last opened', { name: n });
}

/**
 * 写入 localStorage 镜像。
 * 无论镜像是否因配额失败，都更新最近列表与上次打开，且不抛错。
 */
export function save(
  name: string,
  nodes: FlowNode[],
  edges: FlowEdge[],
  meta?: { diskFileName?: string },
): SaveMirrorResult {
  const savedAt = Date.now();
  const file: WorkflowFile = {
    name,
    nodes,
    edges,
    savedAt,
    diskFileName: meta?.diskFileName,
  };

  let mirrored = false;
  try {
    localStorage.setItem(PREFIX + name, JSON.stringify(file));
    mirrored = true;
  } catch (err) {
    log.warn('save', 'mirror write failed', {
      name,
      err: err instanceof Error ? err.message : String(err),
    });
  }

  // 镜像失败也必须写最近列表
  pushRecent(name, savedAt, meta?.diskFileName);

  if (mirrored) {
    log.info('save', 'local mirror', {
      name,
      nodes: nodes.length,
      edges: edges.length,
    });
  } else {
    log.warn('save', 'recent only (no mirror body)', {
      name,
      nodes: nodes.length,
      edges: edges.length,
    });
  }
  return { mirrored, name, savedAt };
}

export function load(name: string): WorkflowFile | null {
  try {
    const raw = localStorage.getItem(PREFIX + name);
    return raw ? (JSON.parse(raw) as WorkflowFile) : null;
  } catch {
    return null;
  }
}

export function remove(name: string): void {
  localStorage.removeItem(PREFIX + name);
  writeRecent(readRecent().filter((r) => r.name !== name));
  if (getLastOpened() === name) {
    const next = readRecent()[0]?.name || null;
    setLastOpened(next);
  }
  log.info('remove', 'removed', { name });
}

/**
 * 同步启动恢复（仅镜像）：优先上次打开 → 最近列表首位。
 * 完整冷启动（磁盘/自动保存）见 resolveStartupWorkflowAsync。
 */
export function resolveStartupWorkflow(): StartupWorkflow {
  const recent = readRecent();
  const candidates = [getLastOpened(), recent[0]?.name].filter(
    (x): x is string => Boolean(x && x.trim()),
  );
  const tried = new Set<string>();
  for (const name of candidates) {
    if (tried.has(name)) continue;
    tried.add(name);
    const file = load(name);
    if (file) {
      log.info('resolveStartupWorkflow', 'restore mirror', {
        name,
        nodes: file.nodes?.length ?? 0,
      });
      return { name: file.name || name, file, isNew: false, source: 'mirror' };
    }
  }
  const name = suggestName(recent.map((r) => r.name));
  log.info('resolveStartupWorkflow', 'new empty', { name });
  return { name, file: null, isNew: true, source: 'new' };
}

export function exportJson(name: string, nodes: FlowNode[], edges: FlowEdge[]): string {
  return JSON.stringify({ name, nodes, edges, exportedAt: Date.now() }, null, 2);
}

export function suggestName(existing: string[]): string {
  let i = 1;
  while (existing.includes(`未命名工作流 ${i}`)) i++;
  return `未命名工作流 ${i}`;
}
