// 图生图参考图：公网图床设置（localStorage）

import { createLogger } from './logger';

const log = createLogger('imageHostSettings');

const KEY = 'reelvas_image_host_v1';

export type ImageHostProvider = 'remit.ee';

export type ImageHostSettings = {
  /** 开启后：参考图先上传图床，再向模型提交公网 URL（更稳、可不压缩） */
  enabled: boolean;
  provider: ImageHostProvider;
};

const DEFAULTS: ImageHostSettings = {
  enabled: true,
  provider: 'remit.ee',
};

export function loadImageHostSettings(): ImageHostSettings {
  if (typeof window === 'undefined') return { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const p = JSON.parse(raw) as Partial<ImageHostSettings>;
    return {
      enabled: p.enabled !== false,
      provider: p.provider === 'remit.ee' ? 'remit.ee' : 'remit.ee',
    };
  } catch (err) {
    log.warn('loadImageHostSettings', 'parse fail', {
      msg: err instanceof Error ? err.message : String(err),
    });
    return { ...DEFAULTS };
  }
}

export function saveImageHostSettings(next: ImageHostSettings): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent('reelvas-image-host', { detail: next }));
  log.info('saveImageHostSettings', 'ok', {
    enabled: next.enabled,
    provider: next.provider,
  });
}

export function subscribeImageHostSettings(
  cb: (s: ImageHostSettings) => void,
): () => void {
  if (typeof window === 'undefined') return () => {};
  const onCustom = (e: Event) => {
    const d = (e as CustomEvent<ImageHostSettings>).detail;
    cb(d || loadImageHostSettings());
  };
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) cb(loadImageHostSettings());
  };
  window.addEventListener('reelvas-image-host', onCustom);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener('reelvas-image-host', onCustom);
    window.removeEventListener('storage', onStorage);
  };
}
