'use client';

import type { ReactNode } from 'react';
import type { UsageStats } from '../../lib/usageStore';

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1000).toFixed(1)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(2)}k`.replace(/\.?0+k$/, 'k');
  return String(n);
}

const IText = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M17 6.1H3" />
    <path d="M21 12.1H3" />
    <path d="M15.1 18H3" />
  </svg>
);
const IImage = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <circle cx="9" cy="9" r="2" />
    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
  </svg>
);
const IVideo = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5" />
    <rect x="2" y="6" width="14" height="12" rx="2" />
  </svg>
);
const IAudio = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </svg>
);

function Chip({
  icon,
  value,
  label,
}: {
  icon: ReactNode;
  value: string | number;
  label: string;
}) {
  return (
    <span
      className="inline-flex h-6 items-center gap-1 rounded-md border border-border/50 bg-muted/40 px-1.5 text-[11px] tabular-nums text-muted-foreground"
      title={label}
    >
      <span className="opacity-70">{icon}</span>
      <span className="font-medium text-foreground/80">{value}</span>
    </span>
  );
}

/** 顶栏本地调用统计：胶囊分组，无表情 */
export function UsageBadge({ usage }: { usage: UsageStats }) {
  const title = [
    `文本 ${usage.textTokens} token / ${usage.textCalls} 次`,
    `图片 ${usage.imageCalls} 次`,
    `视频 ${usage.videoCalls} 次`,
    `音频 ${usage.audioCalls} 次`,
  ].join(' · ');

  return (
    <div
      className="mr-1.5 hidden items-center gap-1 sm:flex"
      title={`本地调用统计（不计费）\n${title}`}
      aria-label={title}
    >
      <Chip icon={<IText />} value={formatTokens(usage.textTokens)} label={`文本 ${usage.textTokens} token`} />
      <Chip icon={<IImage />} value={usage.imageCalls} label={`图片 ${usage.imageCalls} 次`} />
      <Chip icon={<IVideo />} value={usage.videoCalls} label={`视频 ${usage.videoCalls} 次`} />
      <Chip icon={<IAudio />} value={usage.audioCalls} label={`音频 ${usage.audioCalls} 次`} />
    </div>
  );
}
