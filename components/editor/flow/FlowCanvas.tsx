'use client';

// 自研画布容器 —— 自研 ReactFlow
// 职责：视口平移/缩放、坐标变换、节点渲染与拖拽、连线交互、右键/拉线回调
// 保留 react-flow__pane / react-flow__node 类名，兼容既有落点判定与 CSS

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { FlowContext, HandleContext } from './FlowContext';
import { Background } from './Background';
import { CanvasControls } from './CanvasControls';
import { PerfMonitor, usePerfVisible } from './PerfMonitor';
import { SelectionToolbar } from './SelectionToolbar';
import { Edges } from './Edges';
import { MiniMap } from './MiniMap';
import { MIN_ZOOM, MAX_ZOOM, GRID_SIZE } from './constants';
import type { FlowNode, FlowEdge, Viewport, ConnectionState, NodeTypes } from './types';
import { buildMergedImageNode } from '../nodes/mergeSelectedImages';
import { createLogger } from '../../../lib/logger';

const log = createLogger('FlowCanvas');

interface FlowCanvasProps {
  nodes: FlowNode[];
  edges: FlowEdge[];
  nodeTypes: NodeTypes;
  setNodes: (updater: (nodes: FlowNode[]) => FlowNode[]) => void;
  setEdges: (updater: (edges: FlowEdge[]) => FlowEdge[]) => void;
  // 连线成立：source→target
  onConnect: (source: string, target: string) => void;
  // 拉线松手落在空白：给出屏幕坐标 + 来源，用于弹菜单
  onConnectEndOnPane: (clientX: number, clientY: number, from: { nodeId: string; handleType: 'source' | 'target' }) => void;
  // 空白右键
  onPaneContextMenu: (clientX: number, clientY: number) => void;
  // 空白点击（关菜单等）
  onPaneClick?: () => void;
  // 对外暴露坐标转换等 API（供外部在正确的画布坐标落节点）
  apiRef?: React.MutableRefObject<{ toFlow: (clientX: number, clientY: number) => { x: number; y: number } } | null>;
  children?: React.ReactNode;
}

