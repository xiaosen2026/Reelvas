'use client';

import { Plus, FolderOpen, History, GitBranch, Scissors } from 'lucide-react';

interface CanvasSidebarProps {
  /** 传入侧栏锚点：x=按钮右侧，y=侧栏垂直中心，菜单贴侧栏居中弹出 */
  onAddNode: (anchor: { x: number; y: number; centerY?: boolean }) => void;
  onToggleAssets: () => void;
  onToggleHistory: () => void;
  onToggleWorkflow: () => void;
  onToggleClip: () => void;
  assetsOpen: boolean;
  historyOpen: boolean;
  workflowOpen: boolean;
  clipOpen: boolean;
}

const btn = 'w-10 h-10 rounded-xl flex items-center justify-center transition-colors';

export function CanvasSidebar({
  onAddNode,
  onToggleAssets,
  onToggleHistory,
  onToggleWorkflow,
  onToggleClip,
  assetsOpen,
  historyOpen,
  workflowOpen,
  clipOpen,
}: CanvasSidebarProps) {
  return (
    <div className="absolute top-1/2 left-4 -translate-y-1/2 z-30 flex flex-col items-center gap-1 p-1.5 rounded-xl bg-card/90 backdrop-blur border border-border shadow-sm">
      {/* 节点：菜单贴在按钮右侧弹出 */}
      <button
        onClick={(e) => {
          const btnR = e.currentTarget.getBoundingClientRect();
          // 侧栏整体垂直中心，菜单相对侧栏居中而不是贴 + 顶部
          const bar = e.currentTarget.parentElement?.getBoundingClientRect();
          const cy = bar ? bar.top + bar.height / 2 : btnR.top + btnR.height / 2;
          onAddNode({ x: btnR.right + 10, y: cy, centerY: true });
        }}
        title="添加节点"
        className={`${btn} bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm`}
      >
        <Plus className="w-5 h-5" />
      </button>

      <div className="w-6 h-px bg-border/50" />

      {/* 资产 */}
      <button onClick={onToggleAssets} title="资产" className={`${btn} ${assetsOpen ? 'text-foreground bg-primary/15' : 'text-muted-foreground hover:text-foreground hover:bg-black/5'}`}>
        <FolderOpen className="w-5 h-5" />
      </button>

      {/* 历史版本（原回收站） */}
      <button onClick={onToggleHistory} title="历史版本" className={`${btn} ${historyOpen ? 'text-foreground bg-primary/15' : 'text-muted-foreground hover:text-foreground hover:bg-black/5'}`}>
        <History className="w-5 h-5" />
      </button>

      {/* ComfyUI 工作流 */}
      <button onClick={onToggleWorkflow} title="ComfyUI 工作流" className={`${btn} ${workflowOpen ? 'text-foreground bg-primary/15' : 'text-muted-foreground hover:text-foreground hover:bg-black/5'}`}>
        <GitBranch className="w-5 h-5" />
      </button>

      {/* 剪辑 */}
      <button onClick={onToggleClip} title="剪辑" className={`${btn} ${clipOpen ? 'text-foreground bg-primary/15' : 'text-muted-foreground hover:text-foreground hover:bg-black/5'}`}>
        <Scissors className="w-5 h-5" />
      </button>
    </div>
  );
}
