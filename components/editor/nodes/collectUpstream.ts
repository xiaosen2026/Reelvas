// 收集指向某节点的上游输入：文本追加 + 图片列表（图生图）

import type { FlowEdge, FlowNode } from '../flow/types';
import { createLogger } from '../../../lib/logger';

const log = createLogger('collectUpstream');

export interface UpstreamInputs {
  /** 上游文本片段（按连线顺序） */
  texts: string[];
  /** 上游图片 URL / dataURL（按连线顺序，可多张） */
  imageSrcs: string[];
  /** 上游视频 URL / dataURL */
  videoSrcs: string[];
  /** 上游音频 URL / dataURL */
  audioSrcs: string[];
}

function isImageDataUrl(s: string): boolean {
  return /^data:image\//i.test(s);
}

function isVideoDataUrl(s: string): boolean {
  return /^data:video\//i.test(s);
}

function isAudioDataUrl(s: string): boolean {
  return /^data:audio\//i.test(s);
}

function looksLikeImageUrl(s: string): boolean {
  if (isImageDataUrl(s)) return true;
  if (/^blob:/i.test(s)) return false; // blob 无后缀，勿当图
  if (!/^https?:\/\//i.test(s) && !s.startsWith('/')) return false;
  return /\.(png|jpe?g|webp|gif|bmp|svg)(\?|#|$)/i.test(s) || /\/images?\//i.test(s);
}

function looksLikeVideoUrl(s: string): boolean {
  if (isVideoDataUrl(s)) return true;
  if (!/^https?:\/\//i.test(s) && !s.startsWith('/')) return false;
  return /\.(mp4|webm|mov|mkv|avi|m4v)(\?|#|$)/i.test(s);
}

function looksLikeAudioUrl(s: string): boolean {
  if (isAudioDataUrl(s)) return true;
  if (!/^https?:\/\//i.test(s) && !s.startsWith('/')) return false;
  return /\.(mp3|wav|ogg|m4a|aac|flac)(\?|#|$)/i.test(s);
}

function pushUnique(list: string[], v: string) {
  const t = v.trim();
  if (!t || list.includes(t)) return;
  list.push(t);
}

/** 纯图输出节点（不含 upload：upload 按 mediaKind/fileType 分流） */
const IMAGE_TYPES = new Set(['image', 'upscale', 'outpaint', 'panorama', 'canvas', 'storyboard']);
const VIDEO_TYPES = new Set(['video']);
const AUDIO_TYPES = new Set(['audio', 'tts']);
/** 以文本为主的节点：优先读 value，无 value 时回退 prompt/content */
const TEXT_TYPES = new Set([
  'textInput',
  'textResource',
  'text-input',
  'stickyNote',
  'script',
  'table',
]);

function asString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function isUploadImage(d: Record<string, unknown>): boolean {
  const kind = String(d.mediaKind || '');
  const ft = String(d.fileType || '');
  const fileUrl = asString(d.fileUrl);
  const value = asString(d.value);
  if (kind === 'image') return true;
  if (kind === 'video' || kind === 'audio') return false;
  if (ft.startsWith('image/')) return true;
  if (ft.startsWith('video/') || ft.startsWith('audio/')) return false;
  return isImageDataUrl(fileUrl) || isImageDataUrl(value) || looksLikeImageUrl(fileUrl) || looksLikeImageUrl(value);
}

/** 从单个上游节点 data 抽取文本与媒体 */
export function extractNodeOutputs(node: FlowNode): UpstreamInputs {
  const texts: string[] = [];
  const imageSrcs: string[] = [];
  const videoSrcs: string[] = [];
  const audioSrcs: string[] = [];
  const d = (node.data || {}) as Record<string, unknown>;
  const type = node.type || '';

  if (Array.isArray(d.imageUrls)) {
    for (const u of d.imageUrls) {
      if (typeof u === 'string') pushUnique(imageSrcs, u);
    }
  }

  // 上传节点：按 mediaKind / MIME 分流，避免把视频 dataURL 塞进图生图
  if (type === 'upload') {
    const fileUrl = asString(d.fileUrl) || asString(d.value);
    const ft = String(d.fileType || '');
    const kind = String(d.mediaKind || '');
    if (fileUrl) {
      if (kind === 'video' || ft.startsWith('video/') || isVideoDataUrl(fileUrl)) {
        pushUnique(videoSrcs, fileUrl);
      } else if (kind === 'audio' || ft.startsWith('audio/') || isAudioDataUrl(fileUrl)) {
        pushUnique(audioSrcs, fileUrl);
      } else if (isUploadImage(d)) {
        pushUnique(imageSrcs, fileUrl);
      }
    }
  } else if (typeof d.fileUrl === 'string' && d.fileUrl) {
    const ft = String(d.fileType || '');
    if (ft.startsWith('image/') || isImageDataUrl(d.fileUrl) || looksLikeImageUrl(d.fileUrl)) {
      pushUnique(imageSrcs, d.fileUrl);
    } else if (ft.startsWith('video/') || isVideoDataUrl(d.fileUrl) || looksLikeVideoUrl(d.fileUrl)) {
      pushUnique(videoSrcs, d.fileUrl);
    } else if (ft.startsWith('audio/') || isAudioDataUrl(d.fileUrl) || looksLikeAudioUrl(d.fileUrl)) {
      pushUnique(audioSrcs, d.fileUrl);
    }
  }

  const videoUrl = asString(d.videoUrl);
  if (videoUrl) pushUnique(videoSrcs, videoUrl);
  const audioUrl = asString(d.audioUrl);
  if (audioUrl) pushUnique(audioSrcs, audioUrl);
  const imageUrl = asString(d.imageUrl);
  if (imageUrl) pushUnique(imageSrcs, imageUrl);

  // value：图/视/音节点输出 / 其它节点文本
  const value = asString(d.value);
  if (value && type !== 'upload') {
    if (IMAGE_TYPES.has(type)) {
      pushUnique(imageSrcs, value);
    } else if (VIDEO_TYPES.has(type) || isVideoDataUrl(value) || looksLikeVideoUrl(value)) {
      pushUnique(videoSrcs, value);
    } else if (AUDIO_TYPES.has(type) || isAudioDataUrl(value) || looksLikeAudioUrl(value)) {
      pushUnique(audioSrcs, value);
    } else if (isImageDataUrl(value) || looksLikeImageUrl(value)) {
      pushUnique(imageSrcs, value);
    } else {
      pushUnique(texts, value);
    }
  }

  // 文本类节点：value 为空时用 prompt / content 拼接（输入框内容）
  if (texts.length === 0 && !IMAGE_TYPES.has(type) && type !== 'upload') {
    const prompt = asString(d.prompt);
    const content = asString(d.content);
    const text = asString(d.text);
    if (TEXT_TYPES.has(type) || type === '') {
      if (prompt) pushUnique(texts, prompt);
      if (content) pushUnique(texts, content);
      if (text) pushUnique(texts, text);
    } else if (prompt && !value) {
      pushUnique(texts, prompt);
    }
  }

  return { texts, imageSrcs, videoSrcs, audioSrcs };
}

/** 收集所有指向 targetId 的直接上游 */
export function collectUpstreamInputs(
  targetId: string,
  nodes: FlowNode[],
  edges: FlowEdge[],
): UpstreamInputs {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const texts: string[] = [];
  const imageSrcs: string[] = [];
  const videoSrcs: string[] = [];
  const audioSrcs: string[] = [];

  const incoming = edges.filter((e) => e.target === targetId);
  for (const e of incoming) {
    const src = byId.get(e.source);
    if (!src) continue;
    const part = extractNodeOutputs(src);
    for (const t of part.texts) pushUnique(texts, t);
    for (const u of part.imageSrcs) pushUnique(imageSrcs, u);
    for (const u of part.videoSrcs) pushUnique(videoSrcs, u);
    for (const u of part.audioSrcs) pushUnique(audioSrcs, u);
  }

  log.debug('collectUpstreamInputs', 'done', {
    targetId,
    edgeCount: incoming.length,
    texts: texts.length,
    images: imageSrcs.length,
    videos: videoSrcs.length,
    audios: audioSrcs.length,
  });
  return { texts, imageSrcs, videoSrcs, audioSrcs };
}

/**
 * 拼接提交 prompt：上游文本（按入边顺序）+ 本节点描述
 * 任一侧为空则只保留另一侧；多段上游用换行连接
 */
export function mergePromptWithUpstream(localPrompt: string, upstreamTexts: string[]): string {
  const extra = upstreamTexts.map((t) => t.trim()).filter(Boolean);
  const base = localPrompt.trim();
  if (!extra.length) return base;
  if (!base) return extra.join('\n');
  // 上游在前、本节点在后，保证「连线内容 + 本地补充」一起提交
  return `${extra.join('\n')}\n${base}`;
}


// 参考图 blob 工具拆至 imageBlobUtils（PNG + media-proxy）
export { srcToBlob, compressImageBlob, srcsToBlobs } from './imageBlobUtils';
