'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { TopBar, persistWorkflowToDisk } from './TopBar';
import { AssetPanel } from './AssetPanel';
import { HistoryPanel } from './HistoryPanel';
import { WorkflowPanel } from './WorkflowPanel';
import { ClipEditor } from './ClipEditor';
import { CanvasInteractive } from './CanvasInteractive';
import dynamic from 'next/dynamic';
const CopilotPanel = dynamic(() => import('./CopilotPanel').then(m => ({ default: m.CopilotPanel })), { ssr: false });
import { CanvasSidebar } from './CanvasSidebar';
import type { WorkflowHandle } from './CanvasFlowCore';
import type { FlowNode, FlowEdge } from './flow';
import { save, setLastDiskSnapshot } from '../../lib/workflowStore';
import { pushHistory } from '../../lib/workflowHistoryStore';
import { buildWorkflowJson } from '../../lib/workflowDisk';
import {
  ensureAutoSaveDirPreference,
  writeAutoSaveWorkflow,
} from '../../lib/autoSaveSettings';
import { storeLastWorkflowFileHandle } from '../../lib/workflowHandleStore';
import { useStartupWorkflow } from './useStartupWorkflow';
import { migrateDataUrlsToAssets } from '../../lib/migrateAssets';
import { getAssetStoreStats } from '../../lib/assetStore';
import { createLogger } from '../../lib/logger';
import { startCanvasPageBridge } from '../../lib/canvasPageBridge';

const log = createLogger('EditorLayout');

