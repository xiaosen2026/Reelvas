'use client';

const IX = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
);

const shortcuts = [
  { key: 'Ctrl + N', desc: '新建项目' },
  { key: '双击画布', desc: '新建文本节点' },
  { key: '中键拖拽 / Space + 拖拽', desc: '平移画布' },
  { key: '滚轮', desc: '缩放画布' },
  { key: 'Ctrl + Z', desc: '撤销' },
  { key: 'Ctrl + Shift + Z', desc: '重做' },
  { key: 'Delete / Backspace', desc: '删除选中节点' },
  { key: 'Ctrl + A', desc: '全选' },
  { key: 'Ctrl + C / Ctrl + V', desc: '复制 / 粘贴' },
  { key: 'Tab', desc: '切换 Copilot 面板' },
  { key: 'Ctrl + S', desc: '保存项目' },
  { key: 'F2', desc: '重命名节点' },
];

export function HelpPopover({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md max-h-[80vh] rounded-2xl bg-card border border-border/50 shadow-xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-4 pb-3 shrink-0">
          <h3 className="text-base font-semibold text-foreground">快捷键与操作说明</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"><IX /></button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-4">
          <div className="space-y-1">
            {shortcuts['map']((s) => (
              <div key={s['key']} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/40 transition-colors">
                <span className="text-sm text-muted-foreground">{s['desc']}</span>
                <kbd className="text-xs font-mono text-foreground bg-muted/60 rounded-md px-2 py-0.5 border border-border">{s['key']}</kbd>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
