'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { WorkflowHandle } from './CanvasFlowCore';
import dynamic from 'next/dynamic';
import {
  getRecent,
  save,
  load,
  remove,
  suggestName,
  setLastOpened,
  touchOpened,
  setLastDiskSnapshot,
} from '../../lib/workflowStore';
import {
  openWorkflowFromDisk,
  saveWorkflowAsDisk,
  saveWorkflowToDisk,
} from '../../lib/workflowDisk';
import { storeLastWorkflowFileHandle } from '../../lib/workflowHandleStore';
import {
  getUsage,
  subscribeUsage,
  type UsageStats,
} from '../../lib/usageStore';
import { createLogger } from '../../lib/logger';
import type { FlowNode, FlowEdge } from './flow';
import { APP_VERSION_LABEL } from '../../lib/appVersion';
import { UsageBadge } from './UsageBadge';

const log = createLogger('TopBar');

/** 设置弹窗按需加载，避免模型配置/图标链路进入首屏主包 */
const SettingsDialog = dynamic(
  () => import('./SettingsDialog').then((m) => m.SettingsDialog),
  { ssr: false },
);

interface TopBarProps {
  workflowRef: React.MutableRefObject<WorkflowHandle | null>;
  currentFileName: string;
  onFileNameChange: (name: string) => void;
  savedTime: string | null;
  /** 自动保存落盘结果提示（本地缓存 / 文档目录） */
  autoSaveHint?: string;
  onManualSave: () => void | Promise<void>;
  onToggleCopilot: () => void;
  copilotOpen: boolean;
  diskHandle: FileSystemFileHandle | null;
  onDiskHandleChange: (handle: FileSystemFileHandle | null) => void;
  onMarkSaved: (name: string, diskFileName?: string) => void;
}

type MenuType = 'file' | 'recent' | 'settings' | null;

const menuItemCls =
  'w-full text-left px-3 py-1.5 hover:bg-muted/50 text-foreground transition-colors disabled:opacity-40';

