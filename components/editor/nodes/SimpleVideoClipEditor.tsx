'use client';

// 视频简单剪辑：前后裁剪 + 旋转预览/导出（浏览器 MediaRecorder，输出 webm）

import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Play, Pause, RotateCw, Check } from 'lucide-react';
import { createLogger } from '@/lib/logger';

const log = createLogger('SimpleVideoClipEditor');

type Props = {
  videoUrl: string;
  onClose: () => void;
  /** 导出成功：blob + 建议文件名 */
  onExport: (blob: Blob, fileName: string) => void;
};

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function SimpleVideoClipEditor({ videoUrl, onClose, onExport }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState(0);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [rotate, setRotate] = useState(0); // 0 | 90 | 180 | 270
  const [playing, setPlaying] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onMeta = () => {
      const d = v.duration;
      if (!Number.isFinite(d) || d <= 0) return;
      setDuration(d);
      setStart(0);
      setEnd(d);
      log.info('onMeta', 'duration', { d });
    };
    v.addEventListener('loadedmetadata', onMeta);
    if (v.readyState >= 1) onMeta();
    return () => v.removeEventListener('loadedmetadata', onMeta);
  }, [videoUrl]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      if (v.currentTime < start || v.currentTime >= end) v.currentTime = start;
      void v.play();
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  }, [start, end]);

  // 播放时限制在 [start, end]
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => {
      if (v.currentTime >= end - 0.05) {
        v.pause();
        v.currentTime = end;
        setPlaying(false);
      }
    };
    v.addEventListener('timeupdate', onTime);
    return () => v.removeEventListener('timeupdate', onTime);
  }, [end]);

  const onRotate = () => setRotate((r) => (r + 90) % 360);

  const onConfirm = useCallback(async () => {
    const v = videoRef.current;
    if (!v || duration <= 0) return;
    if (end - start < 0.2) {
      setErr('裁剪区间至少 0.2 秒');
      return;
    }
    setErr('');
    setExporting(true);
    log.info('onConfirm', 'export start', { start, end, rotate });

    try {
      const blob = await exportClip(v, start, end, rotate);
      const name = `clip-r${rotate}-${Math.round(start * 10)}-${Math.round(end * 10)}.webm`;
      onExport(blob, name);
      log.info('onConfirm', 'export ok', { bytes: blob.size, name });
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErr(msg);
      log.error('onConfirm', 'export fail', { msg });
    } finally {
      setExporting(false);
    }
  }, [duration, start, end, rotate, onExport, onClose]);

  const rotStyle =
    rotate === 90 || rotate === 270
      ? { transform: `rotate(${rotate}deg) scale(0.72)` }
      : { transform: `rotate(${rotate}deg)` };

  return (
    <div
      className="fixed inset-0 z-[10040] flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-[min(720px,94vw)] rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 h-12 border-b border-border/40">
          <span className="text-sm font-semibold text-foreground">简单剪辑</span>
          <button
            type="button"
            onClick={onClose}
            className="size-8 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted/40"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="relative flex items-center justify-center h-56 rounded-xl bg-black overflow-hidden">
            <video
              ref={videoRef}
              src={videoUrl}
              className="max-h-full max-w-full object-contain transition-transform"
              style={rotStyle}
              playsInline
              muted={false}
              preload="metadata"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={togglePlay}
              className="h-8 px-3 rounded-lg border border-border text-xs flex items-center gap-1 hover:bg-muted/30"
            >
              {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
              {playing ? '暂停' : '预览'}
            </button>
            <button
              type="button"
              onClick={onRotate}
              className="h-8 px-3 rounded-lg border border-border text-xs flex items-center gap-1 hover:bg-muted/30"
            >
              <RotateCw className="size-3.5" /> 旋转 {rotate}°
            </button>
            <span className="text-[11px] text-muted-foreground ml-auto tabular-nums">
              {formatTime(start)} — {formatTime(end)} / {formatTime(duration)}
            </span>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="w-10 shrink-0">起点</span>
              <input
                type="range"
                min={0}
                max={duration || 1}
                step={0.05}
                value={start}
                onChange={(e) => {
                  const n = Math.min(Number(e.target.value), end - 0.1);
                  setStart(Math.max(0, n));
                  if (videoRef.current) videoRef.current.currentTime = Math.max(0, n);
                }}
                className="flex-1"
              />
            </label>
            <label className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="w-10 shrink-0">终点</span>
              <input
                type="range"
                min={0}
                max={duration || 1}
                step={0.05}
                value={end}
                onChange={(e) => {
                  const n = Math.max(Number(e.target.value), start + 0.1);
                  setEnd(Math.min(duration || n, n));
                }}
                className="flex-1"
              />
            </label>
          </div>

          {err ? <p className="text-[11px] text-red-500">{err}</p> : null}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 rounded-xl border border-border text-xs hover:bg-muted/30"
            >
              取消
            </button>
            <button
              type="button"
              disabled={exporting || duration <= 0}
              onClick={() => void onConfirm()}
              className="h-9 px-4 rounded-xl bg-primary text-primary-foreground text-xs flex items-center gap-1.5 disabled:opacity-40"
            >
              <Check className="size-3.5" />
              {exporting ? '导出中…' : '导出并输出'}
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            浏览器内重编码为 WebM；长视频可能较慢。旋转用画布合成。
          </p>
        </div>
      </div>
    </div>
  );
}

