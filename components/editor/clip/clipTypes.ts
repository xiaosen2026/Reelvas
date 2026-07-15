// 剪辑器类型

export type ClipMediaKind = 'video' | 'image' | 'audio';

/** 来自画布节点的媒体条目 */
export type ClipMediaItem = {
  id: string;
  nodeId: string;
  kind: ClipMediaKind;
  /** 可播放 / 可绘制的 URL（http / data / blob） */
  url: string;
  name: string;
  /** 视频/音频秒数；图片默认 3s */
  durationSec: number;
};

/** 时间轴上的片段 */
export type TimelineClip = {
  id: string;
  mediaId: string;
  kind: ClipMediaKind;
  name: string;
  url: string;
  /** 时间轴起点（秒） */
  startSec: number;
  /** 使用的素材时长（秒），可小于原片 */
  durationSec: number;
  /** 从素材内裁切起点 */
  trimInSec: number;
  color: string;
};

export const CLIP_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ec4899', '#06b6d4', '#a855f7'];

export const DEFAULT_IMAGE_DUR = 3;
export const DEFAULT_FPS = 30;
