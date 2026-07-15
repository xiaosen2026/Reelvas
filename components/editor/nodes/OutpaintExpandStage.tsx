'use client';

// 扩图交互：类似裁切框，向外拖边/角扩大绿幕；原图按真实比例，绝不拉扁

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GREEN_SCREEN_HEX, type ExpandPads, clampPads } from './buildGreenScreenCanvas';

export type EdgeKey = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

type Props = {
  imageUrl: string;
  pads: ExpandPads;
  onChange: (next: ExpandPads) => void;
  disabled?: boolean;
  onImageLoad?: (w: number, h: number) => void;
};

const HANDLE: { key: EdgeKey; className: string; cursor: string }[] = [
  { key: 'n', className: 'left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 w-8 h-2.5', cursor: 'ns-resize' },
  { key: 's', className: 'left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 w-8 h-2.5', cursor: 'ns-resize' },
  { key: 'e', className: 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2 w-2.5 h-8', cursor: 'ew-resize' },
  { key: 'w', className: 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-8', cursor: 'ew-resize' },
  { key: 'nw', className: 'left-0 top-0 -translate-x-1/2 -translate-y-1/2 size-3', cursor: 'nwse-resize' },
  { key: 'ne', className: 'right-0 top-0 translate-x-1/2 -translate-y-1/2 size-3', cursor: 'nesw-resize' },
  { key: 'sw', className: 'left-0 bottom-0 -translate-x-1/2 translate-y-1/2 size-3', cursor: 'nesw-resize' },
  { key: 'se', className: 'right-0 bottom-0 translate-x-1/2 translate-y-1/2 size-3', cursor: 'nwse-resize' },
];

/** 源图在合成画布中的相对位置（百分比） */
export function padLayout(pads: ExpandPads) {
  const p = clampPads(pads);
  const totalW = 1 + p.left + p.right;
  const totalH = 1 + p.top + p.bottom;
  return {
    leftPct: (p.left / totalW) * 100,
    topPct: (p.top / totalH) * 100,
    widthPct: (1 / totalW) * 100,
    heightPct: (1 / totalH) * 100,
    totalW,
    totalH,
  };
}

/** 在 viewport 内按 aspect 等比 fit（letterbox） */
function fitBox(vw: number, vh: number, aspect: number) {
  if (vw < 1 || vh < 1 || aspect <= 0) return { w: Math.max(1, vw), h: Math.max(1, vh) };
  if (vw / vh > aspect) {
    const h = vh;
    return { w: Math.max(1, h * aspect), h };
  }
  const w = vw;
  return { w, h: Math.max(1, w / aspect) };
}

export function OutpaintExpandStage({
  imageUrl,
  pads,
  onChange,
  disabled,
  onImageLoad,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [hostSize, setHostSize] = useState({ w: 0, h: 0 });
  const dragRef = useRef<{
    edge: EdgeKey;
    x: number;
    y: number;
    pads: ExpandPads;
    boxW: number;
    boxH: number;
  } | null>(null);

  useEffect(() => {
    setNatural(null);
  }, [imageUrl]);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setHostSize({ w: r.width, h: r.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      e.preventDefault();
      const layout0 = padLayout(d.pads);
      const imgDispW = (d.boxW * layout0.widthPct) / 100;
      const imgDispH = (d.boxH * layout0.heightPct) / 100;
      if (imgDispW < 8 || imgDispH < 8) return;

      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      let { left, right, top, bottom } = d.pads;
      const edge = d.edge;

      if (edge.includes('w')) left = d.pads.left - dx / imgDispW;
      if (edge.includes('e')) right = d.pads.right + dx / imgDispW;
      if (edge.includes('n')) top = d.pads.top - dy / imgDispH;
      if (edge.includes('s')) bottom = d.pads.bottom + dy / imgDispH;

      onChangeRef.current(clampPads({ left, right, top, bottom }));
    };
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, []);

  const onPointerDown = useCallback(
    (edge: EdgeKey, e: React.PointerEvent) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      const el = stageRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      dragRef.current = {
        edge,
        x: e.clientX,
        y: e.clientY,
        pads: { ...pads },
        boxW: rect.width,
        boxH: rect.height,
      };
    },
    [disabled, pads],
  );

  const layout = padLayout(pads);

  // 合成画布宽高比 = 原图比例 × 边距扩展（与 buildGreenScreenCanvas 一致）
  const stageAspect = useMemo(() => {
    if (!natural?.w || !natural?.h) return null;
    return (natural.w * layout.totalW) / (natural.h * layout.totalH);
  }, [natural, layout.totalW, layout.totalH]);

  const stagePx = useMemo(() => {
    if (!stageAspect) return null;
    return fitBox(hostSize.w, hostSize.h, stageAspect);
  }, [hostSize.w, hostSize.h, stageAspect]);

  return (
    <div
      ref={hostRef}
      className="nodrag nowheel relative flex h-full w-full items-center justify-center select-none touch-none bg-zinc-950/40"
    >
      <div
        ref={stageRef}
        className="relative overflow-hidden shadow-sm"
        style={{
          backgroundColor: GREEN_SCREEN_HEX,
          width: stagePx ? `${stagePx.w}px` : '100%',
          height: stagePx ? `${stagePx.h}px` : '100%',
        }}
      >
        {/* 源图框比例 = 原图比例，不使用 object-cover 裁切 */}
        <div
          className="absolute overflow-hidden ring-1 ring-white/80"
          style={{
            left: `${layout.leftPct}%`,
            top: `${layout.topPct}%`,
            width: `${layout.widthPct}%`,
            height: `${layout.heightPct}%`,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt=""
            className="pointer-events-none block h-full w-full object-contain"
            draggable={false}
            onLoad={(e) => {
              const img = e.currentTarget;
              const w = img.naturalWidth;
              const h = img.naturalHeight;
              if (w && h) {
                setNatural({ w, h });
                onImageLoad?.(w, h);
              }
            }}
          />
        </div>

        <div className="pointer-events-none absolute inset-1 rounded-sm border-2 border-dashed border-white/90" />

        {HANDLE.map((h) => (
          <div
            key={h.key}
            role="slider"
            aria-label={`扩边 ${h.key}`}
            className={`absolute z-10 rounded-sm border border-zinc-800/40 bg-white shadow-sm ${h.className} ${
              disabled ? 'pointer-events-none opacity-40' : 'pointer-events-auto'
            }`}
            style={{ cursor: h.cursor }}
            onPointerDown={(e) => onPointerDown(h.key, e)}
          />
        ))}
      </div>
    </div>
  );
}
