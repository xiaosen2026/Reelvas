'use client';

// 节点顶部专属工具栏 — Portal 到 panelRoot，选中时贴在结果卡片上方并反缩放

import { createPortal } from 'react-dom';
import { useFlow } from '../flow';

interface NodeTopBarProps {
  cardRef: React.RefObject<HTMLDivElement | null>;
  selected?: boolean;
  /** 工具条最小宽度，用于水平居中估算 */
  barW?: number;
  /** 卡片顶到工具条底的间距 */
  gap?: number;
  children: React.ReactNode;
}

export function NodeTopBar({ cardRef, selected, barW = 720, gap = 10, children }: NodeTopBarProps) {
  const rf = useFlow();
  const zoom = rf.zoom;
  const panelRoot = rf.panelRoot.current;

  if (!selected || !panelRoot) return null;

  const cardRect = cardRef.current?.getBoundingClientRect();
  const rootRect = panelRoot.getBoundingClientRect();
  const left = cardRect
    ? cardRect.left + cardRect.width / 2 - rootRect.left - barW / 2
    : 0;
  // 先放在卡片上方；scale 以 bottom center 为原点，缩放后仍贴卡片顶
  const top = cardRect ? cardRect.top - rootRect.top - gap : 0;

  return createPortal(
    <div
      className="nodrag nowheel pointer-events-auto select-none"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        left: Math.max(4, left),
        top,
        width: barW,
        display: 'flex',
        justifyContent: 'center',
        transform: zoom !== 1 ? `translateY(-100%) scale(${1 / zoom})` : 'translateY(-100%)',
        transformOrigin: 'bottom center',
        zIndex: 40,
      }}
    >
      {children}
    </div>,
    panelRoot,
  );
}
