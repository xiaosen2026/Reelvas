// 轮询当前节点入边识别到的上游图片（+ 本地附加）

import { useCallback, useEffect, useRef, useState } from 'react';
import { useFlow } from '../flow';
import { collectUpstreamInputs } from './collectUpstream';
import { createLogger } from '../../../lib/logger';

const log = createLogger('useUpstreamImages');

export function useUpstreamImages(nodeId: string) {
  const rf = useFlow();
  const [linked, setLinked] = useState<string[]>([]);
  const [local, setLocal] = useState<string[]>([]);
  const linkedSig = useRef('');

  useEffect(() => {
    const tick = () => {
      const imgs = collectUpstreamInputs(nodeId, rf.getNodes(), rf.getEdges()).imageSrcs;
      const sig = imgs.join('\0');
      if (sig === linkedSig.current) return;
      linkedSig.current = sig;
      setLinked(imgs);
      log.debug('tick', 'upstream images', { nodeId, n: imgs.length });
    };
    tick();
    const t = window.setInterval(tick, 400);
    return () => window.clearInterval(t);
  }, [nodeId, rf]);

  // 去重保序：连线识别在前，本地附加在后
  const imageSrcs = (() => {
    const out: string[] = [];
    for (const u of [...linked, ...local]) {
      if (u && !out.includes(u)) out.push(u);
    }
    return out;
  })();

  const addLocalFiles = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (!list.length) return;
    const urls = await Promise.all(
      list.map(
        (f) =>
          new Promise<string>((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(String(r.result || ''));
            r.onerror = () => reject(r.error);
            r.readAsDataURL(f);
          }),
      ),
    );
    setLocal((prev) => {
      const next = [...prev];
      for (const u of urls) {
        if (u && !next.includes(u)) next.push(u);
      }
      return next;
    });
    log.info('addLocalFiles', 'ok', { nodeId, n: urls.length });
  }, [nodeId]);

  const removeLocal = useCallback((src: string) => {
    setLocal((prev) => prev.filter((u) => u !== src));
  }, []);

  return { imageSrcs, linked, local, addLocalFiles, removeLocal };
}
