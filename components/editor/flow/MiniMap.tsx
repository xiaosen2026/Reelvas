'use client';

// 小地图组件 —— 自研 MiniMap
// 职责：缩略显示所有节点位置 + 当前视口范围；点击/拖拽跳转视口
// 保留 react-flow__ 类名前缀，复用既有样式变量

import { useRef, useEffect, useCallback } from 'react';
import type { FlowNode, Viewport } from './types';

interface MiniMapProps {
  nodes: FlowNode[];
  viewport: Viewport;
  onViewportChange: (vp: Viewport) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
  className?: string;
}

const MINIMAP_WIDTH = 180;
const MINIMAP_HEIGHT = 120;
const PADDING = 10; // 内边距，避免节点贴边

export function MiniMap({ nodes, viewport, onViewportChange, containerRef, className = '' }: MiniMapProps) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  // 计算画布内容边界（所有节点的包围盒）
  const getBounds = () => {
    if (nodes.length === 0) return { minX: 0, minY: 0, maxX: 800, maxY: 600 };
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    nodes.forEach((n) => {
      const w = n.style?.width ?? 200;
      const h = n.style?.height ?? 120;
      minX = Math.min(minX, n.position.x);
      minY = Math.min(minY, n.position.y);
      maxX = Math.max(maxX, n.position.x + w);
      maxY = Math.max(maxY, n.position.y + h);
    });
    return { minX, minY, maxX, maxY };
  };

  const bounds = getBounds();
  const contentWidth = bounds.maxX - bounds.minX;
  const contentHeight = bounds.maxY - bounds.minY;

  // 缩放比例（保持宽高比，留边距）
  const scaleX = (MINIMAP_WIDTH - PADDING * 2) / Math.max(contentWidth, 1);
  const scaleY = (MINIMAP_HEIGHT - PADDING * 2) / Math.max(contentHeight, 1);
  const scale = Math.min(scaleX, scaleY, 1); // 最多 1:1，避免放大

  // 画布坐标 → 小地图坐标
  const toMiniMap = (x: number, y: number) => ({
    x: (x - bounds.minX) * scale + PADDING,
    y: (y - bounds.minY) * scale + PADDING,
  });

  // 小地图坐标 → 画布坐标
  const fromMiniMap = (mx: number, my: number) => ({
    x: (mx - PADDING) / scale + bounds.minX,
    y: (my - PADDING) / scale + bounds.minY,
  });

  // 视口在画布上的范围（未缩放坐标）
  const viewportWidth = (containerRef.current?.clientWidth ?? 800) / viewport.zoom;
  const viewportHeight = (containerRef.current?.clientHeight ?? 600) / viewport.zoom;
  const vpLeft = -viewport.x / viewport.zoom;
  const vpTop = -viewport.y / viewport.zoom;

  const vpMini = {
    x: toMiniMap(vpLeft, vpTop).x,
    y: toMiniMap(vpLeft, vpTop).y,
    w: viewportWidth * scale,
    h: viewportHeight * scale,
  };

  // 点击/拖拽小地图 → 移动视口中心到该点
  const handlePointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    moveViewport(e.clientX, e.clientY);
  };

  const moveViewport = useCallback(
    (clientX: number, clientY: number) => {
      if (!ref.current || !containerRef.current) return;
      const rect = ref.current.getBoundingClientRect();
      const mx = clientX - rect.left;
      const my = clientY - rect.top;
      const flow = fromMiniMap(mx, my);

      // 让点击位置居中显示在画布视口中
      const containerRect = containerRef.current.getBoundingClientRect();
      const newX = containerRect.width / 2 - flow.x * viewport.zoom;
      const newY = containerRect.height / 2 - flow.y * viewport.zoom;

      onViewportChange({ ...viewport, x: newX, y: newY });
    },
    [viewport, bounds.minX, bounds.minY, scale, onViewportChange, containerRef, fromMiniMap],
  );

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (dragging.current) moveViewport(e.clientX, e.clientY);
    };
    const onUp = () => {
      dragging.current = false;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [moveViewport]);

  return (
    <div
      ref={ref}
      className={`absolute bottom-20 left-6 border border-border rounded overflow-hidden shadow-sm ${className}`}
      style={{
        width: MINIMAP_WIDTH,
        height: MINIMAP_HEIGHT,
        cursor: 'pointer',
        touchAction: 'none',
        backgroundColor: 'var(--card)',
      }}
      onPointerDown={handlePointerDown}
    >
      {/* 节点缩略 */}
      {nodes.map((n) => {
        const pos = toMiniMap(n.position.x, n.position.y);
        const w = (n.style?.width ?? 200) * scale;
        const h = (n.style?.height ?? 120) * scale;
        return (
          <div
            key={n.id}
            className="absolute rounded"
            style={{
              left: pos.x,
              top: pos.y,
              width: w,
              height: h,
              backgroundColor: 'var(--minimap-node)',
              border: '1px solid var(--minimap-node-stroke)',
              boxShadow: n.selected ? '0 0 0 2px var(--primary)' : 'none',
            }}
          />
        );
      })}

      {/* 视口范围框 */}
      <div
        className="absolute pointer-events-none"
        style={{
          left: vpMini.x,
          top: vpMini.y,
          width: vpMini.w,
          height: vpMini.h,
          border: '2px solid var(--primary)',
          backgroundColor: 'var(--minimap-mask)',
        }}
      />
    </div>
  );
}
