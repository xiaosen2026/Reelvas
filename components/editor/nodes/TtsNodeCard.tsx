'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AudioLines, Loader2, Pause, Play, Users, Volume2 } from 'lucide-react';

function fmt(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const s = Math.floor(sec % 60);
  const m = Math.floor(sec / 60);
  return m + ':' + String(s).padStart(2, '0');
}

interface Props {
  label: string;
  selected?: boolean;
  loading: boolean;
  progress?: string;
  previewUrl: string;
  statusError?: string;
  mode: 'normal' | 'advanced';
  lineCount?: number;
  freePersisted?: boolean;
}

/** TTS 节点预览卡 · 参考圆角紫调媒体卡片 */
export function TtsNodeCard({
  label,
  selected,
  loading,
  progress,
  previewUrl,
  statusError,
  mode,
  lineCount,
  freePersisted,
}: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);

  useEffect(() => {
    setPlaying(false);
    setCur(0);
    setDur(0);
  }, [previewUrl]);

  const toggle = useCallback(() => {
    const el = audioRef.current;
    if (!el || !previewUrl) return;
    if (el.paused) void el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    else {
      el.pause();
      setPlaying(false);
    }
  }, [previewUrl]);

  const onSeek = useCallback((v: number) => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = v;
    setCur(v);
  }, []);

  const sub =
    mode === 'advanced'
      ? lineCount && lineCount > 1
        ? '多人配音 · ' + lineCount + ' 句'
        : '多人配音 · 角色脚本'
      : freePersisted
        ? '文本转语音 · 可落盘'
        : '文本转语音 · 语音合成';

  return (
    <div
      className={
        'bg-card w-full h-full overflow-hidden rounded-2xl border flex flex-col cursor-move transition-[box-shadow,border-color] duration-200 ' +
        (selected
          ? 'border-foreground/30 ring-2 ring-foreground/10 shadow-sm'
          : 'border-border/80 shadow-sm hover:border-foreground/20')
      }
    >
      <div className="flex items-start gap-2.5 px-3 pt-3 pb-2">
        <div className="flex items-center justify-center size-11 shrink-0 rounded-xl bg-muted/50 text-muted-foreground">
          {loading ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <AudioLines className="size-5" />
          )}
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex items-center gap-1.5">
            <p className="text-[13px] font-semibold text-foreground truncate leading-tight">
              {label}
            </p>
          </div>
          <p className="text-[11px] text-muted-foreground truncate mt-0.5 leading-snug">
            {loading
              ? progress
                ? '合成中 ' + progress
                : '正在合成语音…'
              : statusError
                ? statusError
                : sub}
          </p>
        </div>
        <span className="shrink-0 mt-0.5 inline-flex items-center gap-0.5 rounded-full border border-border/60 bg-muted/30 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          {mode === 'advanced' ? <Users className="size-2.5" /> : <AudioLines className="size-2.5" />}
          {mode === 'advanced' ? '多人' : 'TTS'}
        </span>
      </div>

      <div className="px-3 pb-3 mt-auto">
        {previewUrl ? (
          <div className="flex items-center gap-2 rounded-full bg-muted/60 px-2 py-1.5 border border-border/60">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggle();
              }}
              className="flex items-center justify-center size-7 shrink-0 rounded-full bg-foreground text-background hover:opacity-90 transition-colors"
              title={playing ? '暂停' : '播放'}
            >
              {playing ? (
                <Pause className="size-3.5 fill-current" />
              ) : (
                <Play className="size-3.5 fill-current ml-0.5" />
              )}
            </button>
            <span className="text-[10px] tabular-nums text-muted-foreground shrink-0 w-[4.5rem]">
              {fmt(cur)} / {fmt(dur)}
            </span>
            <input
              type="range"
              min={0}
              max={dur || 0}
              step={0.01}
              value={Math.min(cur, dur || 0)}
              onChange={(e) => onSeek(Number(e.target.value))}
              onClick={(e) => e.stopPropagation()}
              className="tts-seek flex-1 min-w-0 h-1 appearance-none bg-border rounded-full accent-foreground cursor-pointer"
            />
            <Volume2 className="size-3.5 shrink-0 text-muted-foreground/60" />
            <audio
              ref={audioRef}
              src={previewUrl}
              preload="metadata"
              onTimeUpdate={() => {
                const el = audioRef.current;
                if (el) setCur(el.currentTime);
              }}
              onLoadedMetadata={() => {
                const el = audioRef.current;
                if (el) setDur(el.duration || 0);
              }}
              onEnded={() => {
                setPlaying(false);
                setCur(0);
              }}
              onPause={() => setPlaying(false)}
              onPlay={() => setPlaying(true)}
              className="hidden"
            />
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-full bg-muted/60 px-2.5 py-2 border border-border/60">
            <div className="flex items-center justify-center size-7 rounded-full bg-muted/50 text-muted-foreground/50">
              <Play className="size-3.5 ml-0.5 opacity-40" />
            </div>
            <div className="flex-1 h-1 rounded-full bg-border" />
            <span className="text-[10px] text-muted-foreground tabular-nums">0:00</span>
          </div>
        )}
        {statusError && previewUrl ? (
          <p className="text-[10px] text-red-500 line-clamp-1 mt-1.5 px-0.5">{statusError}</p>
        ) : null}
      </div>
    </div>
  );
}
