// 持久化上次工作流 FileSystemFileHandle（IndexedDB，与 autosave 目录同库）

import { createLogger } from './logger';

const log = createLogger('workflowHandleStore');

const DIR_HANDLE_DB = 'reelvas_fs';
const DIR_HANDLE_STORE = 'handles';
const LAST_WORKFLOW_FILE_KEY = 'last_workflow_file';

function openHandleDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DIR_HANDLE_DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DIR_HANDLE_STORE)) {
        db.createObjectStore(DIR_HANDLE_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function storeLastWorkflowFileHandle(
  handle: FileSystemFileHandle | null,
): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const db = await openHandleDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(DIR_HANDLE_STORE, 'readwrite');
      const store = tx.objectStore(DIR_HANDLE_STORE);
      if (handle) store.put(handle, LAST_WORKFLOW_FILE_KEY);
      else store.delete(LAST_WORKFLOW_FILE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    log.info('storeLastWorkflowFileHandle', handle ? 'stored' : 'cleared', {
      name: handle?.name,
    });
  } catch (err) {
    log.warn('storeLastWorkflowFileHandle', 'failed', {
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function loadLastWorkflowFileHandle(): Promise<FileSystemFileHandle | null> {
  if (typeof window === 'undefined') return null;
  try {
    const db = await openHandleDb();
    const handle = await new Promise<FileSystemFileHandle | null>((resolve, reject) => {
      const tx = db.transaction(DIR_HANDLE_STORE, 'readonly');
      const req = tx.objectStore(DIR_HANDLE_STORE).get(LAST_WORKFLOW_FILE_KEY);
      req.onsuccess = () => resolve((req.result as FileSystemFileHandle) || null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return handle;
  } catch {
    return null;
  }
}

/** 仅 queryPermission，避免冷启动弹权限框；已 granted 才返回 true */
export async function hasFileHandleReadPermission(
  handle: FileSystemFileHandle,
): Promise<boolean> {
  const h = handle as FileSystemFileHandle & {
    queryPermission?: (o: { mode: string }) => Promise<PermissionState>;
  };
  try {
    if (h.queryPermission) {
      const q = await h.queryPermission({ mode: 'read' });
      return q === 'granted';
    }
    return true;
  } catch {
    return false;
  }
}

export async function readWorkflowFromFileHandle(
  handle: FileSystemFileHandle,
): Promise<{ name: string; nodes: unknown[]; edges: unknown[]; savedAt: number; fileName: string } | null> {
  try {
    const ok = await hasFileHandleReadPermission(handle);
    if (!ok) {
      log.info('readWorkflowFromFileHandle', 'no permission', { name: handle.name });
      return null;
    }
    const file = await handle.getFile();
    const raw = await file.text();
    const data = JSON.parse(raw) as {
      name?: string;
      nodes?: unknown[];
      edges?: unknown[];
      savedAt?: number;
    };
    if (!data || !Array.isArray(data.nodes)) return null;
    const fileName = file.name || handle.name;
    const name = (data.name && String(data.name)) || fileName.replace(/\.json$/i, '');
    return {
      name,
      nodes: data.nodes,
      edges: Array.isArray(data.edges) ? data.edges : [],
      savedAt: typeof data.savedAt === 'number' ? data.savedAt : Date.now(),
      fileName,
    };
  } catch (err) {
    log.warn('readWorkflowFromFileHandle', 'failed', {
      err: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
