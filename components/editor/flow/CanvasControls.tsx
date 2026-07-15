'use client';

// 画布左下横向胶囊控制条 —— 小地图开关 / 网格吸附 / 重置视图 / 缩放滑块
// 纯 Tailwind 实现，不依赖任何第三方 UI 库

import { MIN_ZOOM, MAX_ZOOM } from './constants';

interface CanvasControlsProps {
  zoom: number;
  minimapOpen: boolean;
  snapToGrid: boolean;
  onToggleMinimap: () => void;
  onToggleSnap: () => void;
  onResetView: () => void;
  onZoomChange: (zoom: number) => void;
}

// 小地图图标（tabler map-2）
const IconMinimap = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 18.5l-3 -1.5l-6 3v-13l6 -3l6 3l6 -3v7.5" /><path d="M9 4v13" /><path d="M15 7v5.5" /><path d="M21.121 20.121a3 3 0 1 0 -4.242 0c.418 .419 1.125 1.045 2.121 1.879c1.051 -.89 1.759 -1.516 2.121 -1.879z" /><path d="M19 18v.01" /></svg>
);

// 网格吸附图标（tabler grid-dots）
const IconGrid = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M12 5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M19 5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M5 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M19 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M5 19m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M12 19m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M19 19m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /></svg>
);

// 重置视图图标（tabler focus-centered）
const IconReset = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M4 8v-2a2 2 0 0 1 2 -2h2" /><path d="M4 16v2a2 2 0 0 0 2 2h2" /><path d="M16 4h2a2 2 0 0 1 2 2v2" /><path d="M16 20h2a2 2 0 0 0 2 -2v-2" /></svg>
);

export function CanvasControls({
  zoom,
  minimapOpen,
  snapToGrid,
  onToggleMinimap,
  onToggleSnap,
  onResetView,
  onZoomChange,
}: CanvasControlsProps) {
  const btnBase =
    'w-8 h-8 rounded-full flex items-center justify-center transition-colors';
  const btnIdle = 'text-muted-foreground hover:text-foreground hover:bg-black/5';
  const btnActive = 'text-primary bg-primary/15';

  // 滑块百分比（用于填充轨道与手柄定位）
  const pct = ((zoom - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)) * 100;

  return (
    <div
      className="absolute bottom-6 left-6 z-30 flex h-10 items-center gap-0.5 rounded-full border border-border bg-card/90 px-1.5 shadow-sm backdrop-blur nodrag"
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* 小地图开关 */}
      <button
        onClick={onToggleMinimap}
        title={minimapOpen ? '关闭小地图' : '打开小地图'}
        className={`${btnBase} ${minimapOpen ? btnActive : btnIdle}`}
      >
        <IconMinimap />
      </button>

      {/* 网格吸附开关 */}
      <button
        onClick={onToggleSnap}
        title={snapToGrid ? '网格吸附已开启' : '网格吸附已关闭'}
        className={`${btnBase} ${snapToGrid ? btnActive : btnIdle}`}
      >
        <IconGrid />
      </button>

      {/* 重置视图 */}
      <button
        onClick={onResetView}
        title="重置视图"
        data-testid="canvas-editor-fit-view-btn"
        className={`${btnBase} ${btnIdle}`}
      >
        <IconReset />
      </button>

      {/* 分隔线 */}
      <div className="mx-1 h-5 w-px bg-border" />

      {/* 缩放滑块（纯 Tailwind range，自定义轨道填充） */}
      <div className="flex items-center gap-2 pr-2 pl-1">
        <input
          type="range"
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          step={0.01}
          value={zoom}
          onChange={(e) => onZoomChange(Number(e.target.value))}
          aria-label="画布缩放"
          className="zoom-slider h-1 w-28 cursor-pointer appearance-none rounded-full bg-border"
          style={{ background: `linear-gradient(to right, var(--primary) ${pct}%, var(--border) ${pct}%)` }}
        />
        <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">
          {Math.round(zoom * 100)}%
        </span>
      </div>
    </div>
  );
}
