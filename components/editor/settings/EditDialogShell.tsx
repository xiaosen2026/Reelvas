'use client';

import { ReactNode, useState } from 'react';
import { Switch } from './Switch';

const IX = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
);

// 编辑弹窗外壳：标题 + 随版本更新开关 + 内容插槽 + 取消/保存（Skill/Recipe 共用）
export function EditDialogShell({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const [followVersion, setFollowVersion] = useState(true);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[85vh] rounded-2xl bg-card border border-border/50 shadow-xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-5 pb-3 shrink-0">
          <h2 className="text-lg font-bold text-foreground">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"><IX /></button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-2 space-y-5">
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/20 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">随版本更新</p>
              <p className="text-xs text-muted-foreground mt-1">开启后，应用更新时将自动同步最新版本；关闭后保留您的自定义修改</p>
            </div>
            <Switch checked={followVersion} onChange={() => setFollowVersion((v) => !v)} label="随版本更新" />
          </div>
          {children}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 shrink-0 border-t border-border/40">
          <button onClick={onClose} className="h-10 px-5 rounded-lg border border-border text-sm text-foreground hover:bg-muted/50 transition-colors">取消</button>
          <button onClick={onClose} className="h-10 px-6 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">保存</button>
        </div>
      </div>
    </div>
  );
}

// 表单字段标签
export function FieldLabel({ children, required }: { children: ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-medium text-foreground mb-1.5">
      {children} {required && <span className="text-destructive">*</span>}
    </label>
  );
}
