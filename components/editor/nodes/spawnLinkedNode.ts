// 从源节点旁侧生成下游节点并自动连线（图片工具栏「快速出节点」）

import type { FlowEdge, FlowNode } from '../flow/types';
import { nodeConfigs } from './index';
import { createLogger } from '../../../lib/logger';

const log = createLogger('spawnLinkedNode');

function uniqueId(used: Set<string>, hint: string): string {
  let id = hint;
  let i = 0;
  while (used.has(id)) {
    i += 1;
    id = `${hint}-${i}`;
  }
  used.add(id);
  return id;
}

export type SpawnLinkedOpts = {
  source: FlowNode;
  /** nodeConfigs 的 key，如 image / panorama / upscale */
  menuType: string;
  data?: Record<string, unknown>;
  /** 相对源节点右侧偏移，默认 8 */
  gapX?: number;
  gapY?: number;
  existingNodeIds?: Iterable<string>;
  existingEdgeIds?: Iterable<string>;
  selectNew?: boolean;
};

export type SpawnLinkedResult = {
  node: FlowNode;
  edge: FlowEdge;
};

/**
 * 在源节点右侧创建目标类型节点，并建立 source → new 的边。
 * 调用方负责 setNodes / setEdges 合并。
 */
export function buildLinkedSpawn(opts: SpawnLinkedOpts): SpawnLinkedResult | null {
  const cfg = nodeConfigs[opts.menuType];
  if (!cfg) {
    log.warn('buildLinkedSpawn', 'unknown menuType', { menuType: opts.menuType });
    return null;
  }

  const usedN = new Set(opts.existingNodeIds ?? []);
  usedN.add(opts.source.id);
  const usedE = new Set(opts.existingEdgeIds ?? []);
  const stamp = Date.now().toString(36);
  const id = uniqueId(usedN, `node-${opts.menuType}-${stamp}`);
  const edgeId = uniqueId(usedE, `e-${opts.menuType}-${stamp}`);

  const srcW = opts.source.style?.width ?? 420;
  const gapX = opts.gapX ?? 48;
  const gapY = opts.gapY ?? 0;

  const node: FlowNode = {
    id,
    type: cfg.type,
    position: {
      x: opts.source.position.x + srcW + gapX,
      y: opts.source.position.y + gapY,
    },
    style: { width: cfg.width, height: cfg.height },
    selected: opts.selectNew !== false,
    data: {
      label: cfg.labelPrefix,
      value: '',
      tags: [],
      ...(opts.data || {}),
    },
  };

  const edge: FlowEdge = {
    id: edgeId,
    source: opts.source.id,
    target: id,
    animated: true,
  };

  log.info('buildLinkedSpawn', 'spawn', {
    sourceId: opts.source.id,
    newId: id,
    menuType: opts.menuType,
    nodeType: cfg.type,
  });

  return { node, edge };
}

/** 合并节点：取消其它选中，追加新节点 */
export function mergeSpawnNode(current: FlowNode[], next: FlowNode, selectNew = true): FlowNode[] {
  return [
    ...current.map((n) => (n.selected ? { ...n, selected: false } : n)),
    selectNew ? { ...next, selected: true } : { ...next, selected: false },
  ];
}

export function mergeSpawnEdge(current: FlowEdge[], next: FlowEdge): FlowEdge[] {
  if (current.some((e) => e.id === next.id)) return current;
  return [...current, next];
}
