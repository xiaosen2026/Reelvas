'use client';

// Pannellum equirect 全景：仅全屏编辑挂载；url 空则销毁

import { useCallback, useEffect, useRef } from 'react';
import { capturePannellumView } from './panoramaCapture';
import { createLogger } from '@/lib/logger';

const log = createLogger('usePanoramaViewer');

export type PanoramaViewerOpts = {
  hfov?: number;
  yaw?: number;
  pitch?: number;
};

const CSS_HREF = '/vendor/pannellum/pannellum.css';
const JS_SRC = '/vendor/pannellum/pannellum.js';

let assetsPromise: Promise<PannellumAPI | undefined> | null = null;

function loadCss(): Promise<void> {
  if (typeof document === 'undefined') return Promise.resolve();
  const existing = document.querySelector(`link[data-pannellum="1"]`) as HTMLLinkElement | null;
  if (existing) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = CSS_HREF;
    link.setAttribute('data-pannellum', '1');
    link.onload = () => resolve();
    link.onerror = () => reject(new Error('pannellum css load failed'));
    document.head.appendChild(link);
  });
}

function loadScript(): Promise<void> {
  if (typeof document === 'undefined') return Promise.resolve();
  if (window.pannellum?.viewer) return Promise.resolve();
  const existing = document.querySelector(`script[data-pannellum="1"]`) as HTMLScriptElement | null;
  if (existing) {
    return new Promise((resolve, reject) => {
      if (window.pannellum?.viewer) {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('pannellum js load failed')), {
        once: true,
      });
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = JS_SRC;
    script.async = true;
    script.setAttribute('data-pannellum', '1');
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('pannellum js load failed'));
    document.head.appendChild(script);
  });
}

function ensurePannellum(): Promise<PannellumAPI | undefined> {
  if (typeof window === 'undefined') return Promise.resolve(undefined);
  if (!assetsPromise) {
    assetsPromise = (async () => {
      await loadCss();
      await loadScript();
      return window.pannellum;
    })().catch((e) => {
      assetsPromise = null;
      const msg = e instanceof Error ? e.message : String(e);
      log.error('ensure', 'load fail', { error: msg });
      return undefined;
    });
  }
  return assetsPromise;
}

/**
 * 在 container 内渲染 equirectangular 全景（全屏交互用）。
 * url 为空时销毁 viewer。返回 captureCurrentView 供发送到画布。
 */
export function usePanoramaViewer(
  containerRef: React.RefObject<HTMLElement | null>,
  url: string,
  opts: PanoramaViewerOpts = {},
) {
  const viewerRef = useRef<PannellumViewer | null>(null);
  const { hfov = 100, yaw, pitch } = opts;

  const captureCurrentView = useCallback((): string | null => {
    return capturePannellumView(viewerRef.current);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const el = containerRef.current;

    function destroy() {
      if (viewerRef.current) {
        try {
          viewerRef.current.destroy();
        } catch {
          /* ignore */
        }
        viewerRef.current = null;
      }
      if (el) el.innerHTML = '';
    }

    if (!el || !url) {
      destroy();
      return;
    }

    void (async () => {
      const api = await ensurePannellum();
      if (cancelled) return;
      if (!api?.viewer) {
        log.warn('mount', 'pannellum 未就绪');
        return;
      }

      destroy();
      if (cancelled || !containerRef.current) return;

      try {
        const config: PannellumConfig = {
          type: 'equirectangular',
          panorama: url,
          autoLoad: true,
          showControls: false,
          mouseZoom: true,
          draggable: true,
          compass: false,
          hfov,
          autoRotate: 0,
          keyboardZoom: false,
          crossOrigin: 'anonymous',
        };
        if (typeof yaw === 'number') config.yaw = yaw;
        if (typeof pitch === 'number') config.pitch = pitch;

        viewerRef.current = api.viewer(containerRef.current, config);
        log.debug('mount', 'ok', { url: url.slice(0, 64) });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        log.error('mount', 'fail', { error: msg });
      }
    })();

    return () => {
      cancelled = true;
      destroy();
    };
  }, [containerRef, url, hfov, yaw, pitch]);

  return { captureCurrentView };
}
