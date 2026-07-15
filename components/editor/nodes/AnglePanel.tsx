'use client';

// 图片节点「角度」面板：3D 方块拖拽 + 旋转/倾斜/缩放 → 发送出图

import { useCallback, useRef } from 'react';
import { ImageIcon, Send } from 'lucide-react';

export type AngleParams = {
  /** 水平旋转 yaw，0–360 */
  rotate: number;
  /** 俯仰倾斜 pitch，-90–90 */
  tilt: number;
  /** 镜头缩放 1–10，默认 5 */
  zoom: number;
};

type Props = {
  params: AngleParams;
  onChange: (next: AngleParams) => void;
  onSend: () => void;
  previewUrl?: string;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function wrap360(n: number) {
  const x = n % 360;
  return x < 0 ? x + 360 : x;
}

export function AnglePanel({ params, onChange, onSend, previewUrl }: Props) {
  const dragRef = useRef<{ x: number; y: number; rotate: number; tilt: number } | null>(null);

  const setField = useCallback(
    (patch: Partial<AngleParams>) => {
      onChange({
        rotate: patch.rotate !== undefined ? wrap360(patch.rotate) : params.rotate,
        tilt: patch.tilt !== undefined ? clamp(patch.tilt, -90, 90) : params.tilt,
        zoom: patch.zoom !== undefined ? clamp(patch.zoom, 1, 10) : params.zoom,
      });
    },
    [onChange, params],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = {
        x: e.clientX,
        y: e.clientY,
        rotate: params.rotate,
        tilt: params.tilt,
      };
    },
    [params.rotate, params.tilt],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      setField({
        rotate: d.rotate + dx * 0.6,
        tilt: d.tilt - dy * 0.4,
      });
    },
    [setField],
  );

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }, []);

  /** 骰子边长固定，缩放只推近/拉远镜头，不改立方体比例 */
  const SIZE = 64;
  const HALF = SIZE / 2;
  /** zoom 1→远 / 5→中 / 10→近，translateZ 越大视觉上越近 */
  const camZ = (params.zoom - 5) * 14;

  const faceBase: React.CSSProperties = {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    left: 0,
    top: 0,
    borderRadius: 8,
    border: '1px solid color-mix(in oklab, var(--border) 75%, transparent)',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backfaceVisibility: 'hidden',
    boxSizing: 'border-box',
  };

  /** 侧/背/上下面：素色 + 方向字（正面贴图，不显示「前」） */
  const sideFace = (label: string, bg: string, transform: string) => (
    <div
      key={label}
      style={{
        ...faceBase,
        background: bg,
        transform,
      }}
    >
      <span className="text-sm font-semibold text-muted-foreground/90 select-none">{label}</span>
    </div>
  );

  return (
    <div className="p-3 space-y-3 w-[min(420px,90vw)]">
      <p className="text-[11px] text-muted-foreground">拖拽方块调整角度</p>

      <div className="grid grid-cols-[148px_1fr] gap-3 items-start">
        <div
          className="relative size-36 shrink-0 rounded-xl border border-border/40 bg-muted/15 overflow-hidden flex items-center justify-center select-none touch-none cursor-grab active:cursor-grabbing"
          style={{ perspective: 520, perspectiveOrigin: '50% 50%' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {/* 镜头层：仅 Z 轴推近/拉远，保持正方体比例 */}
          <div
            className="relative"
            style={{
              width: SIZE,
              height: SIZE,
              transformStyle: 'preserve-3d',
              transform: `translateZ(${camZ}px)`,
              transition: dragRef.current ? undefined : 'transform 80ms linear',
            }}
          >
            <div
              className="relative"
              style={{
                width: SIZE,
                height: SIZE,
                transformStyle: 'preserve-3d',
                transform: `rotateX(${params.tilt}deg) rotateY(${params.rotate}deg)`,
                transition: dragRef.current ? undefined : 'transform 80ms linear',
              }}
            >
              {/* 仅正面贴图，其余面素色（骰子） */}
              <div
                style={{
                  ...faceBase,
                  background: 'color-mix(in oklab, var(--muted) 35%, #fff 5%)',
                  transform: `translateZ(${HALF}px)`,
                }}
              >
                {previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewUrl}
                    alt=""
                    className="w-full h-full object-cover pointer-events-none"
                    draggable={false}
                  />
                ) : (
                  <ImageIcon className="size-6 text-muted-foreground/70" />
                )}
              </div>
              {sideFace('后', 'color-mix(in oklab, var(--muted) 88%, #000 10%)', `rotateY(180deg) translateZ(${HALF}px)`)}
              {sideFace('右', 'color-mix(in oklab, var(--muted) 78%, #000 14%)', `rotateY(90deg) translateZ(${HALF}px)`)}
              {sideFace('左', 'color-mix(in oklab, var(--muted) 72%, #000 12%)', `rotateY(-90deg) translateZ(${HALF}px)`)}
              {sideFace('上', 'color-mix(in oklab, var(--muted) 68%, #fff 10%)', `rotateX(90deg) translateZ(${HALF}px)`)}
              {sideFace('下', 'color-mix(in oklab, var(--muted) 82%, #000 16%)', `rotateX(-90deg) translateZ(${HALF}px)`)}
            </div>
          </div>
        </div>

        <div className="space-y-3 min-w-0 pt-0.5">
          <label className="block space-y-1">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>旋转</span>
              <span className="font-mono tabular-nums">{Math.round(params.rotate)}°</span>
            </div>
            <input
              type="range"
              min={0}
              max={360}
              value={Math.round(params.rotate)}
              onChange={(e) => setField({ rotate: Number(e.target.value) })}
              className="w-full accent-emerald-500"
            />
          </label>
          <label className="block space-y-1">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>倾斜</span>
              <span className="font-mono tabular-nums">{Math.round(params.tilt)}°</span>
            </div>
            <input
              type="range"
              min={-90}
              max={90}
              value={Math.round(params.tilt)}
              onChange={(e) => setField({ tilt: Number(e.target.value) })}
              className="w-full accent-emerald-500"
            />
          </label>
          <label className="block space-y-1">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>缩放</span>
              <span className="font-mono tabular-nums">{params.zoom.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              step={0.05}
              value={params.zoom}
              onChange={(e) => setField({ zoom: Number(e.target.value) })}
              className="w-full accent-emerald-500"
            />
          </label>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onSend}
          className="h-8 px-3 rounded-full bg-primary text-primary-foreground text-xs inline-flex items-center gap-1.5 hover:opacity-90 transition-opacity"
        >
          <Send className="size-3.5" />
          发送
        </button>
      </div>
    </div>
  );
}
