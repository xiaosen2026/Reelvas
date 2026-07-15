'use client';

// 点阵背景 —— 自研 Background（Dots 变体）
// 随视口平移/缩放同步移动，用 SVG pattern 实现无限点阵

interface BackgroundProps {
  gap?: number;
  size?: number;
  color?: string;
  offsetX: number;
  offsetY: number;
  zoom: number;
}

export function Background({ gap = 20, size = 1, color = 'var(--canvas-dots)', offsetX, offsetY, zoom }: BackgroundProps) {
  const scaledGap = gap * zoom;
  const scaledSize = size * zoom;

  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
      <defs>
        <pattern
          id="flow-dots"
          x={offsetX}
          y={offsetY}
          width={scaledGap}
          height={scaledGap}
          patternUnits="userSpaceOnUse"
        >
          <circle cx={scaledSize} cy={scaledSize} r={scaledSize} fill={color} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#flow-dots)" />
    </svg>
  );
}
