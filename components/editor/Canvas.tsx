'use client';

// Minimal Canvas shell — 画布渲染在 CanvasInteractive 中由自研 flow 引擎负责

export function Canvas({ entered, onEnter, children }: { entered: boolean; onEnter: () => void; children?: any }) {
  return (
    <div className="w-full h-full relative" style={{ background: 'var(--canvas-background)' }}>
      {/* 画布在 CanvasInteractive 中渲染（自研 flow 引擎） */}

      {!entered && (
        <div className="absolute inset-0 z-20 bg-background/80 backdrop-blur-sm">
          <div className="mx-auto flex h-full w-full max-w-4xl flex-col px-6 pt-[10vh] pb-6">
            <div className="mb-6 shrink-0 text-left">
              <h2 className="text-2xl font-semibold text-foreground">最近项目</h2>
              <p className="mt-2 text-sm text-muted-foreground">新建项目或继续最近的工作流</p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto pr-0">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <button onClick={onEnter} className="group rounded-xl border-2 border-dashed border-border bg-card/50 text-left transition-all hover:border-primary/50 hover:shadow-lg">
                  <div className="flex aspect-video items-center justify-center rounded-t-xl bg-muted/30">
                    <svg className="w-8 h-8 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div className="px-3 py-1.5">
                    <p className="text-sm font-medium text-foreground">新建项目</p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {entered && children}
    </div>
  );
}
