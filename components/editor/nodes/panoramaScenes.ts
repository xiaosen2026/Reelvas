// 全景节点场景列表：从上游边同步 equirect / 平面图 URL（对照 cava FullImageNodePanel）

import type { FlowEdge, FlowNode } from '../flow/types';
import { extractNodeOutputs } from './collectUpstream';

export type PanoramaScene = {
  name: string;
  url: string;
  edgeId?: string;
  sourceNodeId?: string;
};

/** 从指向 target 的入边收集场景（每条有图的边一个场景） */
export function buildScenesFromEdges(
  targetId: string,
  nodes: FlowNode[],
  edges: FlowEdge[],
): PanoramaScene[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const incoming = edges.filter((e) => e.target === targetId);
  const scenes: PanoramaScene[] = [];

  for (const e of incoming) {
    const src = byId.get(e.source);
    if (!src) continue;
    const { imageSrcs } = extractNodeOutputs(src);
    const url = imageSrcs[0] || '';
    if (!url) continue;
    scenes.push({
      name: '',
      url,
      edgeId: e.id,
      sourceNodeId: src.id,
    });
  }

  renumberScenes(scenes);
  return scenes;
}

export function renumberScenes(scenes: PanoramaScene[]) {
  scenes.forEach((s, i) => {
    s.name = `场景${i + 1}`;
  });
}

/** 序列化比较：edgeId+url 列表是否变化 */
export function scenesSignature(scenes: PanoramaScene[]): string {
  return scenes.map((s) => `${s.edgeId || ''}|${s.url}`).join(';;');
}

/**
 * 若无上游边图，用节点自身 refImage / value 兜底成单场景
 *（图片工具栏「全景图」快速创建时常已预填）
 */
export function fallbackScenesFromData(data: {
  value?: string;
  refImage?: string;
  scenes?: PanoramaScene[];
}): PanoramaScene[] {
  if (Array.isArray(data.scenes) && data.scenes.length > 0) {
    const copy = data.scenes
      .filter((s) => s && typeof s.url === 'string' && s.url)
      .map((s) => ({ ...s }));
    renumberScenes(copy);
    return copy;
  }
  const url = (data.value || data.refImage || '').trim();
  if (!url) return [];
  return [{ name: '场景1', url }];
}
