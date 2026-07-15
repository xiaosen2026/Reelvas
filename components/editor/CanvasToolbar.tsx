'use client';

// 画布底部浮动工具条：中间胶囊(指针/打开模板/提示词库) + 左下帮助 + 右下小地图
// 图标路径抓取自原版 lucide 图标

const IPointer = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z" /></svg>
);
const ITemplate = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><rect width="18" height="7" x="3" y="3" rx="1" /><rect width="9" height="7" x="3" y="14" rx="1" /><rect width="5" height="7" x="16" y="14" rx="1" /></svg>
);
const IBook = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M12 7v14" /><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" /></svg>
);
const IHelp = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></svg>
);

interface Props {
  onHelp: () => void;
  onTemplate: () => void;
  onPromptLibrary: () => void;
}

export function CanvasToolbar({ onHelp, onTemplate, onPromptLibrary }: Props) {
  return (
    <>
      {/* 中间胶囊工具条 */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 rounded-full bg-neutral-900/90 backdrop-blur px-1.5 py-1.5 shadow-lg">
        <button className="w-9 h-9 rounded-full bg-white text-neutral-900 flex items-center justify-center" aria-label="指针">
          <IPointer />
        </button>
        <button onClick={onTemplate} className="w-9 h-9 rounded-full text-white/80 hover:bg-white/10 transition-colors flex items-center justify-center" aria-label="打开模板">
          <ITemplate />
        </button>
        <button onClick={onPromptLibrary} className="w-9 h-9 rounded-full text-white/80 hover:bg-white/10 transition-colors flex items-center justify-center" aria-label="提示词库">
          <IBook />
        </button>
      </div>

      {/* 右下帮助（小地图开关已移至左下控制条） */}
      <button onClick={onHelp} className="absolute bottom-6 right-6 z-30 w-9 h-9 rounded-lg bg-card/80 backdrop-blur border border-border shadow-sm text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center" aria-label="帮助">
        <IHelp />
      </button>
    </>
  );
}
