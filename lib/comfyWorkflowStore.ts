// ComfyUI 工作流 JSON 本地存储（localStorage）

import { createLogger } from './logger';

const log = createLogger('comfyWorkflowStore');
const STORAGE_KEY = 'reelvas_comfy_workflows';

export interface ComfyWorkflowItem {
  id: string;
  name: string;
  json: string;
  serverUrl: string;
  createdAt: number;
  updatedAt: number;
}

function readAll(): ComfyWorkflowItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeAll(list: ComfyWorkflowItem[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

let idSeq = Date.now();
function genId(): string {
  return 'cw_' + (idSeq++).toString(36);
}

/** 获取所有工作流 */
export function listComfyWorkflows(): ComfyWorkflowItem[] {
  return readAll();
}

/** 获取单条 */
export function getComfyWorkflow(id: string): ComfyWorkflowItem | undefined {
  return readAll().find((w) => w.id === id);
}

/** 新增 */
export function addComfyWorkflow(name: string, json: string, serverUrl = 'http://127.0.0.1:8188'): ComfyWorkflowItem {
  const now = Date.now();
  const item: ComfyWorkflowItem = { id: genId(), name, json, serverUrl, createdAt: now, updatedAt: now };
  const list = readAll();
  list.push(item);
  writeAll(list);
  log.info('add', 'ok', { id: item.id, name });
  return item;
}

/** 更新 */
export function updateComfyWorkflow(id: string, patch: Partial<Pick<ComfyWorkflowItem, 'name' | 'json' | 'serverUrl'>>): boolean {
  const list = readAll();
  const idx = list.findIndex((w) => w.id === id);
  if (idx === -1) return false;
  list[idx] = { ...list[idx], ...patch, updatedAt: Date.now() };
  writeAll(list);
  log.info('update', 'ok', { id });
  return true;
}

/** 删除 */
export function deleteComfyWorkflow(id: string): boolean {
  const list = readAll().filter((w) => w.id !== id);
  writeAll(list);
  log.info('delete', 'ok', { id });
  return true;
}
