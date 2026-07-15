// 宫格裁切结果：在源节点右侧紧挨生成 cols×rows 张图片节点

import type { FlowEdge, FlowNode } from '../flow/types';
import { fitMediaNodeSize, MEDIA_NODE_BASE_WIDTH } from './fitMediaNodeSize';
import { splitImageToGrid } from './gridCropImage';
import { createLogger } from '../../../lib/logger';

const log = createLogger('spawnGridCropNodes');

/** 格子节点间距：仅挨着，无缝隙 */
const GAP = 0;
/** 相对源节点右侧间距 */
const GAP_X = 48;

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

export type SpawnGridCropResult = {
  nodes: FlowNode[];
  edges: FlowEdge[];
};

/**
 * 切图并生成对齐的 image 节点（每格一张，网格拼合视觉）。
 */
export async function buildGridCropNodes(opts: {
  source: FlowNode;
  imageUrl: string;
  cols: number;
  rows: number;
  labelPrefix?: string;
  existingNodeIds?: Iterable<string>;
  existingEdgeIds?: Iterable<string>;
}): Promise<SpawnGridCropResult> {
  const { source, imageUrl, cols, rows } = opts;
  const cells = await splitImageToGrid(imageUrl, cols, rows);
  if (!cells.length) return { nodes: [], edges: [] };

  // 所有格统一节点外框（按首格比例）
  const sample = cells[0];
  const size = fitMediaNodeSize(sample.naturalW, sample.naturalH, MEDIA_NODE_BASE_WIDTH);
  const usedN = new Set(opts.existingNodeIds ?? []);
  usedN.add(source.id);
  const usedE = new Set(opts.existingEdgeIds ?? []);
  const stamp = Date.now().toString(36);
  const prefix = opts.labelPrefix || '裁剪';
  const srcW = source.style?.width ?? MEDIA_NODE_BASE_WIDTH;
  const baseX = source.position.x + srcW + GAP_X;
  const baseY = source.position.y;

  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];

  for (const cell of cells) {
    const id = uniqueId(usedN, `node-crop-${stamp}-${cell.row + 1}-${cell.col + 1}`);
    const edgeId = uniqueId(usedE, `e-crop-${stamp}-${cell.index}`);
    const label = `${prefix} ${cell.row + 1}-${cell.col + 1}`;
    nodes.push({
      id,
      type: 'image',
      position: {
        x: baseX + cell.col * (size.width + GAP),
        y: baseY + cell.row * (size.height + GAP),
      },
      style: { width: size.width, height: size.height },
      selected: cell.index === 0,
      data: {
        label,
        prompt: '',
        model: source.data?.model,
        aspect: source.data?.aspect || 'auto',
        quality: source.data?.quality || 'high',
        res: source.data?.res || '1K',
        qty: '1x',
        value: cell.url,
        imageUrls: [cell.url],
        status: 'done',
        error: '',
        tags: [],
        gridCrop: { cols, rows, col: cell.col, row: cell.row, from: source.id },
      },
    });
    edges.push({
      id: edgeId,
      source: source.id,
      target: id,
      animated: false,
    });
  }

  log.info('buildGridCropNodes', 'ok', {
    sourceId: source.id,
    cols,
    rows,
    n: nodes.length,
    cellW: size.width,
    cellH: size.height,
  });
  return { nodes, edges };
}

export function mergeGridCropNodes(
  current: FlowNode[],
  next: FlowNode[],
): FlowNode[] {
  if (!next.length) return current;
  const used = new Set(current.map((n) => n.id));
  const fixed = next.map((n, idx) => {
    if (!used.has(n.id)) {
      used.add(n.id);
      return { ...n, selected: n.selected };
    }
    const id = uniqueId(used, `node-crop-fix-${Date.now().toString(36)}-${idx}`);
    return { ...n, id };
  });
  return [
    ...current.map((n) => (n.selected ? { ...n, selected: false } : n)),
    ...fixed,
  ];
}

export function mergeGridCropEdges(
  current: FlowEdge[],
  next: FlowEdge[],
): FlowEdge[] {
  if (!next.length) return current;
  const used = new Set(current.map((e) => e.id));
  const extra = next.filter((e) => !used.has(e.id));
  return [...current, ...extra];
}
