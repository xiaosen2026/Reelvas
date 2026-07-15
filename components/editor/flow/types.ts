// 自研画布引擎 —— 类型定义与 Position 枚举（自研，不依赖第三方库）
// 完全自研，不依赖任何第三方画布库

export const Position = {
  Left: 'left',
  Right: 'right',
  Top: 'top',
  Bottom: 'bottom',
} as const;

export type PositionType = (typeof Position)[keyof typeof Position];

// 节点：结构保持通用，便于现有节点组件零改动
export interface FlowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, any>;
  style?: { width?: number; height?: number };
  selected?: boolean;
  group?: string;
}

// 连线
export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  animated?: boolean;
  selected?: boolean;
}

// 视口：平移偏移 + 缩放
export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

// 拉线进行中的临时状态
export interface ConnectionState {
  fromNodeId: string;
  handleType: 'source' | 'target';
  // 起点（画布坐标）
  startX: number;
  startY: number;
  // 当前鼠标（画布坐标）
  curX: number;
  curY: number;
}

// 节点组件签名（现有 9 个节点符合此形状）
export type NodeComponent = React.ComponentType<{
  id: string;
  data: Record<string, any>;
  selected?: boolean;
}>;

export type NodeTypes = Record<string, NodeComponent>;
