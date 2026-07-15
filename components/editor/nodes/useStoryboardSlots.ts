// 分镜格子状态：上游轮询同步 + 本地上传 + 交换 + 写回 data

import { useCallback, useEffect, useRef, useState } from 'react';
import { useFlow } from '../flow';
import { collectUpstreamInputs } from './collectUpstream';
import {
  normalizeSlots,
  parseAspect,
  parseGrid,
  parseLocalUrls,
  slotCount,
  swapSlots,
  syncSlotsWithUpstream,
  type StoryAspect,
  type StoryGrid,
} from './storyboardGrid';
import { createLogger } from '@/lib/logger';

const log = createLogger('useStoryboardSlots');

type DataSlice = {
  slots?: unknown;
  localUrls?: unknown;
  aspect?: unknown;
  grid?: unknown;
  thumbnailUrl?: string;
};

export function useStoryboardSlots(id: string, data: DataSlice) {
  const rf = useFlow();
  const aspect = parseAspect(data.aspect);
  const grid = parseGrid(data.grid);
  const n = slotCount(grid);

  const [slots, setSlots] = useState<string[]>(() => normalizeSlots(data.slots, n));
  const [localUrls, setLocalUrls] = useState<string[]>(() => parseLocalUrls(data.localUrls));
  const slotsRef = useRef(slots);
  const localRef = useRef(localUrls);
  const slotSigRef = useRef(slots.join('\0'));
  const persistSigRef = useRef('');

  useEffect(() => {
    slotsRef.current = slots;
    slotSigRef.current = slots.join('\0');
  }, [slots]);
  useEffect(() => {
    localRef.current = localUrls;
  }, [localUrls]);

  useEffect(() => {
    setSlots((prev) => {
      const next = normalizeSlots(prev, n);
      return next.join('\0') === prev.join('\0') ? prev : next;
    });
  }, [n]);

  // 轮询上游连线（与全景一致）
  useEffect(() => {
    const tick = () => {
      const images = collectUpstreamInputs(id, rf.getNodes(), rf.getEdges()).imageSrcs;
      const localSet = new Set(localRef.current);
      const next = syncSlotsWithUpstream(slotsRef.current, images, localSet, n);
      const nextSig = next.join('\0');
      if (nextSig === slotSigRef.current) return;
      setSlots(next);
      log.info('syncUpstream', 'ok', { id, filled: next.filter(Boolean).length, up: images.length });
    };
    tick();
    const t = window.setInterval(tick, 400);
    return () => window.clearInterval(t);
  }, [id, rf, n]);

  useEffect(() => {
    const sig = `${grid}|${aspect}|${slots.join('\0')}|${localUrls.join('\0')}`;
    if (sig === persistSigRef.current) return;
    persistSigRef.current = sig;
    const thumb = slots.find(Boolean) || data.thumbnailUrl || '';
    rf.setNodes((nds) =>
      nds.map((node) =>
        node.id === id
          ? {
              ...node,
              data: {
                ...node.data,
                slots,
                localUrls,
                aspect,
                grid,
                thumbnailUrl: thumb || node.data?.thumbnailUrl,
              },
            }
          : node,
      ),
    );
  }, [slots, localUrls, aspect, grid, id, rf, data.thumbnailUrl]);

  const setAspect = useCallback(
    (a: StoryAspect) => {
      rf.setNodes((nds) =>
        nds.map((node) => (node.id === id ? { ...node, data: { ...node.data, aspect: a } } : node)),
      );
    },
    [id, rf],
  );

  const setGrid = useCallback(
    (g: StoryGrid) => {
      setSlots((prev) => normalizeSlots(prev, slotCount(g)));
      rf.setNodes((nds) =>
        nds.map((node) => (node.id === id ? { ...node, data: { ...node.data, grid: g } } : node)),
      );
    },
    [id, rf],
  );

  const onSwap = useCallback((a: number, b: number) => {
    setSlots((prev) => swapSlots(prev, a, b));
  }, []);

  const clearAll = useCallback(() => {
    setSlots(Array.from({ length: n }, () => ''));
    setLocalUrls([]);
    log.info('clearAll', 'ok', { id });
  }, [id, n]);

  const fillLocal = useCallback((index: number, url: string) => {
    setSlots((prev) => {
      const next = prev.slice();
      if (index < 0 || index >= next.length) return prev;
      next[index] = url;
      return next;
    });
    setLocalUrls((prev) => (prev.includes(url) ? prev : [...prev, url]));
  }, []);

  return {
    aspect,
    grid,
    n,
    slots,
    localUrls,
    setAspect,
    setGrid,
    onSwap,
    clearAll,
    fillLocal,
  };
}
