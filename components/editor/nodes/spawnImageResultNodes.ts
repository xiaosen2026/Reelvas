// 多数量出图：除首张外，在源节点旁紧挨宫格落新图片节点

import type { FlowNode } from '../flow/types';
import { createLogger } from '../../../lib/logger';

const log = createLogger('spawnImageResultNodes');

/** 节点间距：紧挨拼接（对齐分镜网格视觉） */
const GAP = 8;

/** 总张数 N 的宫格列数：1→1，2→2，3/4→2 */
export function gridCols(total: number): number {
  if (total <= 1) return 1;
  return 2;
}

/** index 0 为源节点原位；其余相对源节点偏移（不 snap，保证紧挨） */
export function gridOffset(
  index: number,
  total: number,
  size: { width: number; height: number },
): { x: number; y: number } {
  const cols = gridCols(total);
  const col = index % cols;
  const row = Math.floor(index / cols);
  return {
    x: col * (size.width + GAP),
    y: row * (size.height + GAP),
  };
}

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

export type SpawnImageMeta = {
  aspect?: string;
  quality?: string;
  res?: string;
  recipeId?: string;
  recipeTitle?: string;
};

/**
 * 根据多图 URL 生成旁侧节点（不含源节点）。
 * urls[0] 留给源节点；urls[1..] 各建一个 image 节点，2 列宫格紧挨源节点。
 */
export function buildSiblingImageNodes(opts: {
  source: FlowNode;
  urls: string[];
  prompt: string;
  model: string;
  meta: SpawnImageMeta;
  existingIds?: Iterable<string>;
}): FlowNode[] {
  const { source, urls, prompt, model, meta, existingIds } = opts;
  if (urls.length <= 1) return [];

  const width = source.style?.width ?? 420;
  const height = source.style?.height ?? 500;
  const total = urls.length;
  const baseLabel = String(source.data?.label || '图片节点');
  const used = new Set(existingIds ?? []);
  used.add(source.id);
  const stamp = Date.now().toString(36);

  const siblings: FlowNode[] = [];
  for (let i = 1; i < total; i++) {
    const off = gridOffset(i, total, { width, height });
    const id = uniqueId(used, `node-img-${stamp}-${i}`);
    const url = urls[i];
    siblings.push({
      id,
      type: 'image',
      position: {
        x: source.position.x + off.x,
        y: source.position.y + off.y,
      },
      style: { width, height },
      selected: false,
      data: {
        label: `${baseLabel}-${i + 1}`,
        prompt,
        model,
        qty: '1x',
        aspect: meta.aspect,
        quality: meta.quality,
        res: meta.res,
        recipeId: meta.recipeId || '',
        recipeTitle: meta.recipeTitle || '',
        value: url,
        imageUrls: [url],
        status: 'done',
        error: '',
        tags: [],
      },
    });
  }

  log.info('buildSiblingImageNodes', 'spawn', {
    sourceId: source.id,
    total,
    siblings: siblings.length,
    cols: gridCols(total),
  });
  return siblings;
}

/** 合并到画布：避免 id 与已有节点冲突，并取消其它选中 */
export function mergeSpawnedImageNodes(
  current: FlowNode[],
  siblings: FlowNode[],
): FlowNode[] {
  if (!siblings.length) return current;
  const used = new Set(current.map((n) => n.id));
  const fixed = siblings.map((n, idx) => {
    if (!used.has(n.id)) {
      used.add(n.id);
      return n;
    }
    const id = uniqueId(used, `node-img-fix-${Date.now().toString(36)}-${idx}`);
    return { ...n, id };
  });
  return [...current.map((n) => (n.selected ? { ...n, selected: false } : n)), ...fixed];
}
