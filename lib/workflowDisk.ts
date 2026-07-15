// 工作流真实磁盘读写：优先 File System Access API，降级为下载 / 文件选择

import type { FlowNode, FlowEdge } from '../components/editor/flow';
import { createLogger } from './logger';

const log = createLogger('workflowDisk');

const ACCEPT: Record<string, string[]> = {
  'application/json': ['.json'],
};

export interface DiskWorkflowPayload {
  name: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  savedAt: number;
}

export interface OpenDiskResult {
  payload: DiskWorkflowPayload;
  /** 磁盘文件名（含 .json） */
  fileName: string;
  handle: FileSystemFileHandle | null;
}

export interface SaveDiskResult {
  name: string;
  fileName: string;
  handle: FileSystemFileHandle | null;
  method: 'fsa' | 'download';
}

type SavePickerWindow = Window &
  typeof globalThis & {
    showSaveFilePicker?: (options?: {
      suggestedName?: string;
      types?: { description: string; accept: Record<string, string[]> }[];
    }) => Promise<FileSystemFileHandle>;
    showOpenFilePicker?: (options?: {
      multiple?: boolean;
      types?: { description: string; accept: Record<string, string[]> }[];
    }) => Promise<FileSystemFileHandle[]>;
  };

export function supportsFileSystemAccess(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as SavePickerWindow;
  return typeof w.showSaveFilePicker === 'function' && typeof w.showOpenFilePicker === 'function';
}

function ensureJsonName(name: string): string {
  const base = name.trim() || '未命名工作流';
  return base.toLowerCase().endsWith('.json') ? base : `${base}.json`;
}

function stripJsonExt(name: string): string {
  return name.replace(/\.json$/i, '');
}

export function buildWorkflowJson(
  name: string,
  nodes: FlowNode[],
  edges: FlowEdge[],
): string {
  const payload: DiskWorkflowPayload = {
    name: stripJsonExt(name),
    nodes,
    edges,
    savedAt: Date.now(),
  };
  return JSON.stringify(payload, null, 2);
}

export function parseWorkflowJson(raw: string, fallbackName: string): DiskWorkflowPayload | null {
  try {
    const data = JSON.parse(raw) as Partial<DiskWorkflowPayload> & { exportedAt?: number };
    if (!data || !Array.isArray(data.nodes)) {
      log.warn('parseWorkflowJson', 'invalid nodes', { fallbackName });
      return null;
    }
    return {
      name: (data.name && String(data.name)) || stripJsonExt(fallbackName),
      nodes: data.nodes as FlowNode[],
      edges: Array.isArray(data.edges) ? (data.edges as FlowEdge[]) : [],
      savedAt: typeof data.savedAt === 'number' ? data.savedAt : Date.now(),
    };
  } catch (err) {
    log.error('parseWorkflowJson', 'JSON parse failed', {
      fallbackName,
      err: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

async function writeHandle(handle: FileSystemFileHandle, text: string): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(text);
  await writable.close();
}

/** 另存为：弹出系统保存对话框（或下载降级） */
export async function saveWorkflowAsDisk(
  suggestedName: string,
  nodes: FlowNode[],
  edges: FlowEdge[],
): Promise<SaveDiskResult | null> {
  const displayName = stripJsonExt(suggestedName);
  const fileName = ensureJsonName(displayName);
  const text = buildWorkflowJson(displayName, nodes, edges);

  if (supportsFileSystemAccess()) {
    try {
      const w = window as SavePickerWindow;
      const handle = await w.showSaveFilePicker!({
        suggestedName: fileName,
        types: [{ description: 'Reelvas 工作流', accept: { ...ACCEPT } }],
      });
      await writeHandle(handle, text);
      const finalName = stripJsonExt(handle.name || fileName);
      log.info('saveWorkflowAsDisk', 'fsa saved', { name: finalName, fileName: handle.name });
      return {
        name: finalName,
        fileName: handle.name || fileName,
        handle,
        method: 'fsa',
      };
    } catch (err) {
      const name = err instanceof Error ? err.name : '';
      if (name === 'AbortError') {
        log.info('saveWorkflowAsDisk', 'user cancelled');
        return null;
      }
      log.warn('saveWorkflowAsDisk', 'fsa failed, fallback download', {
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  downloadTextFile(fileName, text);
  log.info('saveWorkflowAsDisk', 'download fallback', { fileName });
  return {
    name: displayName,
    fileName,
    handle: null,
    method: 'download',
  };
}

/** 保存到已有 handle；无 handle 时等价于另存为 */
export async function saveWorkflowToDisk(
  handle: FileSystemFileHandle | null,
  suggestedName: string,
  nodes: FlowNode[],
  edges: FlowEdge[],
): Promise<SaveDiskResult | null> {
  if (handle) {
    try {
      const displayName = stripJsonExt(suggestedName || handle.name);
      const text = buildWorkflowJson(displayName, nodes, edges);
      await writeHandle(handle, text);
      log.info('saveWorkflowToDisk', 'wrote handle', { name: displayName, file: handle.name });
      return {
        name: displayName,
        fileName: handle.name,
        handle,
        method: 'fsa',
      };
    } catch (err) {
      log.error('saveWorkflowToDisk', 'write handle failed', {
        err: err instanceof Error ? err.message : String(err),
      });
      // 继续走另存为
    }
  }
  return saveWorkflowAsDisk(suggestedName, nodes, edges);
}

/** 打开磁盘 JSON 工作流 */
export async function openWorkflowFromDisk(): Promise<OpenDiskResult | null> {
  if (supportsFileSystemAccess()) {
    try {
      const w = window as SavePickerWindow;
      const [handle] = await w.showOpenFilePicker!({
        multiple: false,
        types: [{ description: 'Reelvas 工作流', accept: { ...ACCEPT } }],
      });
      const file = await handle.getFile();
      const raw = await file.text();
      const payload = parseWorkflowJson(raw, file.name);
      if (!payload) return null;
      log.info('openWorkflowFromDisk', 'fsa opened', { name: payload.name, file: file.name });
      return { payload, fileName: file.name, handle };
    } catch (err) {
      const name = err instanceof Error ? err.name : '';
      if (name === 'AbortError') {
        log.info('openWorkflowFromDisk', 'user cancelled');
        return null;
      }
      log.warn('openWorkflowFromDisk', 'fsa failed, fallback input', {
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return openWorkflowViaInput();
}

function openWorkflowViaInput(): Promise<OpenDiskResult | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      try {
        const raw = await file.text();
        const payload = parseWorkflowJson(raw, file.name);
        if (!payload) {
          resolve(null);
          return;
        }
        log.info('openWorkflowViaInput', 'opened', { name: payload.name, file: file.name });
        resolve({ payload, fileName: file.name, handle: null });
      } catch (err) {
        log.error('openWorkflowViaInput', 'read failed', {
          err: err instanceof Error ? err.message : String(err),
        });
        resolve(null);
      }
    };
    input.click();
  });
}

function downloadTextFile(fileName: string, text: string): void {
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
