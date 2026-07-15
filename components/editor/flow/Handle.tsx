'use client';

// 连接点组件 —— 自研 Handle
// 保留 react-flow__handle 类名，复用 globals.css 既有样式（显隐/配色）
// type=source/target；按下发起拉线，抬起完成连线
// 挂载后测量自身相对所属节点的中心偏移，上报给画布用于连线精确定位

import { useRef, useLayoutEffect } from 'react';
import { useHandleCtx } from './FlowContext';
import type { PositionType } from './types';

interface HandleProps {
  type: 'source' | 'target';
  position: PositionType;
  style?: React.CSSProperties;
  className?: string;
}

export function Handle({ type, position, style, className }: HandleProps) {
  const ctx = useHandleCtx();
  const ref = useRef<HTMLDivElement>(null);

  // 测量 Handle 中心相对节点原点(.react-flow__node)的偏移，上报画布
  useLayoutEffect(() => {
    if (!ctx || !ref.current) return;
    const el = ref.current;
    const nodeEl = el.closest('.react-flow__node') as HTMLElement | null;
    if (!nodeEl) return;
    const hr = el.getBoundingClientRect();
    const nr = nodeEl.getBoundingClientRect();
    // 用 offset 相对节点原点（未缩放坐标：除以当前缩放，交由画布传入的 zoom 处理）
    // 这里 getBoundingClientRect 受缩放影响，画布注册时会按 zoom 归一
    const cx = hr.left + hr.width / 2 - nr.left;
    const cy = hr.top + hr.height / 2 - nr.top;
    ctx.registerHandle(ctx.nodeId, type, { x: cx, y: cy });
  });

  return (
    <div
      ref={ref}
      className={`react-flow__handle react-flow__handle-${position} nodrag ${className || ''}`}
      style={{ position: 'absolute', ...style }}
      data-handletype={type}
      onPointerDown={(e) => {
        e.stopPropagation();
        if (ctx) ctx.onHandlePointerDown(ctx.nodeId, type, e);
      }}
      onPointerUp={(e) => {
        e.stopPropagation();
        if (ctx) ctx.onHandlePointerUp(ctx.nodeId, type);
      }}
    />
  );
}
