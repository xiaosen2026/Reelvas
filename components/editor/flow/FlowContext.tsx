'use client';

// 画布上下文 —— 自研 useReactFlow()
// 向节点组件暴露 setNodes；向 Handle 暴露连线交互所需的节点 id 与回调

import { createContext, useContext } from 'react';
import type { FlowEdge, FlowNode } from './types';

interface FlowContextValue {
  setNodes: (updater: (nodes: FlowNode[]) => FlowNode[]) => void;
  setEdges: (updater: (edges: FlowEdge[]) => FlowEdge[]) => void;
  /** 读取当前图（节点生成时解析上游连线） */
  getNodes: () => FlowNode[];
  getEdges: () => FlowEdge[];
  zoom: number;
  panelRoot: React.RefObject<HTMLDivElement | null>;
}

export const FlowContext = createContext<FlowContextValue | null>(null);

// 兼容原 useReactFlow() 用法：rf['setNodes'](updater)
export function useFlow(): FlowContextValue {
  const ctx = useContext(FlowContext);
  if (!ctx) {
    // 容错：脱离画布时的空实现，避免崩溃
    return {
      setNodes: () => {},
      setEdges: () => {},
      getNodes: () => [],
      getEdges: () => [],
      zoom: 1,
      panelRoot: { current: null },
    };
  }
  return ctx;
}

// —— Handle 专用上下文：让 Handle 知道自己属于哪个节点，并触发连线交互 ——
interface HandleContextValue {
  nodeId: string;
  // Handle 上按下鼠标：发起拉线
  onHandlePointerDown: (nodeId: string, handleType: 'source' | 'target', e: React.PointerEvent) => void;
  // 鼠标在 Handle 上抬起：完成连线
  onHandlePointerUp: (nodeId: string, handleType: 'source' | 'target') => void;
  // Handle 挂载后上报自己相对节点原点的偏移（用于连线精确定位）
  registerHandle: (nodeId: string, handleType: 'source' | 'target', offset: { x: number; y: number }) => void;
}

export const HandleContext = createContext<HandleContextValue | null>(null);

export function useHandleCtx(): HandleContextValue | null {
  return useContext(HandleContext);
}
