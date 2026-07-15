'use client';

// 全景节点：上游边 / data 场景同步（轮询 + 写回节点 data）

import { useEffect, useRef, useState } from 'react';
import { useFlow } from '../flow';
import {
  buildScenesFromEdges,
  fallbackScenesFromData,
  scenesSignature,
  type PanoramaScene,
} from './panoramaScenes';
import { createLogger } from '@/lib/logger';

const log = createLogger('usePanoramaScenes');

type DataSlice = {
  value?: string;
  refImage?: string;
  scenes?: PanoramaScene[];
  active?: number;
};

export function usePanoramaScenes(id: string, data: DataSlice) {
  const rf = useFlow();
  const [active, setActive] = useState(Number(data.active ?? 0) || 0);
  const [scenes, setScenes] = useState<PanoramaScene[]>(() => fallbackScenesFromData(data));
  const sigRef = useRef('');

  useEffect(() => {
    const fromEdges = buildScenesFromEdges(id, rf.getNodes(), rf.getEdges());
    const next =
      fromEdges.length > 0
        ? fromEdges
        : fallbackScenesFromData({
            value: data.value,
            refImage: data.refImage,
            scenes: data.scenes,
          });
    const sig = scenesSignature(next);
    if (sig === sigRef.current) return;
    sigRef.current = sig;
    setScenes(next);

    setActive((prev) => {
      const nextActive = prev >= next.length ? Math.max(0, next.length - 1) : prev;
      const outUrl = next[nextActive]?.url || '';
      rf.setNodes((nds) =>
        nds.map((n) =>
          n.id === id
            ? {
                ...n,
                data: {
                  ...n.data,
                  scenes: next,
                  active: nextActive,
                  value: outUrl || n.data?.value,
                  refImage: outUrl || n.data?.refImage,
                },
              }
            : n,
        ),
      );
      return nextActive;
    });
    log.info('syncScenes', 'updated', { id, count: next.length });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅 data 图源变化时同步
  }, [id, rf, data.value, data.refImage]);

  useEffect(() => {
    const t = window.setInterval(() => {
      const fromEdges = buildScenesFromEdges(id, rf.getNodes(), rf.getEdges());
      const next =
        fromEdges.length > 0
          ? fromEdges
          : fallbackScenesFromData({
              value: String(data.value || ''),
              refImage: String(data.refImage || ''),
            });
      const sig = scenesSignature(next);
      if (sig === sigRef.current) return;
      sigRef.current = sig;
      setScenes(next);
      setActive((a) => {
        const na = a >= next.length ? Math.max(0, next.length - 1) : a;
        const outUrl = next[na]?.url || '';
        rf.setNodes((nds) =>
          nds.map((n) =>
            n.id === id
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    scenes: next,
                    active: na,
                    value: outUrl || n.data?.value,
                  },
                }
              : n,
          ),
        );
        return na;
      });
      log.info('pollScenes', 'edge sync', { id, count: next.length });
    }, 800);
    return () => window.clearInterval(t);
  }, [id, rf, data.value, data.refImage]);

  return { scenes, setScenes, active, setActive };
}
