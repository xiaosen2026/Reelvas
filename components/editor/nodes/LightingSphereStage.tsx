'use client';

// 打光球形预览：线框球 + 中心源图 + 球面主光/光锥（精简版）

import { useCallback, useRef } from 'react';
import { ImageIcon } from 'lucide-react';

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

const STAGE = 220;
const CX = STAGE / 2;
const CY = STAGE / 2;
const R = 92;
const CARD = 78;

export function LightingSphereStage({
  previewUrl,
  orbit,
  elev,
  color,
  intensity,
  coneAngle = 45,
  onOrbit,
  onElev,
}: {
  previewUrl?: string;
  orbit: number;
  elev: number;
  color: string;
  intensity: number;
  coneAngle?: number;
  onOrbit: (n: number) => void;
  onElev: (n: number) => void;
}) {
  const dragRef = useRef<{ x: number; y: number; orbit: number; elev: number } | null>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = { x: e.clientX, y: e.clientY, orbit, elev };
    },
    [orbit, elev],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const d = dragRef.current;
      if (!d) return;
      onOrbit(clamp(d.orbit + (e.clientX - d.x) * 0.75, -180, 180));
      onElev(clamp(d.elev - (e.clientY - d.y) * 0.55, -89, 89));
    },
    [onOrbit, onElev],
  );

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }, []);

  const radO = (orbit * Math.PI) / 180;
  const radE = (elev * Math.PI) / 180;
  const nx = Math.sin(radO) * Math.cos(radE);
  const ny = -Math.sin(radE);
  const nz = Math.cos(radO) * Math.cos(radE);
  const lx = CX + nx * R;
  const ly = CY + ny * R;
  const glow = Math.max(0.15, intensity / 100);
  const front = nz >= 0;

  const toCenter = Math.hypot(CX - lx, CY - ly) || 1;
  const ux = (CX - lx) / toCenter;
  const uy = (CY - ly) / toCenter;
  const px = -uy;
  const py = ux;
  const angleDeg = clamp(coneAngle, 10, 120);
  const halfRad = ((angleDeg / 2) * Math.PI) / 180;
  const tipW = 2.5 + (angleDeg / 120) * 4;
  const reach = Math.min(toCenter * 0.94, R * 0.98);
  const baseW = Math.tan(halfRad) * reach * 0.9;
  const cone = [
    [lx + px * tipW, ly + py * tipW],
    [lx + ux * reach + px * baseW, ly + uy * reach + py * baseW],
    [lx + ux * reach - px * baseW, ly + uy * reach - py * baseW],
    [lx - px * tipW, ly - py * tipW],
  ]
    .map((p) => p.join(','))
    .join(' ');

  const cssAngle = (Math.atan2(lx - CX, CY - ly) * 180) / Math.PI;
  const focus = 1 - (angleDeg - 10) / 110;
  const tint = Math.round(30 + glow * 50 + focus * 10);
  const cardLightX = 50 + nx * 40;
  const cardLightY = 50 + ny * 40;
  const coneOpacity = (front ? 0.32 + glow * 0.35 : 0.12) * (0.8 + focus * 0.3);

  return (
    <div
      className="relative rounded-xl overflow-hidden select-none touch-none cursor-grab active:cursor-grabbing border border-border/40"
      style={{
        width: STAGE,
        height: STAGE,
        background: 'radial-gradient(circle at 50% 40%, #2a2a2e 0%, #121214 70%, #0a0a0b 100%)',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <svg width={STAGE} height={STAGE} className="absolute inset-0 pointer-events-none" aria-hidden>
        <circle cx={CX} cy={CY} r={R} fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.22)" strokeWidth={1.1} />
        {/* 少量经纬线，避免过密 */}
        {[0, 45, 90].map((deg) => {
          const a = (deg * Math.PI) / 180;
          const rx = Math.abs(Math.cos(a)) * R;
          if (rx < 2) {
            return (
              <line key={`m-${deg}`} x1={CX} y1={CY - R} x2={CX} y2={CY + R} stroke="rgba(255,255,255,0.14)" strokeWidth={1} />
            );
          }
          return (
            <ellipse key={`m-${deg}`} cx={CX} cy={CY} rx={rx} ry={R} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={1} />
          );
        })}
        {[-30, 0, 30].map((lat) => {
          const a = (lat * Math.PI) / 180;
          const yy = CY - Math.sin(a) * R;
          const rr = Math.cos(a) * R;
          return (
            <ellipse
              key={`lat-${lat}`}
              cx={CX}
              cy={yy}
              rx={Math.abs(rr)}
              ry={Math.max(2, Math.abs(rr) * 0.26)}
              fill="none"
              stroke="rgba(255,255,255,0.12)"
              strokeWidth={1}
            />
          );
        })}

        <polygon points={cone} fill={color} opacity={coneOpacity} />
        <polygon points={cone} fill="none" stroke={color} strokeOpacity={front ? 0.5 : 0.18} strokeWidth={1} />

        <circle
          cx={lx}
          cy={ly}
          r={front ? 8 : 6}
          fill="#0a0a0a"
          stroke={color}
          strokeWidth={1.4}
          opacity={front ? 1 : 0.4}
          style={{ filter: `drop-shadow(0 0 ${6 + glow * 10}px ${color})` }}
        />
      </svg>

      <div
        className="absolute overflow-hidden rounded-md pointer-events-none"
        style={{
          width: CARD,
          height: CARD,
          left: CX - CARD / 2,
          top: CY - CARD / 2,
          boxShadow: `0 8px 22px rgba(0,0,0,0.5), 0 0 ${12 + glow * 18}px color-mix(in srgb, ${color} ${Math.round(30 + glow * 40)}%, transparent)`,
          border: `1px solid color-mix(in srgb, ${color} 35%, rgba(255,255,255,0.18))`,
          background: '#1a1a1c',
        }}
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="" className="block w-full h-full object-cover" draggable={false} />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-zinc-800">
            <ImageIcon className="size-6 text-zinc-500" />
          </div>
        )}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `linear-gradient(${cssAngle}deg,
              color-mix(in srgb, ${color} ${tint}%, transparent) 0%,
              transparent 55%,
              rgba(0,0,0,0.22) 100%)`,
            mixBlendMode: 'soft-light',
            opacity: front ? 0.95 : 0.5,
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(circle at ${cardLightX}% ${cardLightY}%,
              color-mix(in srgb, ${color} ${Math.round(45 + glow * 35)}%, transparent) 0%,
              transparent ${Math.round(40 + (1 - focus) * 30)}%)`,
            mixBlendMode: 'plus-lighter',
            opacity: front ? 0.55 + glow * 0.25 : 0.2,
          }}
        />
      </div>
    </div>
  );
}