export function TopBar({
  workflowRef,
  currentFileName,
  onFileNameChange,
  savedTime,
  autoSaveHint = '',
  onManualSave,
  onToggleCopilot,
  copilotOpen,
  diskHandle,
  onDiskHandleChange,
  onMarkSaved,
}: TopBarProps) {
  const [dark, setDark] = useState(false);
  const [menu, setMenu] = useState<MenuType>(null);
  const [recentFiles, setRecentFiles] = useState(getRecent());
  const [usage, setUsage] = useState<UsageStats>(() => getUsage());
  const [busy, setBusy] = useState(false);
  const [statusHint, setStatusHint] = useState('');
  const fileBtnRef = useRef<HTMLButtonElement>(null);
  const [fileMenuPos, setFileMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [recentMenuPos, setRecentMenuPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (dark) root.classList.add('dark');
    else root.classList.remove('dark');
  }, [dark]);

  useEffect(() => {
    setUsage(getUsage());
    return subscribeUsage(setUsage);
  }, []);

  const refreshRecent = useCallback(() => setRecentFiles(getRecent()), []);

  const flash = useCallback((msg: string) => {
    setStatusHint(msg);
    window.setTimeout(() => setStatusHint(''), 2200);
  }, []);

  const placeFileMenu = useCallback(() => {
    const el = fileBtnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setFileMenuPos({ top: r.bottom + 4, left: r.left });
  }, []);

  const openFileMenu = () => {
    if (menu === 'file') {
      setMenu(null);
      return;
    }
    placeFileMenu();
    setMenu('file');
  };

  const openRecentMenu = () => {
    refreshRecent();
    const el = fileBtnRef.current;
    if (el) {
      const r = el.getBoundingClientRect();
      setRecentMenuPos({ top: r.bottom + 4, left: r.left + 12 });
    } else {
      setRecentMenuPos({ top: 48, left: 12 });
    }
    setMenu('recent');
  };

  const handleNew = () => {
    workflowRef.current?.clear();
    onDiskHandleChange(null);
    void storeLastWorkflowFileHandle(null);
    const name = suggestName(getRecent().map((r) => r.name));
    onFileNameChange(name);
    setLastOpened(name);
    setMenu(null);
    refreshRecent();
    flash('已新建空白工作流');
    log.info('handleNew', 'new workflow', { name });
  };

  const handleOpenClick = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setMenu(null);
    try {
      const opened = await openWorkflowFromDisk();
      if (!opened) {
        flash('已取消打开');
        return;
      }
      const { payload, handle, fileName } = opened;
      workflowRef.current?.loadNodes(payload.nodes, payload.edges || []);
      onFileNameChange(payload.name);
      onDiskHandleChange(handle);
      if (handle) void storeLastWorkflowFileHandle(handle);
      save(payload.name, payload.nodes, payload.edges || [], { diskFileName: fileName });
      setLastDiskSnapshot({
        name: payload.name,
        diskFileName: fileName,
        source: 'file',
        savedAt: Date.now(),
      });
      onMarkSaved(payload.name, fileName);
      refreshRecent();
      flash(handle ? `已打开 ${fileName}` : `已导入 ${fileName}`);
      log.info('handleOpenClick', 'opened', { name: payload.name, fileName, hasHandle: !!handle });
    } finally {
      setBusy(false);
    }
  }, [busy, workflowRef, onFileNameChange, onDiskHandleChange, onMarkSaved, refreshRecent, flash]);

  const handleSave = useCallback(async () => {
    setMenu(null);
    await onManualSave();
  }, [onManualSave]);

  const handleSaveAs = useCallback(async () => {
    if (busy) return;
    const h = workflowRef.current;
    if (!h) return;
    setBusy(true);
    setMenu(null);
    try {
      const result = await saveWorkflowAsDisk(currentFileName, h.getNodes(), h.getEdges());
      if (!result) {
        flash('已取消另存为');
        return;
      }
      onFileNameChange(result.name);
      onDiskHandleChange(result.handle);
      if (result.handle) void storeLastWorkflowFileHandle(result.handle);
      save(result.name, h.getNodes(), h.getEdges(), { diskFileName: result.fileName });
      setLastDiskSnapshot({
        name: result.name,
        diskFileName: result.fileName,
        source: 'file',
        savedAt: Date.now(),
      });
      onMarkSaved(result.name, result.fileName);
      refreshRecent();
      flash(
        result.method === 'fsa'
          ? `已保存到 ${result.fileName}`
          : `已下载 ${result.fileName}（浏览器降级）`,
      );
      log.info('handleSaveAs', 'saved as', {
        name: result.name,
        method: result.method,
        fileName: result.fileName,
      });
    } finally {
      setBusy(false);
    }
  }, [
    busy,
    workflowRef,
    currentFileName,
    onFileNameChange,
    onDiskHandleChange,
    onMarkSaved,
    refreshRecent,
    flash,
  ]);

  const handleOpenRecent = (name: string) => {
    void (async () => {
      const file = load(name);
      if (file) {
        workflowRef.current?.loadNodes(file.nodes, file.edges);
        onFileNameChange(name);
        touchOpened(name);
        onDiskHandleChange(null);
        refreshRecent();
        setMenu(null);
        flash(`已从最近打开：${name}（保存将弹出另存/下载）`);
        log.info('handleOpenRecent', 'opened local mirror', { name });
        return;
      }

      // 镜像可能因配额丢失：尝试自动保存目录
      try {
        const { readAutoSaveWorkflow } = await import('../../lib/readAutoSaveWorkflow');
        const snap = (await import('../../lib/workflowStore')).getLastDiskSnapshot();
        const recent = getRecent().find((r) => r.name === name);
        const auto = await readAutoSaveWorkflow(name, {
          absolutePath: snap?.name === name ? snap.path : undefined,
          diskFileName: recent?.diskFileName,
        });
        if (auto.ok && auto.payload) {
          const p = auto.payload;
          workflowRef.current?.loadNodes(p.nodes as FlowNode[], (p.edges || []) as FlowEdge[]);
          onFileNameChange(p.name || name);
          touchOpened(name);
          onDiskHandleChange(null);
          refreshRecent();
          setMenu(null);
          flash(`已从磁盘自动保存恢复：${name}`);
          log.info('handleOpenRecent', 'opened autosave', { name, path: auto.path });
          return;
        }
      } catch (err) {
        log.warn('handleOpenRecent', 'autosave fallback failed', {
          name,
          err: err instanceof Error ? err.message : String(err),
        });
      }

      flash('本地镜像不存在，请用「打开」从磁盘选择');
      setMenu(null);
    })();
  };

  const handleRemoveRecent = (name: string) => {
    remove(name);
    refreshRecent();
  };

  const iconBtn =
    'w-8 h-8 rounded-md flex items-center justify-center bg-transparent border-none text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 transition-colors';

  // 仅文件/最近菜单需要遮罩；设置对话框自带遮罩且 z-index 较低，
  // 若这里也挂全屏 backdrop 会盖住设置面板，导致点侧栏导航直接退出
  const backdrop =
    (menu === 'file' || menu === 'recent') && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="fixed inset-0 z-[10010]"
            onClick={() => setMenu(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              setMenu(null);
            }}
            aria-hidden
          />,
          document.body,
        )
      : null;

  const fileMenu =
    menu === 'file' && fileMenuPos && typeof document !== 'undefined'
      ? createPortal(
          <div
            role="menu"
            className="fixed z-[10020] w-48 rounded-lg editor-panel-surface border border-border/50 shadow-sm py-1 text-sm"
            style={{ top: fileMenuPos.top, left: fileMenuPos.left }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button" role="menuitem" disabled={busy} onClick={handleNew} className={menuItemCls}>
              新建
            </button>
            <button type="button" role="menuitem" disabled={busy} onClick={() => { void handleOpenClick(); }} className={menuItemCls}>
              打开…
            </button>
            <button type="button" role="menuitem" disabled={busy} onClick={() => { void handleSave(); }} className={menuItemCls}>
              保存{diskHandle ? '' : '…'}
            </button>
            <button type="button" role="menuitem" disabled={busy} onClick={() => { void handleSaveAs(); }} className={menuItemCls}>
              另存为…
            </button>
            <div className="my-0.5 border-t border-border/50" />
            <button
              type="button"
              role="menuitem"
              disabled={busy}
              onClick={openRecentMenu}
              className={`${menuItemCls} flex items-center justify-between`}
            >
              最近打开…
              <svg className="w-3 h-3 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>
          </div>,
          document.body,
        )
      : null;

  const recentMenu =
    menu === 'recent' && recentMenuPos && typeof document !== 'undefined'
      ? createPortal(
          <div
            role="menu"
            className="fixed z-[10020] w-56 max-h-72 overflow-y-auto rounded-lg editor-panel-surface border border-border/50 shadow-sm py-1 text-sm"
            style={{ top: recentMenuPos.top, left: recentMenuPos.left }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            {recentFiles.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">暂无最近文件</div>
            ) : (
              recentFiles.slice(0, 12).map((f) => (
                <div
                  key={f.name}
                  className="flex items-center justify-between px-2 py-1 hover:bg-muted/50 transition-colors group"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => handleOpenRecent(f.name)}
                    className="flex-1 min-w-0 text-left px-1 py-1 text-sm text-foreground truncate"
                    title={f.diskFileName || f.name}
                  >
                    {f.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveRecent(f.name)}
                    className="ml-1 w-5 h-5 rounded flex items-center justify-center opacity-0 group-hover:opacity-50 hover:!opacity-100 text-muted-foreground transition-all"
                    title="从最近列表移除"
                  >
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6 6 18" />
                      <path d="m6 6 12 12" />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div className="window-titlebar">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-1.5 mr-1 select-none" title="Reelvas — 短剧 AI 无限画布">
            <img src="/logo.svg" alt="Reelvas" width={22} height={22} className="rounded-md shrink-0" />
            <span className="text-sm font-semibold tracking-tight text-foreground hidden sm:inline">Reelvas</span>
          </div>

          <div className="relative">
            <button
              ref={fileBtnRef}
              type="button"
              aria-label="文件菜单"
              aria-haspopup="menu"
              aria-expanded={menu === 'file' || menu === 'recent'}
              onClick={openFileMenu}
              className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>

          <button
            type="button"
            onClick={() => { void handleSave(); }}
            title={diskHandle ? '保存到磁盘' : '保存（将选择位置或下载）'}
            disabled={busy}
            className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-black/5 transition-colors ml-1 disabled:opacity-40"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
          </button>

          <span className="text-sm font-medium text-foreground truncate max-w-[12rem]" title={currentFileName}>
            {currentFileName}
          </span>

          <span
            className="inline-flex items-center rounded-md bg-primary text-primary-foreground text-[11px] px-1.5 py-0.5 font-medium shrink-0"
            title="应用版本（与 package.json 同步）"
          >
            {APP_VERSION_LABEL}
          </span>

          {savedTime && (
            <span className="text-xs text-muted-foreground tabular-nums shrink-0">已保存 {savedTime}</span>
          )}
          {autoSaveHint && (
            <span className="text-xs text-amber-700 dark:text-amber-400 truncate max-w-[20rem]" title={autoSaveHint}>
              {autoSaveHint}
            </span>
          )}
          {statusHint && (
            <span className="text-xs text-emerald-700 truncate max-w-[14rem]" title={statusHint}>
              {statusHint}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-[48px]" />

        <div className="flex items-center gap-1">
          <UsageBadge usage={usage} />
          <button
            type="button"
            aria-label="设置"
            onClick={() => setMenu(menu === 'settings' ? null : 'settings')}
            className={iconBtn}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="切换主题"
            onClick={() => setDark((v) => !v)}
            title={dark ? '切换到浅色' : '切换到深色'}
            className={iconBtn}
          >
            {dark ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2" />
                <path d="M12 20v2" />
                <path d="m4.93 4.93 1.41 1.41" />
                <path d="m17.66 17.66 1.41 1.41" />
                <path d="M2 12h2" />
                <path d="M20 12h2" />
                <path d="m6.34 17.66-1.41 1.41" />
                <path d="m19.07 4.93-1.41 1.41" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401" />
              </svg>
            )}
          </button>
          <button
            type="button"
            aria-label="切换对话面板"
            onClick={onToggleCopilot}
            title={copilotOpen ? '隐藏对话面板' : '显示对话面板'}
            className={`w-8 h-8 rounded-md flex items-center justify-center bg-transparent border-none transition-colors ${
              copilotOpen
                ? 'text-foreground bg-black/5 dark:bg-white/10'
                : 'text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z" />
            </svg>
          </button>
        </div>
      </div>

      {backdrop}
      {fileMenu}
      {recentMenu}
      {menu === 'settings' && <SettingsDialog onClose={() => setMenu(null)} />}
    </>
  );
}

export async function persistWorkflowToDisk(options: {
  handle: FileSystemFileHandle | null;
  fileName: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
}): Promise<{ name: string; diskFileName: string; handle: FileSystemFileHandle | null } | null> {
  const result = await saveWorkflowToDisk(options.handle, options.fileName, options.nodes, options.edges);
  if (!result) return null;
  save(result.name, options.nodes, options.edges, { diskFileName: result.fileName });
  if (result.handle) void storeLastWorkflowFileHandle(result.handle);
  setLastDiskSnapshot({
    name: result.name,
    diskFileName: result.fileName,
    source: 'file',
    savedAt: Date.now(),
  });
  return { name: result.name, diskFileName: result.fileName, handle: result.handle };
}
