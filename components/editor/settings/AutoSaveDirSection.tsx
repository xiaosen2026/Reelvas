'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  chooseAutoSaveDirectory,
  ensureAutoSaveDirPreference,
  getDesktopBridge,
  loadAutoSaveDirPreference,
  openAutoSaveDirectoryInOs,
  resolveDefaultAutoSaveDir,
  saveAutoSaveDirPreference,
} from '../../../lib/autoSaveSettings';
import { createLogger } from '../../../lib/logger';

const log = createLogger('AutoSaveDirSection');

/** 通用设置：自动保存目录（默认 文档/Reelvas/Autosave） */
export function AutoSaveDirSection() {
  const [autoSaveDir, setAutoSaveDir] = useState(() => loadAutoSaveDirPreference());
  const [autoSaveBusy, setAutoSaveBusy] = useState(false);
  const [autoSaveHint, setAutoSaveHint] = useState('');
  const isDesktop = !!getDesktopBridge();

  useEffect(() => {
    void ensureAutoSaveDirPreference().then((dir) => {
      setAutoSaveDir(dir);
    });
    const onDir = (e: Event) => {
      const d = (e as CustomEvent<{ dir: string }>).detail?.dir;
      if (d) setAutoSaveDir(d);
    };
    window.addEventListener('reelvas-autosave-dir', onDir);
    return () => window.removeEventListener('reelvas-autosave-dir', onDir);
  }, []);

  const flashAutoSave = useCallback((msg: string) => {
    setAutoSaveHint(msg);
    window.setTimeout(() => setAutoSaveHint(''), 2200);
  }, []);

  const handleChooseAutoSaveDir = useCallback(async () => {
    if (autoSaveBusy) return;
    setAutoSaveBusy(true);
    try {
      const dir = await chooseAutoSaveDirectory();
      if (dir) {
        setAutoSaveDir(dir);
        flashAutoSave('已更新自动保存目录');
        log.info('handleChooseAutoSaveDir', 'updated', { dir });
      } else {
        flashAutoSave('已取消选择');
      }
    } finally {
      setAutoSaveBusy(false);
    }
  }, [autoSaveBusy, flashAutoSave]);

  const handleResetAutoSaveDir = useCallback(async () => {
    if (autoSaveBusy) return;
    setAutoSaveBusy(true);
    try {
      const dir = await resolveDefaultAutoSaveDir();
      saveAutoSaveDirPreference(dir);
      const desktop = getDesktopBridge();
      if (desktop) await desktop.ensureAutoSaveDir(dir);
      setAutoSaveDir(dir);
      flashAutoSave('已恢复默认文档目录');
      log.info('handleResetAutoSaveDir', 'reset', { dir });
    } finally {
      setAutoSaveBusy(false);
    }
  }, [autoSaveBusy, flashAutoSave]);

  const handleOpenAutoSaveDir = useCallback(async () => {
    const ok = await openAutoSaveDirectoryInOs();
    if (!ok) flashAutoSave('浏览器中请手动打开该文件夹');
  }, [flashAutoSave]);

  return (
    <div className="flex items-start justify-between gap-4 px-7 py-5 border-t border-border/40">
      <div className="flex items-start gap-4 min-w-0 flex-1">
        <span className="size-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">自动保存目录</p>
          <p className="text-xs text-muted-foreground mt-1">
            默认写入计算机「文档」下的 <span className="font-mono">Reelvas/Autosave</span> 文件夹；未修改前始终使用该地址。
            {isDesktop
              ? ' 桌面端可直接落盘，无需每次授权。'
              : ' 浏览器需点「更改」授权目录后才能真正写盘（仍会写本地镜像）。'}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              readOnly
              value={autoSaveDir}
              title={autoSaveDir}
              className="h-10 min-w-0 flex-1 max-w-xl rounded-xl border border-border bg-muted/20 px-3 text-xs font-mono text-foreground"
            />
            <button
              type="button"
              disabled={autoSaveBusy}
              onClick={() => { void handleChooseAutoSaveDir(); }}
              className="h-10 px-3 rounded-xl border border-border bg-background text-xs font-medium text-foreground hover:bg-muted/30 transition-colors disabled:opacity-40"
            >
              更改…
            </button>
            <button
              type="button"
              disabled={autoSaveBusy}
              onClick={() => { void handleResetAutoSaveDir(); }}
              className="h-10 px-3 rounded-xl border border-border bg-background text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors disabled:opacity-40"
            >
              恢复默认
            </button>
            {isDesktop && (
              <button
                type="button"
                onClick={() => { void handleOpenAutoSaveDir(); }}
                className="h-10 px-3 rounded-xl border border-border bg-background text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
              >
                打开文件夹
              </button>
            )}
          </div>
          {autoSaveHint && (
            <p className="mt-2 text-[11px] text-emerald-700">{autoSaveHint}</p>
          )}
        </div>
      </div>
    </div>
  );
}
