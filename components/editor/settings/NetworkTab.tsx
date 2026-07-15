'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  getUsage,
  resetUsage,
  subscribeUsage,
  type UsageStats,
} from '../../../lib/usageStore';

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 10_000) return `${(n / 1000).toFixed(1)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(2)}k`;
  return String(n);
}

function StatCard({
  title,
  value,
  desc,
  icon,
}: {
  title: string;
  value: string;
  desc: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/40 p-5 bg-card">
      <div className="flex items-center gap-4">
        <div className="size-12 rounded-xl bg-muted/50 text-foreground flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{title}</p>
          <p className="mt-1 text-2xl font-bold text-foreground tabular-nums truncate">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
        </div>
      </div>
    </div>
  );
}

export function NetworkTab() {
  const [usage, setUsage] = useState<UsageStats>(() => getUsage());

  useEffect(() => {
    setUsage(getUsage());
    return subscribeUsage(setUsage);
  }, []);

  const onReset = () => {
    if (!confirm('确定清空本地调用统计？此操作不可恢复。')) return;
    setUsage(resetUsage());
  };

  return (
    <div className="space-y-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">调用统计</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            仅统计本机调用：文本累计 token，图片/视频/音频累计次数。不计费、无余额。
          </p>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="shrink-0 px-3 py-1.5 rounded-lg text-xs border border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
        >
          清空统计
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="文本 Token"
          value={formatTokens(usage.textTokens)}
          desc={`累计 ${usage.textTokens.toLocaleString()} · ${usage.textCalls} 次调用`}
          icon={<span className="text-lg font-bold">T</span>}
        />
        <StatCard
          title="文本调用"
          value={String(usage.textCalls)}
          desc="成功完成的文本生成次数"
          icon={<span className="text-sm font-medium">次</span>}
        />
        <StatCard
          title="图片调用"
          value={String(usage.imageCalls)}
          desc="图片生成提交次数"
          icon={<span className="text-lg">▧</span>}
        />
        <StatCard
          title="视频调用"
          value={String(usage.videoCalls)}
          desc="视频生成提交次数"
          icon={<span className="text-lg">▷</span>}
        />
        <StatCard
          title="音频调用"
          value={String(usage.audioCalls)}
          desc="TTS / 音乐生成提交次数"
          icon={<span className="text-lg">♪</span>}
        />
      </div>

      <div className="rounded-xl border border-border/40 p-5 bg-card">
        <p className="text-xs text-muted-foreground leading-relaxed">
          数据保存在浏览器 localStorage（键 reelvas.usage.v1）。文本优先使用接口返回的
          usage.total_tokens；若流式响应未带 usage，则按字符数粗估。图片/视频/音频在节点提交时 +1。
          {usage.updatedAt > 0 ? (
            <>
              {' '}
              最近更新：{new Date(usage.updatedAt).toLocaleString()}
            </>
          ) : null}
        </p>
      </div>
    </div>
  );
}
