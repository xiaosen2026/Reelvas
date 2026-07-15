// 图片节点摄影机预设：机身 / 镜头 / 胶片，localStorage 持久化，支持增删改

import { createLogger } from './logger';
import {
  CAMERA_BODIES,
  CAMERA_FILMS,
  CAMERA_LENSES,
  type CameraOption,
} from '../components/editor/nodes/cameraPresetData';

const log = createLogger('cameraPresetStore');
const STORAGE_KEY = 'reelvas.cameraPresets.v1';

export type CameraListKind = 'body' | 'lens' | 'film';

export type CameraLists = Record<CameraListKind, CameraOption[]>;

const KIND_LABEL: Record<CameraListKind, string> = {
  body: '机身',
  lens: '镜头',
  film: '胶片',
};

export function cameraKindLabel(kind: CameraListKind): string {
  return KIND_LABEL[kind];
}

function cloneOpts(list: CameraOption[]): CameraOption[] {
  return list.map((o) => ({ ...o }));
}

function seed(): CameraLists {
  return {
    body: cloneOpts(CAMERA_BODIES),
    lens: cloneOpts(CAMERA_LENSES),
    film: cloneOpts(CAMERA_FILMS),
  };
}

function ensureNone(list: CameraOption[]): CameraOption[] {
  const rest = list.filter((o) => o.id && o.id !== 'none');
  return [{ id: 'none', label: '不指定', prompt: '' }, ...rest];
}

function normalizeOption(raw: unknown): CameraOption | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Partial<CameraOption>;
  const id = typeof o.id === 'string' ? o.id.trim() : '';
  const label = typeof o.label === 'string' ? o.label.trim() : '';
  if (!id || !label) return null;
  return {
    id,
    label,
    prompt: typeof o.prompt === 'string' ? o.prompt.trim() : '',
    desc: typeof o.desc === 'string' && o.desc.trim() ? o.desc.trim() : undefined,
  };
}

function normalizeLists(raw: unknown): CameraLists {
  const base = seed();
  if (!raw || typeof raw !== 'object') return base;
  const o = raw as Partial<Record<CameraListKind, unknown>>;
  (['body', 'lens', 'film'] as CameraListKind[]).forEach((k) => {
    if (!Array.isArray(o[k])) return;
    const next = (o[k] as unknown[])
      .map(normalizeOption)
      .filter((x): x is CameraOption => !!x);
    if (next.length) base[k] = ensureNone(next);
  });
  return base;
}

type Listener = (lists: CameraLists) => void;
const listeners = new Set<Listener>();

function read(): CameraLists {
  if (typeof window === 'undefined') return seed();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seed();
    return normalizeLists(JSON.parse(raw));
  } catch (err) {
    log.warn('read', 'parse failed', { err: err instanceof Error ? err.message : String(err) });
    return seed();
  }
}

function write(lists: CameraLists): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lists));
  } catch (err) {
    log.warn('write', 'save failed', { err: err instanceof Error ? err.message : String(err) });
  }
  listeners.forEach((fn) => fn(lists));
}

export function getCameraLists(): CameraLists {
  return read();
}

export function listCameraOptions(kind: CameraListKind): CameraOption[] {
  return read()[kind];
}

export function findCameraOption(kind: CameraListKind, id: string): CameraOption | undefined {
  return read()[kind].find((o) => o.id === id);
}

export function setCameraList(kind: CameraListKind, options: CameraOption[]): CameraLists {
  const cur = read();
  const next: CameraLists = { ...cur, [kind]: ensureNone(options.map((o) => ({ ...o }))) };
  write(next);
  log.info('setCameraList', kind, { count: next[kind].length });
  return next;
}

export function upsertCameraOption(
  kind: CameraListKind,
  option: CameraOption,
  prevId?: string,
): CameraLists {
  const cur = read();
  const id = option.id.trim();
  const label = option.label.trim();
  if (!id || !label) {
    log.warn('upsertCameraOption', 'invalid', { kind, id, label });
    return cur;
  }
  if (id === 'none') {
    log.warn('upsertCameraOption', 'cannot overwrite none', { kind });
    return cur;
  }

  const list = cur[kind].filter((o) => o.id !== 'none');
  const targetId = (prevId || id).trim();
  const idx = list.findIndex((o) => o.id === targetId);
  const item: CameraOption = {
    id,
    label,
    prompt: option.prompt.trim(),
    desc: option.desc?.trim() || undefined,
  };

  if (list.some((o, i) => o.id === id && i !== idx)) {
    log.warn('upsertCameraOption', 'id conflict', { kind, id });
    return cur;
  }

  let nextList: CameraOption[];
  if (idx >= 0) {
    nextList = list.map((o, i) => (i === idx ? item : o));
  } else {
    nextList = [...list, item];
  }

  const next: CameraLists = { ...cur, [kind]: ensureNone(nextList) };
  write(next);
  log.info('upsertCameraOption', kind, { id, mode: idx >= 0 ? 'update' : 'add' });
  return next;
}

export function removeCameraOption(kind: CameraListKind, id: string): CameraLists {
  const cur = read();
  if (!id || id === 'none') return cur;
  const nextList = cur[kind].filter((o) => o.id !== id);
  const next: CameraLists = { ...cur, [kind]: ensureNone(nextList) };
  write(next);
  log.info('removeCameraOption', kind, { id });
  return next;
}

export function resetCameraLists(): CameraLists {
  const next = seed();
  write(next);
  log.info('resetCameraLists', 'defaults restored');
  return next;
}

export function subscribeCameraPresets(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
