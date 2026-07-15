'use client';

// 打光面板：左球形预览 · 右精简控件

import { useCallback } from 'react';
import { Send } from 'lucide-react';
import type { LightDirection } from './imageToolMenus';
import { LightingSphereStage } from './LightingSphereStage';

export function directionToOrbitElev(d: LightDirection): { orbit: number; elev: number } {
  switch (d) {
    case 'left':
      return { orbit: -90, elev: 15 };
    case 'right':
      return { orbit: 90, elev: 15 };
    case 'top':
      return { orbit: 0, elev: 75 };
    case 'bottom':
      return { orbit: 0, elev: -60 };
    case 'back':
      return { orbit: 180, elev: 10 };
    case 'front':
    default:
      return { orbit: 0, elev: 10 };
  }
}

export function orbitElevToDirection(orbit: number, elev: number): LightDirection {
  if (elev >= 50) return 'top';
  if (elev <= -40) return 'bottom';
  let o = ((orbit % 360) + 360) % 360;
  if (o > 180) o -= 360;
  if (o >= -45 && o < 45) return 'front';
  if (o >= 45 && o < 135) return 'right';
  if (o >= -135 && o < -45) return 'left';
  return 'back';
}

const DIRS: { id: LightDirection; label: string }[] = [
  { id: 'left', label: '左' },
  { id: 'top', label: '上' },
  { id: 'right', label: '右' },
  { id: 'front', label: '前' },
  { id: 'bottom', label: '下' },
  { id: 'back', label: '后' },
];

function SliderRow({
  label,
  value,
  unit,
  min,
  max,
  onChange,
  title,
}: {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  onChange: (n: number) => void;
  title?: string;
}) {
  return (
    <label className="block space-y-0.5" title={title}>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{label}</span>
        <span className="font-mono tabular-nums">
          {Math.round(value)}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={Math.round(value)}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-emerald-500"
      />
    </label>
  );
}

export function LightingPanel({
  intensity,
  onIntensity,
  color,
  onColor,
  orbit,
  onOrbit,
  elev,
  onElev,
  coneAngle,
  onConeAngle,
  onApply,
  previewUrl,
}: {
  intensity: number;
  onIntensity: (n: number) => void;
  color: string;
  onColor: (c: string) => void;
  orbit: number;
  onOrbit: (n: number) => void;
  elev: number;
  onElev: (n: number) => void;
  coneAngle: number;
  onConeAngle: (n: number) => void;
  onApply: () => void;
  previewUrl?: string;
}) {
  const direction = orbitElevToDirection(orbit, elev);

  const pickDir = useCallback(
    (d: LightDirection) => {
      const next = directionToOrbitElev(d);
      onOrbit(next.orbit);
      onElev(next.elev);
    },
    [onOrbit, onElev],
  );

  return (
    <div className="w-[min(520px,94vw)] p-2.5">
      <div className="flex gap-3 items-stretch">
        {/* 左：球形预览 */}
        <div className="shrink-0">
          <LightingSphereStage
            previewUrl={previewUrl}
            orbit={orbit}
            elev={elev}
            color={color}
            intensity={intensity}
            coneAngle={coneAngle}
            onOrbit={onOrbit}
            onElev={onElev}
          />
        </div>

        {/* 右：精简控件 */}
        <div className="flex-1 min-w-0 flex flex-col gap-2 py-0.5">
          <div className="grid grid-cols-6 gap-1">
            {DIRS.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => pickDir(d.id)}
                className={`h-6 rounded-md text-[10px] border transition-colors ${
                  direction === d.id
                    ? 'bg-foreground text-background border-foreground'
                    : 'border-border/50 text-muted-foreground hover:bg-muted/30'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>

          <SliderRow label="环绕" value={orbit} unit="°" min={-180} max={180} onChange={onOrbit} />
          <SliderRow label="高度" value={elev} unit="°" min={-90} max={90} onChange={onElev} />
          <SliderRow label="强度" value={intensity} unit="%" min={0} max={100} onChange={onIntensity} />
          <SliderRow
            label="夹角"
            value={coneAngle}
            unit="°"
            min={10}
            max={120}
            onChange={onConeAngle}
            title="越小越聚光，越大越散射"
          />

          <label className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span className="shrink-0">颜色</span>
            <input
              type="color"
              value={color}
              onChange={(e) => onColor(e.target.value)}
              className="size-6 rounded border border-border cursor-pointer shrink-0"
              title="灯光颜色"
            />
            <span className="font-mono tabular-nums text-foreground">{color.toUpperCase()}</span>
          </label>

          <button
            type="button"
            onClick={onApply}
            className="mt-auto h-8 w-full rounded-full bg-primary text-primary-foreground text-xs inline-flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity"
          >
            <Send className="size-3.5" />
            发送
          </button>
        </div>
      </div>
    </div>
  );
}
