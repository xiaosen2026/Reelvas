// 静默读取自动保存工作流（Electron 路径 / 浏览器目录句柄）

import {
  getDesktopBridge,
  loadAutoSaveDirPreference,
  loadDirectoryHandle,
  ensureDirHandlePermission,
  safeFileBase,
} from './autoSaveSettings';
import { createLogger } from './logger';

const log = createLogger('readAutoSaveWorkflow');

export interface ReadAutoSaveResult {
  ok: boolean;
  method: 'desktop' | 'browser' | 'none';
  path?: string;
  content?: string;
  payload?: {
    name: string;
    nodes: unknown[];
    edges: unknown[];
    savedAt: number;
  };
  error?: string;
}

function parsePayload(
  content: string,
  workflowName: string,
): ReadAutoSaveResult['payload'] | null {
  try {
    const data = JSON.parse(content) as {
      name?: string;
      nodes?: unknown[];
      edges?: unknown[];
      savedAt?: number;
    };
    if (!Array.isArray(data?.nodes)) return null;
    return {
      name: (data.name && String(data.name)) || safeFileBase(workflowName),
      nodes: data.nodes,
      edges: Array.isArray(data.edges) ? data.edges : [],
      savedAt: typeof data.savedAt === 'number' ? data.savedAt : Date.now(),
    };
  } catch {
    return null;
  }
}

/**
 * 静默读取自动保存工作流（不弹窗）。
 * Electron：绝对路径或 Autosave 目录+文件名；
 * 浏览器：已授权目录句柄下同名 json。
 */
export async function readAutoSaveWorkflow(
  workflowName: string,
  opts?: { absolutePath?: string; diskFileName?: string },
): Promise<ReadAutoSaveResult> {
  const fileName =
    opts?.diskFileName && opts.diskFileName.toLowerCase().endsWith('.json')
      ? opts.diskFileName
      : `${safeFileBase(workflowName)}.json`;
  const preferredDir = loadAutoSaveDirPreference();
  const desktop = getDesktopBridge();

  if (desktop?.readAutoSaveFile) {
    try {
      const looksAbsolute =
        !!opts?.absolutePath &&
        (/^[a-zA-Z]:[\\/]/.test(opts.absolutePath) || opts.absolutePath.startsWith('/'));
      const res = await desktop.readAutoSaveFile({
        absolutePath: looksAbsolute ? opts!.absolutePath : null,
        dir:
          /^[a-zA-Z]:[\\/]/.test(preferredDir) || preferredDir.startsWith('/')
            ? preferredDir
            : null,
        fileName,
      });
      if (res.ok && res.content) {
        const payload = parsePayload(res.content, workflowName);
        if (payload) {
          return {
            ok: true,
            method: 'desktop',
            path: res.path,
            content: res.content,
            payload,
          };
        }
        return { ok: false, method: 'desktop', error: 'invalid json', path: res.path };
      }
      if (!res.ok) {
        log.debug('readAutoSaveWorkflow', 'desktop miss', { error: res.error, fileName });
      }
    } catch (err) {
      log.warn('readAutoSaveWorkflow', 'desktop throw', {
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  try {
    const handle = await loadDirectoryHandle();
    if (handle) {
      const ok = await ensureDirHandlePermission(handle, 'read');
      if (ok) {
        try {
          const fileHandle = await handle.getFileHandle(fileName, { create: false });
          const file = await fileHandle.getFile();
          const content = await file.text();
          const payload = parsePayload(content, workflowName);
          if (payload) {
            return {
              ok: true,
              method: 'browser',
              path: `${preferredDir}\\${fileName}`,
              content,
              payload,
            };
          }
        } catch {
          log.debug('readAutoSaveWorkflow', 'browser file miss', { fileName });
        }
      }
    }
  } catch (err) {
    log.warn('readAutoSaveWorkflow', 'browser failed', {
      err: err instanceof Error ? err.message : String(err),
    });
  }

  return { ok: false, method: 'none', error: 'not found' };
}
