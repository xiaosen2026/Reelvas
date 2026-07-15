// 冷启动恢复：上次磁盘文件 → 自动保存目录 → localStorage 镜像

import type { FlowEdge, FlowNode } from '../components/editor/flow';
import {
  getLastDiskSnapshot,
  getLastOpened,
  getRecent,
  load,
  resolveStartupWorkflow,
  suggestName,
  type StartupWorkflow,
  type WorkflowFile,
} from './workflowStore';
import {
  loadLastWorkflowFileHandle,
  readWorkflowFromFileHandle,
} from './workflowHandleStore';
import { readAutoSaveWorkflow } from './readAutoSaveWorkflow';
import { createLogger } from './logger';

const log = createLogger('resolveStartup');

function toWorkflowFile(
  name: string,
  nodes: FlowNode[],
  edges: FlowEdge[],
  savedAt: number,
  diskFileName?: string,
): WorkflowFile {
  return { name, nodes, edges, savedAt, diskFileName };
}

/**
 * 启动永远优先「上次磁盘」：
 * 1) IndexedDB 中的 FSA 文件句柄（已授权读）
 * 2) Electron / 浏览器自动保存目录中的上次文件
 * 3) localStorage 镜像
 * 4) 新建空工作流
 */
export async function resolveStartupWorkflowAsync(): Promise<StartupWorkflow> {
  if (typeof window === 'undefined') {
    return resolveStartupWorkflow();
  }

  // 1) 上次手动打开/保存的文件句柄
  try {
    const handle = await loadLastWorkflowFileHandle();
    if (handle) {
      const fromFile = await readWorkflowFromFileHandle(handle);
      if (fromFile) {
        log.info('resolveStartupWorkflowAsync', 'from file handle', {
          name: fromFile.name,
          nodes: fromFile.nodes.length,
        });
        return {
          name: fromFile.name,
          file: toWorkflowFile(
            fromFile.name,
            fromFile.nodes as FlowNode[],
            fromFile.edges as FlowEdge[],
            fromFile.savedAt,
            fromFile.fileName,
          ),
          isNew: false,
          handle,
          source: 'file',
        };
      }
    }
  } catch (err) {
    log.warn('resolveStartupWorkflowAsync', 'file handle path failed', {
      err: err instanceof Error ? err.message : String(err),
    });
  }

  // 2) 自动保存目录（Electron 绝对路径 / 浏览器目录句柄）
  const snap = getLastDiskSnapshot();
  const candidates: string[] = [];
  if (snap?.name) candidates.push(snap.name);
  const last = getLastOpened();
  if (last) candidates.push(last);
  const recent0 = getRecent()[0]?.name;
  if (recent0) candidates.push(recent0);

  const tried = new Set<string>();
  for (const name of candidates) {
    if (!name || tried.has(name)) continue;
    tried.add(name);
    const diskFileName =
      (snap?.name === name ? snap.diskFileName : undefined) ||
      getRecent().find((r) => r.name === name)?.diskFileName;
    try {
      const auto = await readAutoSaveWorkflow(name, {
        absolutePath: snap?.name === name ? snap.path : undefined,
        diskFileName,
      });
      if (auto?.ok && auto.payload) {
        const p = auto.payload;
        log.info('resolveStartupWorkflowAsync', 'from autosave', {
          name: p.name,
          path: auto.path,
          method: auto.method,
        });
        return {
          name: p.name || name,
          file: toWorkflowFile(
            p.name || name,
            p.nodes as FlowNode[],
            p.edges as FlowEdge[],
            p.savedAt,
            diskFileName || `${name}.json`,
          ),
          isNew: false,
          handle: null,
          source: 'autosave',
        };
      }
    } catch (err) {
      log.debug('resolveStartupWorkflowAsync', 'autosave miss', {
        name,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // 3) 镜像
  const mirror = resolveStartupWorkflow();
  if (!mirror.isNew && mirror.file) return mirror;

  // 4) 新建（保留最近列表名建议）
  const name = suggestName(getRecent().map((r) => r.name));
  // 若 last 有名但无任何内容，仍用 last 名而不是新建序号
  const prefer = last || snap?.name;
  const finalName = prefer && !load(prefer) ? prefer : name;
  log.info('resolveStartupWorkflowAsync', 'new empty', { name: finalName });
  return { name: finalName, file: null, isNew: true, source: 'new' };
}
