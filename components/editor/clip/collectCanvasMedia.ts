// 从画布节点收集可剪辑媒体（视频 / 图片 / 音频）
// 支持 asset:// 引用：asset 先 resolve 成 dataURL 再 probe

import type { FlowNode } from '../flow/types';
import { createLogger } from '@/lib/logger';
import {
  CLIP_COLORS,
  DEFAULT_IMAGE_DUR,
  type ClipMediaItem,
  type ClipMediaKind,
} from './clipTypes';

const log = createLogger('collectCanvasMedia');

function asStr(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function isHttpOrData(u: string): boolean {
  return (
    /^https?:\/\//i.test(u) ||
    u.startsWith('data:') ||
    u.startsWith('blob:') ||
    u.startsWith('asset://') ||
    u.startsWith('/')
  );
}

function looksVideo(u: string, mime = ''): boolean {
  if (mime.startsWith('video/')) return true;
  if (/^data:video\//i.test(u)) return true;
  return /\.(mp4|webm|mov|mkv|m4v)(\?|#|$)/i.test(u);
}
function looksAudio(u: string, mime = ''): boolean {
  if (mime.startsWith('audio/')) return true;
  if (/^data:audio\//i.test(u)) return true;
  return /\.(mp3|wav|ogg|m4a|aac|flac)(\?|#|$)/i.test(u);
}
function looksImage(u: string, mime = ''): boolean {
  if (mime.startsWith('image/')) return true;
  if (/^data:image\//i.test(u)) return true;
  return /\.(png|jpe?g|webp|gif|bmp)(\?|#|$)/i.test(u);
}

function pickUrl(d: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const u = asStr(d[k]);
    if (u && isHttpOrData(u)) return u;
  }
  return '';
}

function kindOf(url: string, mime: string, nodeType: string, mediaKind: string): ClipMediaKind | null {
  if (mediaKind === 'video' || nodeType === 'video' || looksVideo(url, mime)) return 'video';
  if (mediaKind === 'audio' || nodeType === 'audio' || nodeType === 'tts' || looksAudio(url, mime)) return 'audio';
  if (mediaKind === 'image' || nodeType === 'image' || nodeType === 'upload' || nodeType === 'upscale' || nodeType === 'outpaint' || looksImage(url, mime)) return 'image';
  return null;
}

/** 探测时长（asset:// 需先 resolve） */
export function probeDuration(url: string, kind: ClipMediaKind): Promise<number> {
  if (kind === 'image') return Promise.resolve(DEFAULT_IMAGE_DUR);
  return new Promise((resolve) => {
    const el = document.createElement(kind === 'audio' ? 'audio' : 'video');
    el.preload = 'metadata';
    const done = (sec: number) => {
      el.removeAttribute('src');
      el.load();
      resolve(sec);
    };
    el.onloadedmetadata = () => {
      const d = el.duration;
      done(Number.isFinite(d) && d > 0 ? d : kind === 'audio' ? 5 : 6);
    };
    el.onerror = () => done(kind === 'audio' ? 5 : 6);
    el.src = url;
  });
}

/** 扫描节点，抽出有可播放 URL 的媒体 */
export function collectCanvasMedia(nodes: FlowNode[]): ClipMediaItem[] {
  const out: ClipMediaItem[] = [];
  const seen = new Set<string>();

  for (const node of nodes) {
    const d = (node.data || {}) as Record<string, unknown>;
    const type = node.type || '';
    const mediaKind = asStr(d.mediaKind);
    const mime = asStr(d.fileType);
    const candidates: Array<{ url: string; prefer?: ClipMediaKind }> = [];

    if (type === 'video' || mediaKind === 'video') {
      const u = pickUrl(d, ['videoUrl', 'value', 'fileUrl']);
      if (u) candidates.push({ url: u, prefer: 'video' });
    } else if (type === 'audio' || type === 'tts' || mediaKind === 'audio') {
      const u = pickUrl(d, ['audioUrl', 'value', 'fileUrl']);
      if (u) candidates.push({ url: u, prefer: 'audio' });
    } else if (['image', 'upscale', 'outpaint', 'panorama'].includes(type) || mediaKind === 'image') {
      const u = pickUrl(d, ['value', 'imageUrl', 'fileUrl']);
      if (Array.isArray(d.imageUrls)) {
        for (const x of d.imageUrls) {
          if (typeof x === 'string' && isHttpOrData(x)) candidates.push({ url: x, prefer: 'image' });
        }
      }
      if (u) candidates.push({ url: u, prefer: 'image' });
    } else if (type === 'upload') {
      const u = pickUrl(d, ['fileUrl', 'value', 'videoUrl', 'audioUrl', 'imageUrl']);
      if (u) candidates.push({ url: u });
    } else {
      for (const key of ['videoUrl', 'audioUrl', 'imageUrl', 'fileUrl', 'value']) {
        const u = asStr(d[key]);
        if (u && isHttpOrData(u) && (looksVideo(u) || looksAudio(u) || looksImage(u))) {
          candidates.push({ url: u });
        }
      }
    }

    for (const c of candidates) {
      if (!c.url || seen.has(c.url)) continue;
      const kind = c.prefer || kindOf(c.url, mime, type, mediaKind);
      if (!kind) continue;
      seen.add(c.url);
      const name = asStr(d.fileName) || asStr(d.label) || `${kind}-${node.id}`;
      out.push({
        id: `${node.id}:${out.length}`,
        nodeId: node.id,
        kind,
        url: c.url,
        name,
        durationSec: kind === 'image' ? DEFAULT_IMAGE_DUR : 0,
      });
    }
  }

  log.info('collectCanvasMedia', 'ok', { nodes: nodes.length, media: out.length });
  return out;
}

export function colorForIndex(i: number): string {
  return CLIP_COLORS[i % CLIP_COLORS.length];
}
