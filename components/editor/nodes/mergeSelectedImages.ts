// 多选图片节点 → 图层合并：拼成一张并落新 image 节点

import type { FlowEdge, FlowNode } from '../flow/types';
import { fitMediaNodeSize, MEDIA_NODE_BASE_WIDTH } from './fitMediaNodeSize';
import { mergeImagesGrid } from './gridCropImage';
import { createLogger } from '../../../lib/logger';

const log = createLogger('mergeSelectedImages');

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

function nodeImageUrl(n: FlowNode): string {
  const urls = n.data?.imageUrls;
  if (Array.isArray(urls) && typeof urls[0] === 'string' && urls[0]) return urls[0];
  const v = n.data?.value;
  if (typeof v === 'string' && v) return v;
  const iu = n.data?.imageUrl;
  if (typeof iu === 'string' && iu) return iu;
  const fu = n.data?.fileUrl;
  if (typeof fu === 'string' && fu) return fu;
  return '';
}

/** 按画布位置排序：先上后下、先左后右 */
export function sortNodesByGrid(nodes: FlowNode[]): FlowNode[] {
  return [...nodes].sort((a, b) => {
    const dy = a.position.y - b.position.y;
    if (Math.abs(dy) > 24) return dy;
    return a.position.x - b.position.x;
  });
}

/** 从位置推断行列：同行 y 接近 */
export function inferGridShape(nodes: FlowNode[]): { cols: number; rows: number } {
  if (nodes.length <= 1) return { cols: 1, rows: 1 };
  const sorted = sortNodesByGrid(nodes);
  // 以首行 y 为基准，收集 y 带
  const rowBands: number[] = [];
  for (const n of sorted) {
    const y = n.position.y;
    if (!rowBands.some((b) => Math.abs(b - y) <= 24)) rowBands.push(y);
  }
  rowBands.sort((a, b) => a - b);
  const rows = Math.max(1, rowBands.length);
  // 每行节点数取最大
  let maxCols = 1;
  for (const by of rowBands) {
    const inRow = sorted.filter((n) => Math.abs(n.position.y - by) <= 24).length;
    maxCols = Math.max(maxCols, inRow);
  }
  // 若推断过稀，退回近似方阵
  if (maxCols * rows < nodes.length) {
    const cols = Math.ceil(Math.sqrt(nodes.length));
    return { cols, rows: Math.ceil(nodes.length / cols) };
  }
  return { cols: maxCols, rows };
}

export type MergeSelectedResult = {
  node: FlowNode;
  edge?: FlowEdge;
};

/**
 * 将已选中的带图节点合并为一张图，落在选区右侧。
 * 仅处理 image / upload 等有图 URL 的节点。
 */
export async function buildMergedImageNode(opts: {
  selected: FlowNode[];
  existingNodeIds?: Iterable<string>;
  existingEdgeIds?: Iterable<string>;
}): Promise<MergeSelectedResult | null> {
  const withImg = opts.selected
    .map((n) => ({ n, url: nodeImageUrl(n) }))
    .filter((x) => !!x.url);
  if (withImg.length < 2) {
    log.warn('buildMergedImageNode', 'need >=2 images', { n: withImg.length });
    return null;
  }

  const sorted = sortNodesByGrid(withImg.map((x) => x.n));
  const urls = sorted.map((n) => nodeImageUrl(n));
  const { cols, rows } = inferGridShape(sorted);
  const { dataUrl, width, height } = await mergeImagesGrid({ urls, cols, rows });
  const size = fitMediaNodeSize(width, height, MEDIA_NODE_BASE_WIDTH);

  let maxX = -Infinity;
  let minY = Infinity;
  for (const n of sorted) {
    const w = n.style?.width ?? MEDIA_NODE_BASE_WIDTH;
    maxX = Math.max(maxX, n.position.x + w);
    minY = Math.min(minY, n.position.y);
  }

  const usedN = new Set(opts.existingNodeIds ?? []);
  const usedE = new Set(opts.existingEdgeIds ?? []);
  const stamp = Date.now().toString(36);
  const id = uniqueId(usedN, `node-merge-${stamp}`);
  const edgeId = uniqueId(usedE, `e-merge-${stamp}`);
  const first = sorted[0];

  const node: FlowNode = {
    id,
    type: 'image',
    position: { x: maxX + GAP_X, y: minY },
    style: { width: size.width, height: size.height },
    selected: true,
    data: {
      label: '图层合并',
      prompt: '',
      model: first.data?.model,
      aspect: 'auto',
      quality: first.data?.quality || 'high',
      res: first.data?.res || '1K',
      qty: '1x',
      value: dataUrl,
      imageUrls: [dataUrl],
      status: 'done',
      error: '',
      tags: [],
      mergedFrom: sorted.map((n) => n.id),
    },
  };

  // 可选：从第一个源连线，便于追溯
  const edge: FlowEdge = {
    id: edgeId,
    source: first.id,
    target: id,
    animated: false,
  };

  log.info('buildMergedImageNode', 'ok', {
    count: urls.length,
    cols,
    rows,
    newId: id,
  });
  return { node, edge };
}
