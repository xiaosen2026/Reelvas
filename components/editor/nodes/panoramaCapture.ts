// 从 Pannellum viewer 导出当前视角 PNG dataURL（优先 renderer.render returnImage）
// 注意：renderer.render 的 pitch/yaw/hfov 单位是弧度（官方 viewer 内部 * Math.PI/180）

import { createLogger } from '@/lib/logger';

const log = createLogger('panoramaCapture');

const DEG2RAD = Math.PI / 180;

/**
 * 程序化截取当前视角。
 * getPitch/getYaw/getHfov 为角度；renderer.render 必须传弧度。
 * 误把角度当弧度传入会导致近乎全黑帧。跨域无 CORS 时 toDataURL 抛错 → null。
 */
export function capturePannellumView(viewer: PannellumViewer | null | undefined): string | null {
  if (!viewer) {
    log.warn('capture', 'viewer 为空');
    return null;
  }
  try {
    const pitchDeg = typeof viewer.getPitch === 'function' ? viewer.getPitch() : 0;
    const yawDeg = typeof viewer.getYaw === 'function' ? viewer.getYaw() : 0;
    const hfovDeg = typeof viewer.getHfov === 'function' ? viewer.getHfov() : 100;
    const renderer = viewer.getRenderer?.();
    if (!renderer || typeof renderer.render !== 'function') {
      log.warn('capture', '无 getRenderer/render');
      return null;
    }

    // 官方 viewer 内部：render(pitch*π/180, yaw*π/180, hfov*π/180, {returnImage:true})
    const img = renderer.render(pitchDeg * DEG2RAD, yawDeg * DEG2RAD, hfovDeg * DEG2RAD, {
      returnImage: true,
    });
    if (typeof img === 'string' && img.startsWith('data:image')) {
      if (img.length < 1200) {
        log.warn('capture', 'dataURL 过短，疑似空帧', {
          bytes: img.length,
          pitchDeg,
          yawDeg,
          hfovDeg,
        });
      } else {
        log.info('capture', 'ok', { bytes: img.length, pitchDeg, yawDeg, hfovDeg });
      }
      return img;
    }

    log.warn('capture', 'render 未返回 dataURL', { pitchDeg, yawDeg, hfovDeg });
    return null;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log.error('capture', 'fail', { error: msg });
    return null;
  }
}

export function mimeFromDataUrl(url: string): string {
  const m = /^data:([^;,]+)/i.exec(url);
  return m?.[1] || 'image/png';
}

export function buildPanoramaCaptureFileName(sceneName?: string, index = 1): string {
  const base = (sceneName || 'panorama')
    .replace(/[^\w\u4e00-\u9fff\-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40) || 'panorama';
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `${base}-view-${index}-${stamp}.png`;
}