/** 在区间内播放并录制；有旋转时走 canvas 合成流 */
async function exportClip(
  source: HTMLVideoElement,
  start: number,
  end: number,
  rotate: number,
): Promise<Blob> {
  const w0 = source.videoWidth || 640;
  const h0 = source.videoHeight || 360;
  const swap = rotate === 90 || rotate === 270;
  const cw = swap ? h0 : w0;
  const ch = swap ? w0 : h0;

  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建画布');

  const stream = canvas.captureStream(30);
  // 尝试带上原音轨
  try {
    const vStream = (source as HTMLVideoElement & { captureStream?: () => MediaStream }).captureStream?.();
    vStream?.getAudioTracks().forEach((t) => stream.addTrack(t));
  } catch {
    /* ignore */
  }

  const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : 'video/webm';
  const chunks: BlobPart[] = [];
  const rec = new MediaRecorder(stream, { mimeType: mime });
  rec.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };

  const done = new Promise<Blob>((resolve, reject) => {
    rec.onstop = () => resolve(new Blob(chunks, { type: mime }));
    rec.onerror = () => reject(new Error('录制失败'));
  });

  source.pause();
  source.currentTime = start;
  await waitSeek(source);
  rec.start(100);

  let raf = 0;
  const draw = () => {
    ctx.save();
    ctx.clearRect(0, 0, cw, ch);
    if (rotate === 90) {
      ctx.translate(cw, 0);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(source, 0, 0, w0, h0);
    } else if (rotate === 180) {
      ctx.translate(cw, ch);
      ctx.rotate(Math.PI);
      ctx.drawImage(source, 0, 0, w0, h0);
    } else if (rotate === 270) {
      ctx.translate(0, ch);
      ctx.rotate(-Math.PI / 2);
      ctx.drawImage(source, 0, 0, w0, h0);
    } else {
      ctx.drawImage(source, 0, 0, w0, h0);
    }
    ctx.restore();
    if (!source.paused && source.currentTime < end - 0.04) {
      raf = requestAnimationFrame(draw);
    }
  };

  await source.play();
  raf = requestAnimationFrame(draw);

  await new Promise<void>((resolve) => {
    const tick = () => {
      if (source.currentTime >= end - 0.04 || source.ended || source.paused) {
        source.pause();
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    };
    tick();
  });

  cancelAnimationFrame(raf);
  // 最后一帧
  draw();
  await new Promise((r) => setTimeout(r, 80));
  rec.stop();
  stream.getTracks().forEach((t) => t.stop());
  return done;
}

function waitSeek(v: HTMLVideoElement): Promise<void> {
  return new Promise((resolve) => {
    if (v.seekable.length === 0) {
      resolve();
      return;
    }
    const onSeeked = () => {
      v.removeEventListener('seeked', onSeeked);
      resolve();
    };
    v.addEventListener('seeked', onSeeked);
  });
}
