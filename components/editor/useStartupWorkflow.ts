'use client';

// 仅在客户端挂载后恢复上次工作流（磁盘优先 → 自动保存 → 镜像）

import { useEffect, useRef, type MutableRefObject, type Dispatch, type SetStateAction } from 'react';
import type { WorkflowHandle } from './CanvasFlowCore';
import { setLastOpened } from '../../lib/workflowStore';
import { resolveStartupWorkflowAsync } from '../../lib/resolveStartupWorkflowAsync';
import { createLogger } from '../../lib/logger';

const log = createLogger('useStartupWorkflow');

/**
 * 挂载后：优先恢复上次磁盘/自动保存文件到画布
 */
export function useStartupWorkflow(
  workflowRef: MutableRefObject<WorkflowHandle | null>,
  historyGateRef: MutableRefObject<{ skip: boolean; previewing: boolean }>,
  setFileName: (name: string) => void,
  setSavedTime: (t: string | null) => void,
  setDiskHandle?: Dispatch<SetStateAction<FileSystemFileHandle | null>>,
): void {
  const restoredRef = useRef(false);

  useEffect(() => {
    if (restoredRef.current) return;
    if (typeof window === 'undefined') return;

    let cancelled = false;
    let tries = 0;

    void (async () => {
      const startup = await resolveStartupWorkflowAsync();
      if (cancelled) return;

      setFileName(startup.name);

      if (startup.isNew || !startup.file) {
        restoredRef.current = true;
        setLastOpened(startup.name);
        log.info('startupRestore', 'new empty', { name: startup.name, source: startup.source });
        return;
      }

      const file = startup.file;
      if (startup.handle && setDiskHandle) {
        setDiskHandle(startup.handle);
      }

      const apply = () => {
        if (cancelled || restoredRef.current) return;
        const h = workflowRef.current;
        if (!h) {
          if (tries++ < 80) window.setTimeout(apply, 50);
          else log.warn('startupRestore', 'workflowRef not ready');
          return;
        }
        restoredRef.current = true;
        historyGateRef.current.skip = true;
        h.loadNodes(file.nodes || [], file.edges || []);
        historyGateRef.current.skip = false;
        setLastOpened(startup.name);
        setSavedTime(
          new Date(file.savedAt || Date.now()).toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        );
        log.info('startupRestore', 'ok', {
          name: startup.name,
          source: startup.source,
          nodes: file.nodes?.length ?? 0,
          edges: file.edges?.length ?? 0,
          hasHandle: !!startup.handle,
        });
      };

      apply();
    })();

    return () => {
      cancelled = true;
    };
  }, [workflowRef, historyGateRef, setFileName, setSavedTime, setDiskHandle]);
}
