// 将 dataURL 截图批量生成为「上传」节点并连到源节点（3D / 全景共用）

import type { FlowEdge, FlowNode } from '../flow/types';
import { buildLinkedSpawn, mergeSpawnEdge, mergeSpawnNode } from './spawnLinkedNode';
import { nodeConfigs } from './index';
import { mimeFromDataUrl } from './panoramaCapture';
import { createLogger } from '@/lib/logger';

const log = createLogger('spawnUploadCaptures');

export type UploadCaptureItem = {
  dataUrl: string;
  fileName?: string;
};

export type SpawnUploadCapturesOpts = {
  sourceId: string;
  captures: UploadCaptureItem[];
  nodes: FlowNode[];
  edges: FlowEdge[];
  /** 写回源节点缩略图字段名，默认 thumbnailUrl */
  thumbField?: string;
};

export type SpawnUploadCapturesResult = {
  nodes: FlowNode[];
  edges: FlowEdge[];
  spawned: number;
  firstDataUrl: string;
};

/**
 * 在源节点右侧纵向堆叠上传节点；首张同步到源节点缩略图。
 */
export function spawnUploadCaptures(opts: SpawnUploadCapturesOpts): SpawnUploadCapturesResult | null {
  const list = opts.captures.filter((c) => Boolean(c?.dataUrl));
  if (!list.length) return null;

  const source = opts.nodes.find((n) => n.id === opts.sourceId);
  if (!source) {
    log.warn('spawn', '源节点不存在', { id: opts.sourceId });
    return null;
  }

  const first = list[0];
  const uploadH = nodeConfigs.upload?.height ?? 240;
  const gapY = 16;
  const usedN = new Set(opts.nodes.map((n) => n.id));
  const usedE = new Set(opts.edges.map((e) => e.id));
  let nextNodes = opts.nodes;
  let nextEdges = opts.edges;
  let spawned = 0;

  list.forEach((cap, i) => {
    const fileName = cap.fileName || `capture-${i + 1}.png`;
    const fileType = mimeFromDataUrl(cap.dataUrl);
    const result = buildLinkedSpawn({
      source,
      menuType: 'upload',
      gapY: i * (uploadH + gapY),
      data: {
        label: fileName.replace(/\.[^.]+$/, '') || '上传',
        fileUrl: cap.dataUrl,
        fileType,
        fileName,
        mediaKind: fileType.startsWith('image/')
          ? 'image'
          : fileType.startsWith('video/')
            ? 'video'
            : fileType.startsWith('audio/')
              ? 'audio'
              : 'file',
        value: cap.dataUrl,
        imageUrl: fileType.startsWith('image/') ? cap.dataUrl : undefined,
      },
      existingNodeIds: usedN,
      existingEdgeIds: usedE,
      selectNew: i === list.length - 1,
    });
    if (!result) return;
    usedN.add(result.node.id);
    usedE.add(result.edge.id);
    nextNodes = mergeSpawnNode(nextNodes, result.node, i === list.length - 1);
    nextEdges = mergeSpawnEdge(nextEdges, result.edge);
    spawned += 1;
  });

  const thumbField = opts.thumbField ?? 'thumbnailUrl';
  nextNodes = nextNodes.map((n) =>
    n.id === opts.sourceId
      ? {
          ...n,
          data: {
            ...n.data,
            [thumbField]: first.dataUrl,
            value: first.dataUrl,
            content: first.fileName || 'capture.png',
          },
        }
      : n,
  );

  log.info('spawn', 'ok', { sourceId: opts.sourceId, n: spawned });
  return { nodes: nextNodes, edges: nextEdges, spawned, firstDataUrl: first.dataUrl };
}
