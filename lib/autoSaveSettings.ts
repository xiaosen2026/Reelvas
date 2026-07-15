// 自动保存目录偏好 + 落盘（Electron 文档目录 / 浏览器目录授权）

import { createLogger } from './logger';

const log = createLogger('autoSaveSettings');

const PATH_KEY = 'reelvas_autosave_dir';
const DIR_HANDLE_DB = 'reelvas_fs';
const DIR_HANDLE_STORE = 'handles';
const DIR_HANDLE_KEY = 'autosave_dir';

export const AUTOSAVE_FOLDER_SEGMENTS = ['Reelvas', 'Autosave'] as const;

export interface DesktopBridge {
  isDesktop: true;
  getDefaultAutoSaveDir: () => Promise<string>;
  ensureAutoSaveDir: (dir?: string | null) => Promise<{ ok: boolean; dir: string; error?: string }>;
  writeAutoSaveFile: (payload: {
    dir?: string | null;
    fileName: string;
    content: string;
  }) => Promise<{ ok: boolean; path?: string; dir?: string; error?: string }>;
  /** 读自动保存文件或任意绝对路径 JSON */
  readAutoSaveFile: (payload: {
    dir?: string | null;
    fileName?: string;
    absolutePath?: string | null;
  }) => Promise<{ ok: boolean; content?: string; path?: string; error?: string }>;
  chooseAutoSaveDir: () => Promise<{ ok: boolean; dir?: string; cancelled?: boolean; error?: string }>;
  openAutoSaveDir: (dir?: string | null) => Promise<{ ok: boolean; error?: string }>;
}

declare global {
  interface Window {
    reelvasDesktop?: DesktopBridge;
  }
}

export function getDesktopBridge(): DesktopBridge | null {
  if (typeof window === 'undefined') return null;
  return window.reelvasDesktop ?? null;
}

/** 展示用默认路径（无 Electron 时按平台惯例拼） */
export function getDefaultAutoSaveDirFallback(): string {
  if (typeof navigator !== 'undefined' && /Win/i.test(navigator.platform || navigator.userAgent)) {
    // 用户名未知时用占位；实际落盘走 Electron 或目录授权
    return '文档\\Reelvas\\Autosave';
  }
  return 'Documents/Reelvas/Autosave';
}

export function loadAutoSaveDirPreference(): string {
  if (typeof window === 'undefined') return getDefaultAutoSaveDirFallback();
  try {
    const raw = localStorage.getItem(PATH_KEY);
    if (raw && raw.trim()) return raw.trim();
  } catch {
    /* ignore */
  }
  return getDefaultAutoSaveDirFallback();
}

export function saveAutoSaveDirPreference(dir: string): void {
  if (typeof window === 'undefined') return;
  const v = dir.trim();
  localStorage.setItem(PATH_KEY, v);
  log.info('saveAutoSaveDirPreference', 'saved', { dir: v });
  window.dispatchEvent(new CustomEvent('reelvas-autosave-dir', { detail: { dir: v } }));
}

