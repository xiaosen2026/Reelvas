'use client';

import { useEffect, useRef, useState } from 'react';

const KEY = 'reelvas_perf_panel';

export function usePerfVisible() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    setVisible(localStorage.getItem(KEY) === '1');
    const onStorage = () => setVisible(localStorage.getItem(KEY) === '1');
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  const toggle = () => {
    const next = !visible;
    localStorage.setItem(KEY, next ? '1' : '0');
    window.dispatchEvent(new Event('storage'));
  };
  return { visible, toggle };
}

export function PerfMonitor() {
  const [fps, setFps] = useState(0);
  const [frameMs, setFrameMs] = useState(0);
  const [mem, setMem] = useState(0);
  const framesRef = useRef<number[]>([]);
  const lastRef = useRef(performance.now());
  const rafRef = useRef(0);
  const avgMsRef = useRef(0);
  const avgFpsRef = useRef(0);
  const displayRef = useRef(0); // 上次更新屏幕的时间

  useEffect(() => {
    const tick = () => {
      const now = performance.now();
      const dt = now - lastRef.current;
      lastRef.current = now;

      framesRef.current.push(now);
      while (framesRef.current.length > 0 && framesRef.current[0] <= now - 1000) {
        framesRef.current.shift();
      }

      // 指数平滑：alpha=0.03 禁止跳动
      const rawFps = framesRef.current.length;
      const rawMs = dt;
      avgFpsRef.current = avgFpsRef.current + 0.03 * (rawFps - avgFpsRef.current);
      avgMsRef.current = avgMsRef.current + 0.03 * (rawMs - avgMsRef.current);

      // 每 500ms 才更新一次屏幕显示
      if (now - displayRef.current >= 500) {
        displayRef.current = now;
        setFps(Math.round(avgFpsRef.current));
        setFrameMs(Math.round(avgMsRef.current * 10) / 10);
        const m = (performance as unknown as { memory?: { usedJSHeapSize?: number } }).memory;
        if (m?.usedJSHeapSize !== undefined) setMem(Math.round(m.usedJSHeapSize / 1048576 * 10) / 10);
      }

      rafRef.current = requestAnimationFrame(tick);
    };
    lastRef.current = performance.now();
    displayRef.current = performance.now();
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <div className="absolute bottom-1.5 right-6 z-30 flex items-center gap-3 px-3 h-7 rounded-md bg-card/70 backdrop-blur-sm border border-border/30 text-xs tabular-nums nodrag select-none">
      <div className="flex items-center gap-1">
        <span className={`font-medium ${fps < 30 ? 'text-red-400' : fps < 55 ? 'text-amber-400' : 'text-emerald-400'}`}>{fps}</span>
        <span className="text-muted-foreground/70">FPS</span>
      </div>
      <div className="w-px h-3 bg-border/30" />
      <div className="flex items-center gap-1">
        <span className="font-medium text-foreground/70">{frameMs}</span>
        <span className="text-muted-foreground/70">ms</span>
      </div>
      {mem > 0 && (
        <>
          <div className="w-px h-3 bg-border/30" />
          <div className="flex items-center gap-1">
            <span className="font-medium text-foreground/70">{mem}</span>
            <span className="text-muted-foreground/70">MB</span>
          </div>
        </>
      )}
    </div>
  );
}
