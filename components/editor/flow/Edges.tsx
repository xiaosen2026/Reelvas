'use client';

// 连线层 —— 自研 edge 渲染
// SVG 贝塞尔；底层；悬停变红，点击直接断开

import { useState } from 'react';
import type { FlowNode, FlowEdge, ConnectionState } from './types';

type HandleOffsets = Record<
  string,
  { source?: { x: number; y: number }; target?: { x: number; y: number } }
>;

function nodeSize(n: FlowNode) {
  return { w: n.style?.width ?? 200, h: n.style?.height ?? 120 };
}

function sourcePoint(n: FlowNode, offsets: HandleOffsets) {
  const off = offsets[n.id]?.source;
  if (off) return { x: n.position.x + off.x, y: n.position.y + off.y };
  const { w, h } = nodeSize(n);
  return { x: n.position.x + w, y: n.position.y + h / 2 };
}

function targetPoint(n: FlowNode, offsets: HandleOffsets) {
  const off = offsets[n.id]?.target;
  if (off) return { x: n.position.x + off.x, y: n.position.y + off.y };
  const { h } = nodeSize(n);
  return { x: n.position.x, y: n.position.y + h / 2 };
}

function bezier(sx: number, sy: number, tx: number, ty: number) {
  const dx = Math.abs(tx - sx);
  const c = Math.max(dx * 0.5, 40);
  return `M${sx},${sy} C${sx + c},${sy} ${tx - c},${ty} ${tx},${ty}`;
}

interface EdgesProps {
  nodes: FlowNode[];
  edges: FlowEdge[];
  connection: ConnectionState | null;
  handleOffsets: HandleOffsets;
  /** 点击连线 → 直接断开 */
  onEdgeClick: (id: string) => void;
}

export function Edges({
  nodes,
  edges,
  connection,
  handleOffsets,
  onEdgeClick,
}: EdgesProps) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  // 悬停 id：SVG 透明命中区用 pointer 事件更稳，不单靠 CSS :hover
  const [hoverId, setHoverId] = useState<string | null>(null);

  return (
    <svg
      className="absolute inset-0"
      style={{ zIndex: 0, overflow: 'visible', pointerEvents: 'none', width: 1, height: 1 }}
    >
      {edges.map((e) => {
        const s = byId.get(e.source);
        const t = byId.get(e.target);
        if (!s || !t) return null;
        const sp = sourcePoint(s, handleOffsets);
        const tp = targetPoint(t, handleOffsets);
        const d = bezier(sp.x, sp.y, tp.x, tp.y);
        const hot = hoverId === e.id || !!e.selected;
        return (
          <g
            key={e.id}
            className={`react-flow__edge ${hot ? 'is-hot' : ''} ${e.selected ? 'selected' : ''}`}
            data-edge-id={e.id}
          >
            <path
              d={d}
              data-edge-hit="1"
              fill="none"
              stroke="transparent"
              strokeWidth={16}
              style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
              onPointerEnter={() => setHoverId(e.id)}
              onPointerLeave={() => setHoverId((cur) => (cur === e.id ? null : cur))}
              onPointerDown={(ev) => {
                if (ev.button !== 0) return;
                ev.stopPropagation();
                onEdgeClick(e.id);
              }}
            />
            <path
              className={`react-flow__edge-path ${e.animated ? 'flow-edge-animated' : ''}`}
              d={d}
              fill="none"
              stroke={hot ? '#e40014' : '#525252'}
              strokeWidth={hot ? 2.5 : 2}
            />
          </g>
        );
      })}

      {connection && (
        <path
          className="react-flow__connection-path"
          d={bezier(connection.startX, connection.startY, connection.curX, connection.curY)}
          fill="none"
        />
      )}
    </svg>
  );
}
