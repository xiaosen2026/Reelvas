/**
 * 媒体预览节点统一尺寸（Image / Upload / Video 等）。
 * 固定基准宽，按真实宽高比求高，避免同资源在不同节点尺寸不一致。
 */

/** 统一基准宽（px）；禁止在各节点硬编码不同宽度 */
export const MEDIA_NODE_BASE_WIDTH = 500;

/** 最小高度，防止极端竖图过矮 */
export const MEDIA_NODE_MIN_HEIGHT = 120;

/** 按真实宽高比计算节点尺寸（固定宽，按比例求高） */
export function fitMediaNodeSize(
  naturalW: number,
  naturalH: number,
  baseW = MEDIA_NODE_BASE_WIDTH,
): { width: number; height: number } {
  if (!naturalW || !naturalH) return { width: baseW, height: baseW };
  const ratio = naturalW / naturalH;
  const height = Math.max(MEDIA_NODE_MIN_HEIGHT, Math.round(baseW / ratio));
  return { width: baseW, height };
}

type SizedNode = { id: string; style?: { width?: number; height?: number; [k: string]: unknown } };

/** 将 fit 结果写回指定节点的 style（画布 setNodes 用） */
export function mapNodeMediaSize<T extends SizedNode>(
  nodes: T[],
  id: string,
  naturalW: number,
  naturalH: number,
): T[] {
  const next = fitMediaNodeSize(naturalW, naturalH);
  return nodes.map((n) =>
    n.id === id ? { ...n, style: { ...n.style, width: next.width, height: next.height } } : n,
  );
}
