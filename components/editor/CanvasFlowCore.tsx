'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { FlowCanvas } from './flow';
import { FlowContext } from './flow/FlowContext';
import type { FlowNode, FlowEdge } from './flow';
import { ContextMenu } from './ContextMenu';
import { nodeTypes, nodeConfigs } from './nodes';

export interface WorkflowHandle {
  getNodes: () => FlowNode[];
  getEdges: () => FlowEdge[];
  loadNodes: (nodes: FlowNode[], edges: FlowEdge[]) => void;
  clear: () => void;
  /**
   * 打开添加节点菜单
   * @param menuX/menuY 菜单屏幕坐标（侧栏 + 贴侧栏；右键用鼠标位置）
   * @param spawnX/spawnY 新建节点落点屏幕坐标；省略则与菜单坐标相同
   * @param centerY 菜单是否相对锚点垂直居中（侧栏 true / 右键 false）
   */
  openAddMenu: (menuX?: number, menuY?: number, spawnX?: number, spawnY?: number, centerY?: boolean) => void;
  /**
   * Agent 画布操作：直接改 nodes/edges（不经右键菜单）
   * menuType 用 nodeConfigs 的 key，如 text/image/video/upload
   */
  agentCreateNode: (opts: {
    menuType: string;
    x?: number;
    y?: number;
    data?: Record<string, unknown>;
    id?: string;
  }) => { ok: boolean; id?: string; error?: string };
  agentConnect: (sourceId: string, targetId: string) => { ok: boolean; id?: string; error?: string };
  agentUpdateNode: (
    id: string,
    patch: { data?: Record<string, unknown>; x?: number; y?: number },
  ) => { ok: boolean; error?: string };
  agentDeleteNodes: (ids: string[]) => { ok: boolean; removed: number };
  agentSetGraph: (nodes: FlowNode[], edges: FlowEdge[]) => void;
  /** 存储快照供 Agent 撤销 */
  agentPushSnapshot: () => void;
  /** 恢复到上一个快照 */
  agentUndo: () => boolean;
  /** 撤销栈深度 */
  getSnapshotCount: () => number;
}

interface Props {
  workflowRef?: React.MutableRefObject<WorkflowHandle | null>;
  /** 画布节点/连线/数据变更时回调（用于自动保存调度） */
  onWorkflowChange?: () => void;
}

let nodeIdCnt = 1;
let edgeIdCnt = 1;
const labelSeq: Record<string, number> = {};

/** 忽略选中态，只比较会写入工作流的内容 */
function workflowSignature(nodes: FlowNode[], edges: FlowEdge[]): string {
  const n = nodes.map((node) => ({
    id: node.id,
    type: node.type,
    x: node.position.x,
    y: node.position.y,
    data: node.data,
    w: node.style?.width,
    h: node.style?.height,
    group: node.group,
  }));
  const e = edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
  }));
  return JSON.stringify({ n, e });
}

