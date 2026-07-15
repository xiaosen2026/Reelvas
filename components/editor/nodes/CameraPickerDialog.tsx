'use client';

// 摄影机选择：贴在按钮上方的 3 列时钟滚轮（机身 / 镜头 / 胶片）

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getRuntimeCameraLists,
  normalizeCameraPick,
  type CameraOption,
  type CameraPick,
} from './cameraPresets';
import {
  getCameraLists,
  subscribeCameraPresets,
  type CameraLists,
} from '../../../lib/cameraPresetStore';
import { createLogger } from '../../../lib/logger';

const log = createLogger('CameraPickerDialog');

const ITEM_H = 34;
const VIEW_H = ITEM_H * 3;
const PAD_H = ITEM_H;

type Props = {
  open: boolean;
  value: CameraPick;
  onClose: () => void;
  onApply: (next: CameraPick) => void;
};

function idxOf(options: CameraOption[], id: string) {
  const i = options.findIndex((o) => o.id === id);
  return i >= 0 ? i : 0;
}

function WheelColumn({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: CameraOption[];
  value: string;
  onChange: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const lock = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const go = useCallback((i: number, smooth: boolean) => {
    const el = ref.current;
    if (!el) return;
    const top = Math.max(0, i) * ITEM_H;
    if (smooth) el.scrollTo({ top, behavior: 'smooth' });
    else el.scrollTop = top;
  }, []);

  useEffect(() => {
    lock.current = true;
    go(idxOf(options, value), false);
    const t = setTimeout(() => {
      lock.current = false;
    }, 60);
    return () => clearTimeout(t);
  }, [value, options, go]);

  const snap = useCallback(() => {
    const el = ref.current;
    if (!el || lock.current) return;
    const i = Math.max(0, Math.min(options.length - 1, Math.round(el.scrollTop / ITEM_H)));
    const next = options[i];
    if (!next) return;
    lock.current = true;
    go(i, true);
    if (next.id !== value) onChange(next.id);
    setTimeout(() => {
      lock.current = false;
    }, 140);
  }, [go, onChange, options, value]);

  const schedule = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(snap, 80);
  }, [snap]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      el.scrollTop += e.deltaY;
      schedule();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [schedule]);

  const active = idxOf(options, value);

  return (
    <div className="flex-1 min-w-0 flex flex-col items-center gap-1">
      <p className="text-[10px] text-muted-foreground">{title}</p>
      <div className="relative w-full" style={{ height: VIEW_H }}>
        <div
          className="pointer-events-none absolute inset-x-0 z-10 border-y border-border/60"
          style={{ top: ITEM_H, height: ITEM_H }}
        />
        <div
          ref={ref}
          onScroll={schedule}
          className="nowheel nodrag h-full overflow-y-auto overscroll-contain"
          style={{
            scrollSnapType: 'y mandatory',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          <div style={{ height: PAD_H }} aria-hidden />
          {options.map((o, i) => {
            const on = i === active;
            return (
              <button
                key={o.id}
                type="button"
                title={o.desc || o.label}
                onClick={() => {
                  onChange(o.id);
                  go(i, true);
                }}
                className={`w-full flex items-center justify-center px-1 transition-opacity ${
                  on ? 'text-foreground' : 'text-muted-foreground'
                }`}
                style={{
                  height: ITEM_H,
                  scrollSnapAlign: 'center',
                  opacity: on ? 1 : 0.35,
                }}
              >
                <span
                  className={`truncate max-w-full leading-none ${
                    on ? 'text-[12px] font-medium' : 'text-[11px]'
                  }`}
                >
                  {o.label}
                </span>
              </button>
            );
          })}
          <div style={{ height: PAD_H }} aria-hidden />
        </div>
      </div>
    </div>
  );
}

/** 锚定在父级 relative 容器内，紧贴按钮上方 */
export function CameraPickerDialog({ open, value, onClose, onApply }: Props) {
  const [draft, setDraft] = useState<CameraPick>(() => normalizeCameraPick(value));
  const [lists, setLists] = useState<CameraLists>(() => getCameraLists());
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLists(getCameraLists());
    return subscribeCameraPresets(setLists);
  }, []);

  useEffect(() => {
    if (open) {
      setLists(getCameraLists());
      setDraft(normalizeCameraPick(value));
    }
  }, [open, value]);

  // 点外部关闭（忽略触发按钮，避免与 toggle 打架）
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      if (rootRef.current?.contains(t)) return;
      if (t.closest?.('[data-camera-trigger]')) return;
      log.info('onClose', 'outside');
      onClose();
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, onClose]);

  if (!open) return null;

  const bodies = lists.body.length ? lists.body : getRuntimeCameraLists().bodies;
  const lenses = lists.lens.length ? lists.lens : getRuntimeCameraLists().lenses;
  const films = lists.film.length ? lists.film : getRuntimeCameraLists().films;

  const patch = (partial: Partial<CameraPick>) => {
    setDraft((d) => {
      const next = normalizeCameraPick({ ...d, ...partial });
      onApply(next);
      return next;
    });
  };

  return (
    <div
      ref={rootRef}
      className="absolute bottom-full right-0 mb-1 z-50 w-72 rounded-xl bg-card border border-border shadow-sm p-2 nodrag nowheel"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-stretch">
        <WheelColumn
          title="机身"
          options={bodies}
          value={draft.body}
          onChange={(body) => patch({ body })}
        />
        <div className="w-px my-4 bg-border/40" />
        <WheelColumn
          title="镜头"
          options={lenses}
          value={draft.lens}
          onChange={(lens) => patch({ lens })}
        />
        <div className="w-px my-4 bg-border/40" />
        <WheelColumn
          title="胶片"
          options={films}
          value={draft.film}
          onChange={(film) => patch({ film })}
        />
      </div>
      <div className="flex items-center justify-between pt-1.5 px-0.5">
        <button
          type="button"
          onClick={() => patch({ body: 'none', lens: 'none', film: 'none' })}
          className="h-6 px-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          清空
        </button>
        <button
          type="button"
          onClick={() => {
            const next = normalizeCameraPick(draft);
            log.info('onApply', 'done', next);
            onApply(next);
            onClose();
          }}
          className="h-6 px-2 text-[11px] font-medium text-foreground hover:opacity-80 transition-opacity"
        >
          完成
        </button>
      </div>
    </div>
  );
}
