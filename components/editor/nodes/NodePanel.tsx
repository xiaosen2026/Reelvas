'use client';

// 节点编辑面板 —— 统一的 Portal 悬浮方案
// 选中节点时，面板悬浮在结果卡片正下方、水平居中，始终保持固定大小（不受画布缩放影响）。
// 所有生成节点复用此组件，避免每个节点各写一套 portal / 定位 / zoom 补偿逻辑。

import { createPortal } from 'react-dom';
import { useFlow } from '../flow';

interface NodePanelProps {
  /** 结果卡片的外层 ref，用于测量卡片位置以定位面板 */
  cardRef: React.RefObject<HTMLDivElement | null>;
  /** 是否选中 —— 仅选中时渲染面板 */
  selected?: boolean;
  /** 面板宽度（px），默认 400 */
  panelW?: number;
  /** 卡片底部到面板顶部的间距（px），默认 8 */
  gap?: number;
  children: React.ReactNode;
}

export function NodePanel({ cardRef, selected, panelW = 400, gap = 8, children }: NodePanelProps) {
  const rf = useFlow();
  const zoom = rf.zoom;
  const panelRoot = rf.panelRoot.current;

  // 未选中或无挂载点 → 不渲染（默认不显示）
  if (!selected || !panelRoot) return null;

  const cardRect = cardRef.current?.getBoundingClientRect();
  const rootRect = panelRoot.getBoundingClientRect();
  // 水平居中：节点中心 - 面板宽度/2
  const left = cardRect ? cardRect.left + cardRect.width / 2 - rootRect.left - panelW / 2 : 0;
  // 垂直定位：卡片底部下方 gap 像素
  const top = cardRect ? cardRect.bottom - rootRect.top + gap : 0;

  return createPortal(
    <div
      className="nodrag nowheel rounded-2xl bg-card border border-border shadow-lg p-2 flex flex-col gap-2 pointer-events-auto"
      // Portal 事件会沿 React 树冒泡到节点/画布；必须截断，否则点输入框会被当成点空白而取消选中
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        left,
        top,
        width: panelW,
        // 反向缩放，抵消画布 zoom，保持面板视觉大小恒定
        transform: zoom !== 1 ? `scale(${1 / zoom})` : undefined,
        transformOrigin: 'top left',
      }}
    >
      {children}
    </div>,
    panelRoot,
  );
}