export function CanvasFlowCore({ workflowRef, onWorkflowChange }: Props) {
  const [nodesheet, setNodesheet] = useState<FlowNode[]>([]);
  const [edges, setEdges] = useState<FlowEdge[]>([]);
  // menuPos：菜单 UI 位置；spawnPos：新建节点落点（侧栏打开时菜单贴侧栏、节点仍落画布中心）
  const [menuPos, setMenuPos] = useState<{ x: number; y: number; centerY?: boolean } | null>(null);
  const spawnPos = useRef<{ x: number; y: number } | null>(null);
  const flowRef = useRef<HTMLDivElement>(null);
  // FlowCanvas 暴露的 API（坐标转换）
  const apiRef = useRef<{ toFlow: (clientX: number, clientY: number) => { x: number; y: number } } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // Agent 撤销栈
  const undoStack = useRef<string[]>([]);
  const agentPushSnapshot = useCallback(() => {
    undoStack.current.push(JSON.stringify({ n: nodesRef.current, e: edgesRef.current }));
    if (undoStack.current.length > 50) undoStack.current.shift();
  }, []);
  const agentUndo = useCallback(() => {
    if (!undoStack.current.length) return false;
    try {
      const { n, e } = JSON.parse(undoStack.current.pop()!);
      nodesRef.current = n; edgesRef.current = e;
      setNodesheet(n.map((x: FlowNode) => ({ ...x, selected: false })));
      setEdges(e);
      return true;
    } catch { return false; }
  }, []);
  // 从接点拉线松手到空白时的来源信息；为空表示菜单来自空白右键
  const connectFrom = useRef<{ nodeId: string; handleType: 'source' | 'target' } | null>(null);
  const onChangeRef = useRef(onWorkflowChange);
  onChangeRef.current = onWorkflowChange;
  const lastSigRef = useRef<string | null>(null);

  // 内容签名变化 → 调度自动保存（首帧/加载后只记签名不触发）
  useEffect(() => {
    const sig = workflowSignature(nodesheet, edges);
    if (lastSigRef.current === null) {
      lastSigRef.current = sig;
      return;
    }
    if (sig === lastSigRef.current) return;
    lastSigRef.current = sig;
    onChangeRef.current?.();
  }, [nodesheet, edges]);

  // 连线成立（拉到另一节点接点）
  const onConnect = useCallback((source: string, target: string) => {
    setEdges((eds) => [...eds, { id: 'e-' + (edgeIdCnt++), source, target, animated: true }]);
  }, []);

  // 拉线松手落在空白：记住来源并弹菜单
  const onConnectEndOnPane = useCallback((clientX: number, clientY: number, from: { nodeId: string; handleType: 'source' | 'target' }) => {
    connectFrom.current = from;
    spawnPos.current = { x: clientX, y: clientY };
    setMenuPos({ x: clientX, y: clientY, centerY: false });
  }, []);

  const openAddMenu = useCallback((menuX?: number, menuY?: number, spawnX?: number, spawnY?: number, centerY?: boolean) => {
    connectFrom.current = null;
    const rect = flowRef.current?.getBoundingClientRect();
    const center = rect
      ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
      : { x: 0, y: 0 };
    const mx = menuX ?? center.x;
    const my = menuY ?? center.y;
    spawnPos.current = { x: spawnX ?? mx, y: spawnY ?? my };
    setMenuPos({ x: mx, y: my, centerY: !!centerY });
  }, []);

  const onPaneContextMenu = useCallback((clientX: number, clientY: number) => {
    openAddMenu(clientX, clientY, clientX, clientY, false);
  }, [openAddMenu]);

  const createNode = useCallback((type: string, clientX?: number, clientY?: number) => {
    const cfg = nodeConfigs[type];
    if (!cfg) return;
    // 优先用显式落点 / spawnPos（侧栏菜单与落点可分离），再回退菜单坐标
    const sx = clientX ?? spawnPos.current?.x ?? 0;
    const sy = clientY ?? spawnPos.current?.y ?? 0;
    // 屏幕坐标 → 画布坐标（含平移/缩放），落点精确
    const pt = apiRef.current ? apiRef.current.toFlow(sx, sy) : { x: sx, y: sy };
    labelSeq[cfg.labelPrefix] = (labelSeq[cfg.labelPrefix] || 0) + 1;
    const newId = 'node-' + (nodeIdCnt++);
    const newNode: FlowNode = {
      id: newId,
      type: cfg.type,
      position: { x: pt.x - cfg.width / 2, y: pt.y - cfg.height / 2 },
      data: { label: cfg.labelPrefix + labelSeq[cfg.labelPrefix], value: '', tags: [] },
      style: { width: cfg.width, height: cfg.height },
      selected: true,
    };
    // 清除其它节点选中，只保留新节点
    setNodesheet((nds) => [...nds.map((n) => (n.selected ? { ...n, selected: false } : n)), newNode]);

    // 来自拉线到空白 → 自动连线
    const from = connectFrom.current;
    if (from) {
      const edge: FlowEdge =
        from.handleType === 'source'
          ? { id: 'e-' + (edgeIdCnt++), source: from.nodeId, target: newId, animated: true }
          : { id: 'e-' + (edgeIdCnt++), source: newId, target: from.nodeId, animated: true };
      setEdges((eds) => [...eds, edge]);
      connectFrom.current = null;
    }
  }, []);

  // 暴露节点/连线状态给父组件（供 TopBar 文件保存/加载）
  const nodesRef = useRef(nodesheet);
  const edgesRef = useRef(edges);
  nodesRef.current = nodesheet;
  edgesRef.current = edges;
  const syncIdCounters = useCallback((nodes: FlowNode[], nextEdges: FlowEdge[]) => {
    const maxNodeId = nodes.reduce((m, n) => {
      const num = parseInt(String(n.id).replace(/^node-/, ''), 10);
      return Number.isFinite(num) && num > m ? num : m;
    }, 0);
    const maxEdgeId = nextEdges.reduce((m, e) => {
      const num = parseInt(String(e.id).replace(/^e-/, ''), 10);
      return Number.isFinite(num) && num > m ? num : m;
    }, 0);
    nodeIdCnt = Math.max(nodeIdCnt, maxNodeId + 1);
    edgeIdCnt = Math.max(edgeIdCnt, maxEdgeId + 1);
  }, []);

  const agentCreateNode = useCallback(
    (opts: {
      menuType: string;
      x?: number;
      y?: number;
      data?: Record<string, unknown>;
      id?: string;
    }) => {
      const cfg = nodeConfigs[opts.menuType];
      if (!cfg) {
        return { ok: false as const, error: `未知节点类型 menuType=${opts.menuType}` };
      }
      const used = new Set(nodesRef.current.map((n) => n.id));
      let newId = opts.id?.trim() || `node-${nodeIdCnt++}`;
      if (used.has(newId)) {
        if (opts.id) return { ok: false as const, error: `节点 id 已存在: ${newId}` };
        while (used.has(newId)) newId = `node-${nodeIdCnt++}`;
      }
      labelSeq[cfg.labelPrefix] = (labelSeq[cfg.labelPrefix] || 0) + 1;
      // 默认落在现有节点包围盒右侧，避免全堆原点
      const xs = nodesRef.current.map((n) => n.position.x);
      const ys = nodesRef.current.map((n) => n.position.y);
      const baseX = xs.length ? Math.max(...xs) + 80 : 120;
      const baseY = ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : 120;
      const x = typeof opts.x === 'number' ? opts.x : baseX;
      const y = typeof opts.y === 'number' ? opts.y : baseY + nodesRef.current.length * 12;
      const newNode: FlowNode = {
        id: newId,
        type: cfg.type,
        position: { x, y },
        data: {
          label: cfg.labelPrefix + labelSeq[cfg.labelPrefix],
          value: '',
          tags: [],
          ...(opts.data || {}),
        },
        style: { width: cfg.width, height: cfg.height },
        selected: true,
      };
      // !!! 同步写 ref：同一 tick 内 create→connect 必须立刻可见 !!!
      nodesRef.current = [
        ...nodesRef.current.map((n) => (n.selected ? { ...n, selected: false } : n)),
        newNode,
      ];
      setNodesheet(nodesRef.current);
      return { ok: true as const, id: newId };
    },
    [],
  );

  const agentConnect = useCallback((sourceId: string, targetId: string) => {
    if (!sourceId || !targetId) return { ok: false as const, error: 'source/target 不能为空' };
    if (sourceId === targetId) return { ok: false as const, error: '不能自连' };
    const nodes = nodesRef.current;
    if (!nodes.some((n) => n.id === sourceId)) {
      return { ok: false as const, error: `source 不存在: ${sourceId}` };
    }
    if (!nodes.some((n) => n.id === targetId)) {
      return { ok: false as const, error: `target 不存在: ${targetId}` };
    }
    const exists = edgesRef.current.some(
      (e) => e.source === sourceId && e.target === targetId,
    );
    if (exists) return { ok: true as const, id: 'exists' };
    const id = `e-${edgeIdCnt++}`;
    const edge: FlowEdge = { id, source: sourceId, target: targetId, animated: true };
    edgesRef.current = [...edgesRef.current, edge];
    setEdges(edgesRef.current);
    return { ok: true as const, id };
  }, []);

  const agentUpdateNode = useCallback(
    (id: string, patch: { data?: Record<string, unknown>; x?: number; y?: number }) => {
      let found = false;
      nodesRef.current = nodesRef.current.map((n) => {
        if (n.id !== id) return n;
        found = true;
        return {
          ...n,
          position: {
            x: typeof patch.x === 'number' ? patch.x : n.position.x,
            y: typeof patch.y === 'number' ? patch.y : n.position.y,
          },
          data: patch.data ? { ...n.data, ...patch.data } : n.data,
        };
      });
      if (found) setNodesheet(nodesRef.current);
      return found
        ? { ok: true as const }
        : { ok: false as const, error: `节点不存在: ${id}` };
    },
    [],
  );

  const agentDeleteNodes = useCallback((ids: string[]) => {
    const set = new Set(ids.filter(Boolean));
    if (!set.size) return { ok: true as const, removed: 0 };
    const before = nodesRef.current.length;
    nodesRef.current = nodesRef.current.filter((n) => !set.has(n.id));
    edgesRef.current = edgesRef.current.filter(
      (e) => !set.has(e.source) && !set.has(e.target),
    );
    const removed = before - nodesRef.current.length;
    setNodesheet(nodesRef.current);
    setEdges(edgesRef.current);
    return { ok: true as const, removed };
  }, []);

  const agentSetGraph = useCallback(
    (nodes: FlowNode[], nextEdges: FlowEdge[]) => {
      const ns = nodes.map((n) => ({ ...n, selected: false }));
      const es = nextEdges.map((e) => ({ ...e, selected: false }));
      nodesRef.current = ns;
      edgesRef.current = es;
      setNodesheet(ns);
      setEdges(es);
      syncIdCounters(ns, es);
      lastSigRef.current = null;
    },
    [syncIdCounters],
  );

  useEffect(() => {
    if (workflowRef) {
      workflowRef.current = {
        getNodes: () => nodesRef.current,
        getEdges: () => edgesRef.current,
        loadNodes: (nodes: FlowNode[], nextEdges: FlowEdge[]) => {
          setNodesheet(nodes.map((n) => ({ ...n, selected: false })));
          setEdges(nextEdges.map((e) => ({ ...e, selected: false })));
          syncIdCounters(nodes, nextEdges);
          // 加载后重置签名，避免误触发一次自动保存
          lastSigRef.current = null;
        },
        clear: () => {
          nodesRef.current = [];
          edgesRef.current = [];
          setNodesheet([]);
          setEdges([]);
          lastSigRef.current = null;
        },
        openAddMenu,
        agentCreateNode,
        agentConnect,
        agentUpdateNode,
        agentDeleteNodes,
        agentSetGraph,
        agentPushSnapshot,
        agentUndo,
        getSnapshotCount: () => undoStack.current.length,
      };
    }
  }, [
    workflowRef,
    openAddMenu,
    agentCreateNode,
    agentConnect,
    agentUpdateNode,
    agentDeleteNodes,
    agentSetGraph,
    agentPushSnapshot,
    agentUndo,
    syncIdCounters,
  ]);

  const nLen = nodesheet.length;

  return (
    <div className="absolute inset-0" style={{ background: 'var(--canvas-background)' }} ref={flowRef}>
      {/* 面板悬浮层 — 节点 portal 挂载点，独立于画布变换，始终保持固定大小 */}
      <div ref={panelRef} className="absolute inset-0 pointer-events-none z-30" />
      <FlowContext.Provider
        value={{
          setNodes: setNodesheet,
          setEdges,
          getNodes: () => nodesRef.current,
          getEdges: () => edgesRef.current,
          zoom: 1,
          panelRoot: panelRef,
        }}
      >
        <FlowCanvas
          nodes={nodesheet}
          edges={edges}
          nodeTypes={nodeTypes}
          setNodes={setNodesheet}
          setEdges={setEdges}
          onConnect={onConnect}
          onConnectEndOnPane={onConnectEndOnPane}
          onPaneContextMenu={onPaneContextMenu}
          onPaneClick={() => setMenuPos(null)}
          apiRef={apiRef}
        >
          {nLen === 0 && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-muted-foreground"><path d="M14 4.1 12 6" /><path d="m5.1 8-2.9-.8" /><path d="m6 12-1.9 2" /><path d="M7.2 2.2 8 5.1" /><path d="M9.037 9.69a.498.498 0 0 1 .653-.653l11 4.5a.5.5 0 0 1-.074.949l-4.349 1.041a1 1 0 0 0-.74.739l-1.04 4.35a.5.5 0 0 1-.95.074z" /></svg>
              <p className="mt-3 text-sm text-muted-foreground">双击或拖入资源以开始</p>
            </div>
          )}

        </FlowCanvas>
      </FlowContext.Provider>

      {menuPos && (
        <ContextMenu
          x={menuPos.x}
          y={menuPos.y}
          centerY={menuPos.centerY}
          onClose={() => {
            connectFrom.current = null; // 未选节点直接关闭，丢弃待连接来源
            spawnPos.current = null;
            setMenuPos(null);
          }}
          onSelectNode={(type) => {
            createNode(type);
            spawnPos.current = null;
            setMenuPos(null);
          }}
          onSelectResource={(type) => {
            createNode(type);
            spawnPos.current = null;
            setMenuPos(null);
          }}
        />
      )}
    </div>
  );
}