export function FlowCanvas({
  nodes,
  edges,
  nodeTypes,
  setNodes,
  setEdges,
  onConnect,
  onConnectEndOnPane,
  onPaneContextMenu,
  onPaneClick,
  apiRef,
  children,
}: FlowCanvasProps) {
  const [vp, setVp] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });
  const [connection, setConnection] = useState<ConnectionState | null>(null);
  // 小地图显隐 + 网格吸附开关（控制条在画布内部消费，状态就近管理）
  const [showMinimap, setShowMinimap] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const { visible: showPerf } = usePerfVisible();
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // 网格吸附开关用 ref 镜像，供全局 pointermove 回调读取最新值
  const snapRef = useRef(snapToGrid);
  snapRef.current = snapToGrid;

  // 交互态用 ref 存，避免频繁 re-render 丢事件
  const panning = useRef<{ startX: number; startY: number; vpX: number; vpY: number } | null>(null);
  const dragging = useRef<{ id: string; startX: number; startY: number; initialPositions: Map<string, { x: number; y: number }> } | null>(null);
  const connecting = useRef<ConnectionState | null>(null);
  const selecting = useRef<{ startX: number; startY: number } | null>(null);
  const [selectionBox, setSelectionBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [groups, setGroups] = useState<Record<string, string[]>>({});
  const [groupNames, setGroupNames] = useState<Record<string, string>>({});
  // 当前选中的组 ID（从节点 group 字段推断）
  const selectedGroup = useMemo(() => {
    const selNodes = nodes.filter((n) => n.selected);
    if (selNodes.length < 2) return null;
    const gid = selNodes[0].group;
    if (!gid || !selNodes.every((n) => n.group === gid)) return null;
    return gid;
  }, [nodes]);

  // 各节点 Handle 相对节点原点的偏移（未缩放坐标），供 Edges 精确定位连线端点
  const [handleOffsets, setHandleOffsets] = useState<Record<string, { source?: { x: number; y: number }; target?: { x: number; y: number } }>>({});
  const zoomRef = useRef(vp.zoom);
  zoomRef.current = vp.zoom;
  // 图快照：getNodes/getEdges 必须读最新，避免闭包拿到旧 props（spawn 后立刻 autoGenerate）
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  nodesRef.current = nodes;
  edgesRef.current = edges;
  // 本轮 pointer 已点在连线上，pane 不应起平移/清选中
  const edgePointerActive = useRef(false);
  // 同一次点击连线防双删
  const edgeClickGuard = useRef(0);

  // Delete / Backspace：删选中节点与边；删节点时一并清关联边
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        if ((e.target as HTMLElement)?.isContentEditable) return;
        setNodes((nds) => {
          const removed = new Set(nds.filter((n) => n.selected).map((n) => n.id));
          setEdges((eds) =>
            eds.filter(
              (ed) =>
                !ed.selected &&
                !removed.has(ed.source) &&
                !removed.has(ed.target),
            ),
          );
          return nds.filter((n) => !n.selected);
        });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setNodes, setEdges]);

  // Handle 上报偏移（getBoundingClientRect 含缩放，按当前 zoom 归一为未缩放坐标）
  const registerHandle = useCallback((nodeId: string, handleType: 'source' | 'target', offset: { x: number; y: number }) => {
    const z = zoomRef.current || 1;
    const norm = { x: offset.x / z, y: offset.y / z };
    setHandleOffsets((prev) => {
      const cur = prev[nodeId]?.[handleType];
      if (cur && Math.abs(cur.x - norm.x) < 0.5 && Math.abs(cur.y - norm.y) < 0.5) return prev; // 无变化不更新，避免死循环
      return { ...prev, [nodeId]: { ...prev[nodeId], [handleType]: norm } };
    });
  }, []);

  // 屏幕坐标 → 画布坐标
  const toFlow = useCallback(
    (clientX: number, clientY: number) => {
      const rect = rootRef.current!.getBoundingClientRect();
      return {
        x: (clientX - rect.left - vp.x) / vp.zoom,
        y: (clientY - rect.top - vp.y) / vp.zoom,
      };
    },
    [vp],
  );

  // 对外暴露 toFlow（随 vp 更新保持最新）
  useEffect(() => {
    if (apiRef) apiRef.current = { toFlow };
  }, [apiRef, toFlow]);

  // —— 节点拖拽 ——
  const onNodePointerDown = useCallback(
    (e: React.PointerEvent, node: FlowNode) => {
      // Portal 面板等 .nodrag 区域：禁止拖拽，但仍需截断冒泡，避免传到 pane 取消选中
      if ((e.target as HTMLElement).closest('.nodrag')) {
        e.stopPropagation();
        return;
      }
      e.stopPropagation();

      setNodes((nds) => {
        const wasSelected = node.selected;
        // 记录所有选中节点的初始位置
        const initialPositions = new Map<string, { x: number; y: number }>();
        nds.forEach((n) => {
          if (wasSelected && n.selected) {
            initialPositions.set(n.id, { x: n.position.x, y: n.position.y });
          } else if (!wasSelected && n.id === node.id) {
            initialPositions.set(n.id, { x: n.position.x, y: n.position.y });
          }
        });

        dragging.current = {
          id: node.id,
          startX: e.clientX,
          startY: e.clientY,
          initialPositions,
        };

        if (wasSelected) {
          return nds; // 保持选中状态不变
        } else {
          // 点击未选中节点 → 单选该节点
          return nds.map((n) => (n.id === node.id ? { ...n, selected: true } : n.selected ? { ...n, selected: false } : n));
        }
      });
    },
    [setNodes],
  );

  // —— Handle 拉线：发起 ——
  const onHandlePointerDown = useCallback(
    (nodeId: string, handleType: 'source' | 'target', e: React.PointerEvent) => {
      const p = toFlow(e.clientX, e.clientY);
      const st: ConnectionState = { fromNodeId: nodeId, handleType, startX: p.x, startY: p.y, curX: p.x, curY: p.y };
      connecting.current = st;
      setConnection(st);
    },
    [toFlow],
  );

  // —— Handle 拉线：抬起在某节点接点上 → 连线 ——
  const onHandlePointerUp = useCallback(
    (nodeId: string, handleType: 'source' | 'target') => {
      const st = connecting.current;
      if (!st) return;
      // 同节点或同类型（source→source）不连
      if (st.fromNodeId !== nodeId && st.handleType !== handleType) {
        if (st.handleType === 'source') onConnect(st.fromNodeId, nodeId);
        else onConnect(nodeId, st.fromNodeId);
      }
      connecting.current = null;
      setConnection(null);
    },
    [onConnect],
  );

  // —— 全局 pointermove / pointerup：处理平移、拖拽、拉线预览、框选 ——
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (panning.current) {
        // 先把交互态取到局部常量：setVp 的 updater 是延迟/可能重复执行的，
        // 若在闭包里直接解引用 panning.current，pointerup 置空后会读到 null 崩溃。
        const p = panning.current;
        const nx = p.vpX + (e.clientX - p.startX);
        const ny = p.vpY + (e.clientY - p.startY);
        setVp((v) => ({ ...v, x: nx, y: ny }));
        return;
      }
      if (dragging.current) {
        const d = dragging.current;
        const dx = (e.clientX - d.startX) / vp.zoom;
        const dy = (e.clientY - d.startY) / vp.zoom;
        const snap = snapRef.current;
        // 联动拖拽：所有记录了初始位置的节点同步移动；开启网格吸附时目标坐标对齐到网格
        setNodes((nds) =>
          nds.map((n) => {
            const init = d.initialPositions.get(n.id);
            if (init) {
              let nx = init.x + dx;
              let ny = init.y + dy;
              if (snap) {
                nx = Math.round(nx / GRID_SIZE) * GRID_SIZE;
                ny = Math.round(ny / GRID_SIZE) * GRID_SIZE;
              }
              return { ...n, position: { x: nx, y: ny } };
            }
            return n;
          }),
        );
        return;
      }
      if (connecting.current) {
        const conn = connecting.current; // 局部快照，避免闭包内重复解引用可能已置空的 ref
        const rect = rootRef.current!.getBoundingClientRect();
        const curX = (e.clientX - rect.left - vp.x) / vp.zoom;
        const curY = (e.clientY - rect.top - vp.y) / vp.zoom;

        // 吸附检测：找最近的可连接 Handle（与拉线起点相反类型）
        const snapRadius = 40 / vp.zoom; // 吸附半径（画布坐标）
        let closestDist = snapRadius;
        let snapX = curX;
        let snapY = curY;

        nodes.forEach((n) => {
          if (n.id === conn.fromNodeId) return; // 跳过起点节点
          const targetType = conn.handleType === 'source' ? 'target' : 'source';
          const offset = handleOffsets[n.id]?.[targetType];
          if (!offset) return;

          const hx = n.position.x + offset.x;
          const hy = n.position.y + offset.y;
          const dist = Math.hypot(hx - curX, hy - curY);

          if (dist < closestDist) {
            closestDist = dist;
            snapX = hx;
            snapY = hy;
          }
        });

        const next = { ...conn, curX: snapX, curY: snapY };
        connecting.current = next;
        setConnection(next);
        return;
      }
      if (selecting.current) {
        const rect = rootRef.current!.getBoundingClientRect();
        const sx = Math.min(selecting.current.startX, e.clientX);
        const sy = Math.min(selecting.current.startY, e.clientY);
        const ex = Math.max(selecting.current.startX, e.clientX);
        const ey = Math.max(selecting.current.startY, e.clientY);
        setSelectionBox({ x: sx - rect.left, y: sy - rect.top, w: ex - sx, h: ey - sy });
      }
    };
    const onUp = (e: PointerEvent) => {
      panning.current = null;
      dragging.current = null;
      // 拉线松手：判断是否连上了节点
      if (connecting.current) {
        const rect = rootRef.current!.getBoundingClientRect();
        const curX = (e.clientX - rect.left - vp.x) / vp.zoom;
        const curY = (e.clientY - rect.top - vp.y) / vp.zoom;

        // 检测是否在吸附范围内（与拖动时相同逻辑）
        const snapRadius = 40 / vp.zoom;
        let snappedNodeId: string | null = null;

        for (const n of nodes) {
          if (n.id === connecting.current.fromNodeId) continue;
          const targetType = connecting.current.handleType === 'source' ? 'target' : 'source';
          const offset = handleOffsets[n.id]?.[targetType];
          if (!offset) continue;

          const hx = n.position.x + offset.x;
          const hy = n.position.y + offset.y;
          const dist = Math.hypot(hx - curX, hy - curY);

          if (dist < snapRadius) {
            snappedNodeId = n.id;
            break;
          }
        }

        // 如果吸附到了节点 → 完成连线
        if (snappedNodeId) {
          if (connecting.current.handleType === 'source') {
            onConnect(connecting.current.fromNodeId, snappedNodeId);
          } else {
            onConnect(snappedNodeId, connecting.current.fromNodeId);
          }
        } else {
          // 未吸附到节点 → 弹菜单
          onConnectEndOnPane(e.clientX, e.clientY, { nodeId: connecting.current.fromNodeId, handleType: connecting.current.handleType });
        }

        connecting.current = null;
        setConnection(null);
      }
      // 框选松手 → 计算节点交集并选中
      if (selecting.current && selectionBox) {
        const rect = rootRef.current!.getBoundingClientRect();
        const boxFlowX = (selectionBox.x - vp.x) / vp.zoom;
        const boxFlowY = (selectionBox.y - vp.y) / vp.zoom;
        const boxFlowW = selectionBox.w / vp.zoom;
        const boxFlowH = selectionBox.h / vp.zoom;
        setNodes((nds) =>
          nds.map((n) => {
            const nw = n.style?.width ?? 200;
            const nh = n.style?.height ?? 120;
            const intersects =
              n.position.x < boxFlowX + boxFlowW &&
              n.position.x + nw > boxFlowX &&
              n.position.y < boxFlowY + boxFlowH &&
              n.position.y + nh > boxFlowY;
            return intersects ? { ...n, selected: true } : n;
          }),
        );
        selecting.current = null;
        setSelectionBox(null);
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [vp.zoom, vp.x, vp.y, setNodes, onConnectEndOnPane, selectionBox, nodes, handleOffsets]);

  // —— 空白按下：Ctrl = 框选，否则平移 ——
  const onPanePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return; // 仅左键
    // 忽略节点编辑面板等交互层（Portal 可能挂在 pane 外，但 React 冒泡仍可能到达）
    const t = e.target as Element | null;
    if (t?.closest?.('.nodrag, .nowheel, input, textarea, select, button, [contenteditable="true"]')) {
      return;
    }
    // 点在连线命中区上：不平移、不清选中（由 Edges 自行处理）
    if (edgePointerActive.current || t?.closest?.('.react-flow__edge, [data-edge-hit="1"]')) {
      edgePointerActive.current = false;
      return;
    }
    if (e.ctrlKey || e.metaKey) {
      // Ctrl + 左键 → 框选
      selecting.current = { startX: e.clientX, startY: e.clientY };
      setSelectionBox({ x: e.clientX - rootRef.current!.getBoundingClientRect().left, y: e.clientY - rootRef.current!.getBoundingClientRect().top, w: 0, h: 0 });
    } else {
      // 普通左键 → 平移
      panning.current = { startX: e.clientX, startY: e.clientY, vpX: vp.x, vpY: vp.y };
      // 点空白取消所有选中
      setNodes((nds) => nds.map((n) => (n.selected ? { ...n, selected: false } : n)));
      setEdges((eds) => eds.map((ed) => (ed.selected ? { ...ed, selected: false } : ed)));
      onPaneClick?.();
    }
  }, [vp.x, vp.y, setNodes, setEdges, onPaneClick]);

  // —— Ctrl/⌘ + 滚轮缩放（以鼠标为锚点）；裸滚轮不缩放画布，留给面板/节点内滚动 ——
  // 注意：React 的 onWheel 会被绑成 passive 监听器，preventDefault() 无效并刷屏警告，
  // 故改用原生 addEventListener 显式声明 { passive: false }，确保能阻止浏览器默认缩放/滚动。
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      // 仅 Ctrl（Windows）/ Meta（macOS）+ 滚轮缩放画布；触控板捏合缩放浏览器也会带 ctrlKey
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      setVp((v) => {
        const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
        const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.zoom * factor));
        // 保持鼠标下的画布点不动
        const x = mx - (mx - v.x) * (zoom / v.zoom);
        const y = my - (my - v.y) * (zoom / v.zoom);
        return { x, y, zoom };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // —— 控制条回调 ——
  // 缩放到指定值，以画布中心为锚点保持视觉稳定
  const setZoomTo = (target: number) =>
    setVp((v) => {
      const rect = rootRef.current!.getBoundingClientRect();
      const mx = rect.width / 2;
      const my = rect.height / 2;
      const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, target));
      const x = mx - (mx - v.x) * (zoom / v.zoom);
      const y = my - (my - v.y) * (zoom / v.zoom);
      return { x, y, zoom };
    });
  // 适应视图：计算所有节点包围盒，调整缩放/平移使全部节点居中显示（无节点时归位）
  const fitView = () => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect || nodes.length === 0) {
      setVp({ x: 0, y: 0, zoom: 1 });
      return;
    }
    // 节点包围盒（画布坐标）
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodes.forEach((n) => {
      const w = n.style?.width ?? 200;
      const h = n.style?.height ?? 120;
      minX = Math.min(minX, n.position.x);
      minY = Math.min(minY, n.position.y);
      maxX = Math.max(maxX, n.position.x + w);
      maxY = Math.max(maxY, n.position.y + h);
    });
    const contentW = Math.max(maxX - minX, 1);
    const contentH = Math.max(maxY - minY, 1);
    const PADDING = 80; // 视口四周留白（屏幕像素）
    // 取宽高两方向较小的缩放比，保证全部内容可见，并夹在缩放范围内
    const zoom = Math.min(
      MAX_ZOOM,
      Math.max(
        MIN_ZOOM,
        Math.min((rect.width - PADDING * 2) / contentW, (rect.height - PADDING * 2) / contentH),
      ),
    );
    // 让包围盒中心对齐到视口中心
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const x = rect.width / 2 - centerX * zoom;
    const y = rect.height / 2 - centerY * zoom;
    setVp({ x, y, zoom });
  };

  return (
    <div
      ref={rootRef}
      className="react-flow__pane absolute inset-0 overflow-hidden"
      style={{ touchAction: 'none', cursor: panning.current ? 'grabbing' : 'default', userSelect: 'none' }}
      onPointerDown={onPanePointerDown}
      onContextMenu={(e) => {
        e.preventDefault();
        onPaneContextMenu(e.clientX, e.clientY);
      }}
    >
      <Background offsetX={vp.x} offsetY={vp.y} zoom={vp.zoom} />

      {/* 变换层：节点 + 连线随视口平移缩放 */}
      <div
        className="absolute top-0 left-0"
        style={{ transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})`, transformOrigin: '0 0' }}
      >
        <Edges
          nodes={nodes}
          edges={edges}
          connection={connection}
          handleOffsets={handleOffsets}
          onEdgeClick={(id) => {
            edgePointerActive.current = true;
            const now = performance.now();
            if (now - edgeClickGuard.current < 80) return;
            edgeClickGuard.current = now;
            // 悬停已红 → 点击直接断开
            setEdges((eds) => eds.filter((ed) => ed.id !== id));
          }}
        />

        {nodes.map((node) => {
          const Comp = nodeTypes[node.type];
          if (!Comp) return null;
          const w = node.style?.width;
          const h = node.style?.height;
          const selCount = nodes.filter((n) => n.selected).length;
          const isActive = node.selected && selCount < 2;
          return (
            <div
              key={node.id}
              className="react-flow__node absolute"
              style={{ transform: `translate(${node.position.x}px, ${node.position.y}px)`, width: w, height: h, zIndex: node.selected ? 10 : 2 }}
              onPointerDown={(e) => onNodePointerDown(e, node)}
            >
              <HandleContext.Provider value={{ nodeId: node.id, onHandlePointerDown, onHandlePointerUp, registerHandle }}>
                <Comp id={node.id} data={node.data} selected={isActive} />
              </HandleContext.Provider>
            </div>
          );
        })}

        {/* 组容器 */}
        {Object.entries(groups).filter(([, ids]) => ids.length > 0).map(([gid, ids]) => {
          const groupNodes = nodes.filter((n) => n.group === gid);
          if (groupNodes.length === 0) return null;
          let gMinX = Infinity; let gMinY = Infinity; let gMaxX = -Infinity; let gMaxY = -Infinity;
          groupNodes.forEach((n) => {
            if (n.position.x < gMinX) gMinX = n.position.x;
            if (n.position.y < gMinY) gMinY = n.position.y;
            const nw = (n.style?.width ?? 200);
            const nh = (n.style?.height ?? 100);
            if (n.position.x + nw > gMaxX) gMaxX = n.position.x + nw;
            if (n.position.y + nh > gMaxY) gMaxY = n.position.y + nh;
          });
          const pad = 16; const titleH = 32;
          const name = groupNames[gid] ?? '新建组';
          return (
            <div key={gid} className="absolute"
              style={{ left: gMinX - pad, top: gMinY - pad - titleH, width: gMaxX - gMinX + pad * 2, height: gMaxY - gMinY + pad * 2 + titleH, zIndex: 1 }}
              onPointerDown={(e) => {
                e.stopPropagation();
                setNodes((nds) => nds.map((n) => (ids.includes(n.id) ? { ...n, selected: true } : { ...n, selected: false })));
              }}
            >
              <div className="h-8 bg-muted/70 backdrop-blur-sm rounded-t-lg flex items-center px-3 border border-border/30 border-b-0">
                <span className="text-[11px] font-medium text-muted-foreground">{name}</span>
              </div>
              <div className="rounded-b-lg border border-border/30 bg-[#1a1a1e]/60" style={{ height: gMaxY - gMinY + pad * 2, backgroundImage: 'url("data:image/svg+xml,%3Csvg width=%274%27 height=%274%27 viewBox=%270 0 4 4%27 xmlns=%27http://www.w3.org/2000/svg%27%3E%3Crect width=%271%27 height=%271%27 fill=%27rgba(255,255,255,0.03)%27/%3E%3C/svg%3E")' }} />
            </div>
          );
        })}

      </div>

      {/* 面板悬浮层 — 独立于变换，始终保持固定大小 */}
      <div ref={panelRef} className="absolute inset-0 pointer-events-none z-20" />

      {/* 左下横向胶囊控制条：小地图开关 / 网格吸附 / 重置视图 / 缩放滑块 */}
      <CanvasControls
        zoom={vp.zoom}
        minimapOpen={showMinimap}
        snapToGrid={snapToGrid}
        onToggleMinimap={() => setShowMinimap((v) => !v)}
        onToggleSnap={() => setSnapToGrid((v) => !v)}
        onResetView={fitView}
        onZoomChange={setZoomTo}
      />

      {/* 性能监视面板 */}
      {showPerf && <PerfMonitor />}

      {/* 小地图：在画布内部渲染，直接消费内部 vp state，视口平移/缩放实时同步；定位在左侧控制条上方 */}
      {showMinimap && <MiniMap nodes={nodes} viewport={vp} onViewportChange={setVp} containerRef={rootRef} />}

      {/* 框选虚线框 */}
      {selectionBox && (
        <div
          className="absolute border-2 border-dashed border-blue-400/60 bg-blue-400/10 pointer-events-none"
          style={{
            left: selectionBox.x,
            top: selectionBox.y,
            width: selectionBox.w,
            height: selectionBox.h,
          }}
        />
      )}

      {/* 选中节点浮动工具栏 */}
      <SelectedBar
        nodes={nodes}
        setNodes={setNodes}
        setEdges={setEdges}
        rootRef={rootRef}
        selectedGroup={selectedGroup}
        groups={groups}
        setGroups={setGroups}
        groupNames={groupNames}
        setGroupNames={setGroupNames}
        vp={vp}
      />

      {/* 覆盖层（空状态提示等）；节点本体消费外层 CanvasFlowCore 的 Provider */}
      <FlowContext.Provider
        value={{
          setNodes,
          setEdges,
          getNodes: () => nodesRef.current,
          getEdges: () => edgesRef.current,
          zoom: vp.zoom,
          panelRoot: panelRef,
        }}
      >
        {children}
      </FlowContext.Provider>
    </div>
  );
}

/* ── 选中节点操作栏 ── */
function nodeHasImage(n: FlowNode): boolean {
  const urls = n.data?.imageUrls;
  if (Array.isArray(urls) && typeof urls[0] === 'string' && urls[0]) return true;
  for (const k of ['value', 'imageUrl', 'fileUrl'] as const) {
    const v = n.data?.[k];
    if (typeof v === 'string' && v && (v.startsWith('data:') || v.startsWith('http') || v.startsWith('blob:'))) return true;
  }
  return false;
}

function SelectedBar({
  nodes, setNodes, setEdges, rootRef, selectedGroup, groups, setGroups, groupNames, setGroupNames, vp,
}: {
  nodes: FlowNode[];
  setNodes: (u: (ns: FlowNode[]) => FlowNode[]) => void;
  setEdges: (u: (es: FlowEdge[]) => FlowEdge[]) => void;
  rootRef: React.RefObject<HTMLDivElement | null>;
  selectedGroup: string | null;
  groups: Record<string, string[]>;
  setGroups: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
  groupNames: Record<string, string>;
  setGroupNames: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  vp: { x: number; y: number; zoom: number };
}) {
  const selNodes = nodes.filter((n) => n.selected);
  if (selNodes.length < 2) return null;

  const imageSelCount = selNodes.filter(nodeHasImage).length;
  const mergeDisabled = imageSelCount < 2;

  // 计算选中节点包围盒顶部中心（画布坐标→屏幕坐标）
  let minX = Infinity, minY = Infinity, maxX = -Infinity;
  selNodes.forEach((n) => {
    const nx = n.position.x * vp.zoom + vp.x;
    const ny = n.position.y * vp.zoom + vp.y;
    if (nx < minX) minX = nx;
    if (ny < minY) minY = ny;
    const nw = (n.style?.width ?? 200) * vp.zoom;
    if (nx + nw > maxX) maxX = nx + nw;
  });

  const handleGroup = () => {
    const gid = `group-${Date.now()}`;
    const ids = selNodes.map((n) => n.id);
    setGroups((g) => ({ ...g, [gid]: ids }));
    setGroupNames((gn) => ({ ...gn, [gid]: `组${Object.keys(gn).length + 1}` }));
    setNodes((nds) => nds.map((n) => (n.selected ? { ...n, group: gid } : n)));
  };

  const handleUngroup = () => {
    if (!selectedGroup) return;
    setNodes((nds) => nds.map((n) => (n.group === selectedGroup ? { ...n, group: undefined } : n)));
    setGroups((g) => { const n = { ...g }; delete n[selectedGroup]; return n; });
    setGroupNames((g) => { const n = { ...g }; delete n[selectedGroup]; return n; });
  };

  const handleLayout = (type: 'grid' | 'horizontal' | 'vertical') => {
    const gridStep = GRID_SIZE;
    // 水平按 X 排序，垂直按 Y 排序
    const sortKey = type === 'vertical' ? 'y' : 'x';
    const sorted = [...selNodes].sort((a, b) => a.position[sortKey] - b.position[sortKey]);
    const ox = sorted[0].position.x, oy = sorted[0].position.y;
    // 计算节点最大宽度/高度，保证间距
    let maxW = 200, maxH = 100;
    selNodes.forEach((n) => { maxW = Math.max(maxW, n.style?.width ?? 200); maxH = Math.max(maxH, n.style?.height ?? 100); });
    const gap = gridStep * 2;
    setNodes((nds) => nds.map((n) => {
      if (!n.selected) return n;
      const idx = sorted.findIndex((s) => s.id === n.id);
      if (type === 'horizontal') return { ...n, position: { x: ox + idx * (maxW + gap), y: oy } };
      if (type === 'vertical') return { ...n, position: { x: ox, y: oy + idx * (maxH + gap) } };
      const perRow = 3;
      return { ...n, position: { x: ox + (idx % perRow) * (maxW + gap), y: oy + Math.floor(idx / perRow) * (maxH + gap) } };
    }));
  };

  const handleMergeLayers = () => {
    void (async () => {
      try {
        const result = await buildMergedImageNode({
          selected: selNodes,
          existingNodeIds: nodes.map((n) => n.id),
        });
        if (!result) {
          log.warn('handleMergeLayers', 'need >=2 images', { selected: selNodes.length });
          return;
        }
        setNodes((nds) => [
          ...nds.map((n) => (n.selected ? { ...n, selected: false } : n)),
          result.node,
        ]);
        if (result.edge) {
          setEdges((eds) => (eds.some((e) => e.id === result.edge!.id) ? eds : [...eds, result.edge!]));
        }
        log.info('handleMergeLayers', 'ok', { newId: result.node.id, from: selNodes.length });
      } catch (err) {
        log.error('handleMergeLayers', 'fail', {
          msg: err instanceof Error ? err.message : String(err),
        });
      }
    })();
  };

  const handleBatchDownload = () => {
    let i = 0;
    for (const n of selNodes) {
      if (!nodeHasImage(n)) continue;
      const urls = n.data?.imageUrls;
      const url =
        (Array.isArray(urls) && typeof urls[0] === 'string' && urls[0]) ||
        (typeof n.data?.value === 'string' && n.data.value) ||
        (typeof n.data?.imageUrl === 'string' && n.data.imageUrl) ||
        (typeof n.data?.fileUrl === 'string' && n.data.fileUrl) ||
        '';
      if (!url) continue;
      i += 1;
      const a = document.createElement('a');
      a.href = url;
      a.download = `image-${n.id}-${i}.png`;
      a.target = '_blank';
      a.rel = 'noopener';
      a.click();
    }
    log.info('handleBatchDownload', 'ok', { n: i });
  };

  return (
    <SelectionToolbar
      position={{ x: (minX + maxX) / 2 - 200, y: minY - 60 }}
      isGroup={!!selectedGroup}
      onGroup={handleGroup}
      onLayout={handleLayout}
      onUngroup={handleUngroup}
      onRunGroup={() => {}}
      onCreateWorkflow={() => {}}
      onCreateAsset={() => {}}
      onBatchDownload={handleBatchDownload}
      onMergeLayers={handleMergeLayers}
      mergeDisabled={mergeDisabled}
    />
  );
}

