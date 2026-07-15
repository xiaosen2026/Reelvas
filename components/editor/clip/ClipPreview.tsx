'use client';

// 剪辑预览：按时间轴当前时刻显示对应片段（视频 seek / 图片）

import { useEffect, useRef } from 'react';
import type { TimelineClip } from './clipTypes';

type Props = {
  clips: TimelineClip[];
  currentSec: number;
  playing: boolean;
};

export function ClipPreview({ clips, currentSec, playing }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const active =
    clips.find(
      (c) => currentSec >= c.startSec && currentSec < c.startSec + c.durationSec,
    ) || null;

  // 视频：seek 到素材内时间
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !active || active.kind !== 'video') return;
    const local = active.trimInSec + (currentSec - active.startSec);
    if (Math.abs(v.currentTime - local) > 0.25) {
      try {
        v.currentTime = Math.max(0, local);
      } catch {
        /* ignore */
      }
    }
    if (playing) {
      void v.play().catch(() => {});
    } else {
      v.pause();
    }
  }, [active, currentSec, playing]);

  if (!active) {
    return (
      <div className="flex size-full items-center justify-center text-white/20 text-xs">
        时间轴为空或当前位置无片段
      </div>
    );
  }

  if (active.kind === 'image') {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={active.url}
        alt={active.name}
        className="size-full object-contain bg-black"
      />
    );
  }

  if (active.kind === 'audio') {
    return (
      <div className="flex size-full flex-col items-center justify-center gap-2 bg-black text-white/50">
        <span className="text-sm">{active.name}</span>
        <span className="text-[11px] text-white/30">音频轨 · 预览听感请导出后播放</span>
        <audio src={active.url} controls className="w-4/5 max-w-sm" />
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      key={active.id}
      src={active.url}
      className="size-full object-contain bg-black"
      playsInline
      muted={false}
      preload="auto"
    />
  );
}