export async function resolveDefaultAutoSaveDir(): Promise<string> {
  const desktop = getDesktopBridge();
  if (desktop) {
    try {
      const dir = await desktop.getDefaultAutoSaveDir();
      if (dir) return dir;
    } catch (err) {
      log.warn('resolveDefaultAutoSaveDir', 'desktop failed', {
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return getDefaultAutoSaveDirFallback();
}

/** 启动时：若用户未自定义路径，写入默认文档目录 */
export async function ensureAutoSaveDirPreference(): Promise<string> {
  if (typeof window === 'undefined') return getDefaultAutoSaveDirFallback();
  try {
    const existing = localStorage.getItem(PATH_KEY);
    if (existing && existing.trim()) return existing.trim();
  } catch {
    /* ignore */
  }
  const dir = await resolveDefaultAutoSaveDir();
  saveAutoSaveDirPreference(dir);
  const desktop = getDesktopBridge();
  if (desktop) {
    try {
      await desktop.ensureAutoSaveDir(dir);
    } catch (err) {
      log.warn('ensureAutoSaveDirPreference', 'ensure failed', {
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return dir;
}

// ── 浏览器：目录句柄（IndexedDB） ──

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

export async function storeDirectoryHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openHandleDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(DIR_HANDLE_STORE, 'readwrite');
    tx.objectStore(DIR_HANDLE_STORE).put(handle, DIR_HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function loadDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openHandleDb();
    const handle = await new Promise<FileSystemDirectoryHandle | null>((resolve, reject) => {
      const tx = db.transaction(DIR_HANDLE_STORE, 'readonly');
      const req = tx.objectStore(DIR_HANDLE_STORE).get(DIR_HANDLE_KEY);
      req.onsuccess = () => resolve((req.result as FileSystemDirectoryHandle) || null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return handle;
  } catch {
    return null;
  }
}

async function ensurePermission(
  handle: FileSystemDirectoryHandle,
  mode: 'read' | 'readwrite' = 'readwrite',
): Promise<boolean> {
  const h = handle as FileSystemDirectoryHandle & {
    queryPermission?: (o: { mode: string }) => Promise<PermissionState>;
    requestPermission?: (o: { mode: string }) => Promise<PermissionState>;
  };
  if (h.queryPermission) {
    const q = await h.queryPermission({ mode });
    if (q === 'granted') return true;
  }
  if (h.requestPermission) {
    const r = await h.requestPermission({ mode });
    return r === 'granted';
  }
  return true;
}

/** 对外：目录句柄权限 */
export async function ensureDirHandlePermission(
  handle: FileSystemDirectoryHandle,
  mode: 'read' | 'readwrite' = 'readwrite',
): Promise<boolean> {
  return ensurePermission(handle, mode);
}

export async function pickBrowserAutoSaveDir(): Promise<string | null> {
  const w = window as Window & {
    showDirectoryPicker?: (opts?: {
      id?: string;
      mode?: 'read' | 'readwrite';
      startIn?: string;
    }) => Promise<FileSystemDirectoryHandle>;
  };
  if (typeof w.showDirectoryPicker !== 'function') {
    log.warn('pickBrowserAutoSaveDir', 'showDirectoryPicker unavailable');
    return null;
  }
  try {
    const handle = await w.showDirectoryPicker({
      id: 'reelvas-autosave',
      mode: 'readwrite',
      startIn: 'documents',
    });
    await storeDirectoryHandle(handle);
    // 在授权目录下确保 Reelvas/Autosave 子目录（若用户直接选了文档根）
    let target = handle;
    for (const seg of AUTOSAVE_FOLDER_SEGMENTS) {
      target = await target.getDirectoryHandle(seg, { create: true });
    }
    await storeDirectoryHandle(target);
    const label = target.name === 'Autosave' ? `文档\\Reelvas\\Autosave` : target.name;
    saveAutoSaveDirPreference(label);
    log.info('pickBrowserAutoSaveDir', 'picked', { name: target.name });
    return label;
  } catch (err) {
    const name = err instanceof Error ? err.name : '';
    if (name === 'AbortError') return null;
    log.error('pickBrowserAutoSaveDir', 'failed', {
      err: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

export function safeFileBase(name: string): string {
  return (name || '未命名工作流')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/\.json$/i, '')
    .trim() || '未命名工作流';
}

/** 自动保存写入：优先桌面 IPC，其次浏览器目录句柄；始终不弹窗 */
export async function writeAutoSaveWorkflow(
  workflowName: string,
  content: string,
): Promise<{ ok: boolean; path?: string; method: 'desktop' | 'browser' | 'none'; error?: string }> {
  const fileName = `${safeFileBase(workflowName)}.json`;
  const preferredDir = loadAutoSaveDirPreference();
  const desktop = getDesktopBridge();

  if (desktop) {
    try {
      // 绝对路径用用户配置；「文档\\…」占位符则交给主进程默认目录
      const looksAbsolute = /^[a-zA-Z]:[\\/]/.test(preferredDir) || preferredDir.startsWith('/');
      const res = await desktop.writeAutoSaveFile({
        dir: looksAbsolute ? preferredDir : null,
        fileName,
        content,
      });
      if (res.ok) {
        log.info('writeAutoSaveWorkflow', 'desktop ok', { path: res.path });
        return { ok: true, path: res.path, method: 'desktop' };
      }
      return { ok: false, method: 'desktop', error: res.error };
    } catch (err) {
      log.error('writeAutoSaveWorkflow', 'desktop throw', {
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  try {
    let handle = await loadDirectoryHandle();
    if (handle) {
      const ok = await ensurePermission(handle, 'readwrite');
      if (!ok) {
        log.warn('writeAutoSaveWorkflow', 'permission denied');
        return { ok: false, method: 'browser', error: 'permission denied' };
      }
      const file = await handle.getFileHandle(fileName, { create: true });
      const writable = await file.createWritable();
      await writable.write(content);
      await writable.close();
      log.info('writeAutoSaveWorkflow', 'browser ok', { fileName });
      return { ok: true, path: `${preferredDir}\\${fileName}`, method: 'browser' };
    }
  } catch (err) {
    log.warn('writeAutoSaveWorkflow', 'browser handle failed', {
      err: err instanceof Error ? err.message : String(err),
    });
  }

  return { ok: false, method: 'none', error: 'no native write path' };
}

export async function chooseAutoSaveDirectory(): Promise<string | null> {
  const desktop = getDesktopBridge();
  if (desktop) {
    const res = await desktop.chooseAutoSaveDir();
    if (res.ok && res.dir) {
      saveAutoSaveDirPreference(res.dir);
      await desktop.ensureAutoSaveDir(res.dir);
      return res.dir;
    }
    return null;
  }
  return pickBrowserAutoSaveDir();
}

export async function openAutoSaveDirectoryInOs(): Promise<boolean> {
  const desktop = getDesktopBridge();
  if (!desktop) return false;
  const dir = loadAutoSaveDirPreference();
  const res = await desktop.openAutoSaveDir(dir.includes('文档') ? null : dir);
  return !!res.ok;
}