export function EditorLayout() {
  const [entered] = useState(true);
  const [showAssets, setShowAssets] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showWorkflow, setShowWorkflow] = useState(false);
  const [showCopilot, setShowCopilot] = useState(false);
  const [showClip, setShowClip] = useState(false);
  const [diskHandle, setDiskHandle] = useState<FileSystemFileHandle | null>(null);
  const workflowRef = useRef<WorkflowHandle | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const diskHandleRef = useRef<FileSystemFileHandle | null>(null);
  diskHandleRef.current = diskHandle;
  const [savedTime, setSavedTime] = useState<string | null>(null);
  const historyGateRef = useRef({ skip: false, previewing: false });
  /** 占位名；客户端挂载后由 useStartupWorkflow 改成上次工作流 */
  const [fileName, setFileName] = useState('工作流');
  const fileNameRef = useRef(fileName);
  fileNameRef.current = fileName;
  useStartupWorkflow(workflowRef, historyGateRef, setFileName, setSavedTime, setDiskHandle);

  // 启动后自动迁移旧 dataURL → IndexedDB 资产库
  const migrateRan = useRef(false);
  useEffect(() => {
    if (migrateRan.current) return;
    migrateRan.current = true;
    const nodes = workflowRef.current?.getNodes();
    if (nodes?.length) {
      migrateDataUrlsToAssets(nodes).then(({ migrated, failed }) => {
        if (migrated > 0) {
          log.info('startupMigration', 'done', { migrated, failed });
          getAssetStoreStats().then((s) =>
            log.info('assetStoreStats', 'ok', s),
          );
        }
      });
    }
  }, [workflowRef]);

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [autoSaveHint, setAutoSaveHint] = useState('');

  /** 预览历史时暂存打开面板前的画布，退出预览可还原 */
  const prePreviewRef = useRef<{ nodes: FlowNode[]; edges: FlowEdge[] } | null>(null);
  const [previewingId, setPreviewingId] = useState<string | null>(null);

  const markSaved = useCallback((name: string, _diskFileName?: string) => {
    setFileName(name);
    setSavedTime(new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }));
    setAutoSaveHint('');
  }, []);

  /** 手动保存：优先写入已绑定磁盘文件，否则弹出另存/下载 */
  const doSave = useCallback(async () => {
    const h = workflowRef.current;
    if (!h) return;
    const result = await persistWorkflowToDisk({
      handle: diskHandleRef.current,
      fileName: fileNameRef.current,
      nodes: h.getNodes(),
      edges: h.getEdges(),
    });
    if (!result) {
      log.info('doSave', 'cancelled or failed');
      return;
    }
    setDiskHandle(result.handle);
    if (result.handle) {
      void storeLastWorkflowFileHandle(result.handle);
    }
    setLastDiskSnapshot({
      name: result.name,
      diskFileName: result.diskFileName,
      source: 'file',
      savedAt: Date.now(),
    });
    markSaved(result.name, result.diskFileName);
    pushHistory(result.name, h.getNodes(), h.getEdges());
    log.info('doSave', 'ok', { name: result.name, file: result.diskFileName, hasHandle: !!result.handle });
  }, [markSaved]);

  /**
   * 自动保存：localStorage 镜像 + 文档/Reelvas/Autosave（Electron IPC 或浏览器目录授权）
   * 镜像配额失败也不抛错，最近列表仍会更新
   */
  const doAutoSaveLocal = useCallback(() => {
    const h = workflowRef.current;
    if (!h) return;
    const name = fileNameRef.current;
    const nodes = h.getNodes();
    const edges = h.getEdges();
    const mirror = save(name, nodes, edges);
    setSavedTime(new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }));
    log.debug('doAutoSaveLocal', 'local mirror', { name, mirrored: mirror.mirrored });

    const gate = historyGateRef.current;
    if (!gate.skip && !gate.previewing) {
      pushHistory(name, nodes, edges);
    }

    const json = buildWorkflowJson(name, nodes, edges);
    void writeAutoSaveWorkflow(name, json).then((res) => {
      if (res.ok) {
        setLastDiskSnapshot({
          name,
          diskFileName: `${name.replace(/\.json$/i, '')}.json`,
          path: res.path,
          source: 'autosave',
          savedAt: Date.now(),
        });
        log.info('doAutoSaveLocal', 'disk autosave', { method: res.method, path: res.path });
        setAutoSaveHint(
          res.method === 'desktop'
            ? '已写入文档目录'
            : mirror.mirrored
              ? '已写入授权目录'
              : '磁盘已写；浏览器镜像配额不足',
        );
      } else {
        log.debug('doAutoSaveLocal', 'disk autosave skipped', {
          method: res.method,
          error: res.error,
        });
        setAutoSaveHint(
          mirror.mirrored
            ? '已缓存浏览器；磁盘需设置里「更改」授权或使用桌面端'
            : '镜像配额不足；最近列表已保留，请保存到磁盘',
        );
      }
      window.setTimeout(() => setAutoSaveHint(''), 3200);
    });
  }, []);

  const scheduleAutoSave = useCallback(() => {
    clearTimeout(autoSaveTimer.current);
    setSavedTime(null);
    setAutoSaveHint('');
    autoSaveTimer.current = setTimeout(doAutoSaveLocal, 2000);
  }, [doAutoSaveLocal]);

  useEffect(() => () => clearTimeout(autoSaveTimer.current), []);

  useEffect(() => {
    void ensureAutoSaveDirPreference().then((dir) => {
      log.info('ensureAutoSaveDirPreference', 'ready', { dir });
    });
  }, []);

  // 外部 MCP / Codex：连接本地桥，操作当前打开的画布页
  useEffect(() => {
    const ctrl = startCanvasPageBridge(workflowRef);
    log.info('canvasPageBridge', 'started', ctrl.getState());
    return () => ctrl.stop();
  }, []);

  const handleAddNode = useCallback((anchor: { x: number; y: number; centerY?: boolean }) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    const spawnX = rect ? rect.left + rect.width / 2 : anchor.x;
    const spawnY = rect ? rect.top + rect.height / 2 : anchor.y;
    workflowRef.current?.openAddMenu(anchor.x, anchor.y, spawnX, spawnY, anchor.centerY);
  }, []);

  const handleHistoryPreview = useCallback(
    (nodes: FlowNode[], edges: FlowEdge[], meta: { id: string; savedAt: number }) => {
      const h = workflowRef.current;
      if (!h) return;
      if (!prePreviewRef.current) {
        prePreviewRef.current = { nodes: h.getNodes(), edges: h.getEdges() };
      }
      historyGateRef.current.previewing = true;
      historyGateRef.current.skip = true;
      h.loadNodes(nodes, edges);
      setPreviewingId(meta.id);
      setAutoSaveHint('预览历史版本 · 未正式回退');
      log.info('handleHistoryPreview', 'preview loaded', { id: meta.id, savedAt: meta.savedAt });
    },
    [],
  );

  const handleExitPreview = useCallback(() => {
    const h = workflowRef.current;
    const snap = prePreviewRef.current;
    if (h && snap) {
      historyGateRef.current.skip = true;
      h.loadNodes(snap.nodes, snap.edges);
    }
    prePreviewRef.current = null;
    historyGateRef.current.previewing = false;
    historyGateRef.current.skip = false;
    setPreviewingId(null);
    setAutoSaveHint('');
    log.info('handleExitPreview', 'restored live canvas');
  }, []);

  const handleHistoryRestore = useCallback(
    (nodes: FlowNode[], edges: FlowEdge[], meta: { id: string; savedAt: number }) => {
      const h = workflowRef.current;
      if (!h) return;
      const name = fileNameRef.current;

      // 正式回退前，把「当前真实画布」推入历史（预览时用打开前快照）
      const live = prePreviewRef.current ?? { nodes: h.getNodes(), edges: h.getEdges() };
      pushHistory(name, live.nodes, live.edges);

      historyGateRef.current.skip = true;
      historyGateRef.current.previewing = false;
      h.loadNodes(nodes, edges);
      save(name, nodes, edges);
      pushHistory(name, nodes, edges);
      prePreviewRef.current = null;
      setPreviewingId(null);
      setShowHistory(false);
      markSaved(name);
      setAutoSaveHint('已回退历史版本');
      window.setTimeout(() => setAutoSaveHint(''), 2800);
      historyGateRef.current.skip = false;

      const json = buildWorkflowJson(name, nodes, edges);
      void writeAutoSaveWorkflow(name, json).then((res) => {
        if (res.ok) {
          log.info('handleHistoryRestore', 'disk after restore', { method: res.method, path: res.path });
        }
      });
      log.info('handleHistoryRestore', 'restored', { id: meta.id, savedAt: meta.savedAt, name });
    },
    [markSaved],
  );

  const closeHistory = useCallback(() => {
    if (previewingId) handleExitPreview();
    setShowHistory(false);
  }, [previewingId, handleExitPreview]);

  return (
    <div className="relative h-screen w-full bg-background text-foreground overflow-hidden">
      <TopBar
        workflowRef={workflowRef}
        currentFileName={fileName}
        onFileNameChange={setFileName}
        savedTime={savedTime}
        autoSaveHint={autoSaveHint}
        onManualSave={doSave}
        onToggleCopilot={() => setShowCopilot((v) => !v)}
        copilotOpen={showCopilot}
        diskHandle={diskHandle}
        onDiskHandleChange={setDiskHandle}
        onMarkSaved={markSaved}
      />
      <div className="relative flex h-full w-full overflow-hidden pt-12" ref={canvasRef}>
        <CanvasInteractive
          entered={entered}
          onEnter={() => {}}
          workflowRef={workflowRef}
          onWorkflowChange={scheduleAutoSave}
        />

        <CanvasSidebar
          onAddNode={handleAddNode}
          onToggleAssets={() => setShowAssets((v) => !v)}
          onToggleHistory={() => {
            if (showHistory) closeHistory();
            else setShowHistory(true);
          }}
          onToggleWorkflow={() => setShowWorkflow((v) => !v)}
          onToggleClip={() => setShowClip((v) => !v)}
          assetsOpen={showAssets}
          historyOpen={showHistory}
          workflowOpen={showWorkflow}
          clipOpen={showClip}
        />
      </div>
      {showAssets && <AssetPanel onClose={() => setShowAssets(false)} />}
      {showHistory && (
        <HistoryPanel
          onClose={closeHistory}
          workflowName={fileName}
          onPreview={handleHistoryPreview}
          onRestore={handleHistoryRestore}
          onExitPreview={handleExitPreview}
          previewingId={previewingId}
        />
      )}
      {showWorkflow && <WorkflowPanel onClose={() => setShowWorkflow(false)} />}
      {showCopilot && (
        <CopilotPanel onClose={() => setShowCopilot(false)} workflowRef={workflowRef} />
      )}
      {showClip && (
        <ClipEditor onClose={() => setShowClip(false)} workflowRef={workflowRef} />
      )}
    </div>
  );
}
