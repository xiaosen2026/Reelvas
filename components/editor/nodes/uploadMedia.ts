// 上传节点 MIME / 媒体类型推断（Windows 常无 file.type）

export type MediaKind = 'image' | 'video' | 'audio' | 'file';

export const UPLOAD_ACCEPT =
  'image/*,video/*,audio/*,.png,.jpg,.jpeg,.webp,.gif,.bmp,.svg,.mp4,.webm,.mov,.mkv,.avi,.mp3,.wav,.ogg,.m4a,.aac,.flac';

function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

/** 浏览器 file.type 常为空（尤其 Windows），用扩展名兜底 */
export function inferMediaType(fileName: string, mime = ''): { fileType: string; mediaKind: MediaKind } {
  const m = (mime || '').toLowerCase().trim();
  if (m.startsWith('image/')) return { fileType: m, mediaKind: 'image' };
  if (m.startsWith('video/')) return { fileType: m, mediaKind: 'video' };
  if (m.startsWith('audio/')) return { fileType: m, mediaKind: 'audio' };

  const ext = extOf(fileName);
  const imageExt: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    bmp: 'image/bmp',
    svg: 'image/svg+xml',
  };
  const videoExt: Record<string, string> = {
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    mkv: 'video/x-matroska',
    avi: 'video/x-msvideo',
    m4v: 'video/mp4',
  };
  const audioExt: Record<string, string> = {
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    m4a: 'audio/mp4',
    aac: 'audio/aac',
    flac: 'audio/flac',
  };
  if (imageExt[ext]) return { fileType: imageExt[ext], mediaKind: 'image' };
  if (videoExt[ext]) return { fileType: videoExt[ext], mediaKind: 'video' };
  if (audioExt[ext]) return { fileType: audioExt[ext], mediaKind: 'audio' };
  if (m) return { fileType: m, mediaKind: 'file' };
  return { fileType: 'application/octet-stream', mediaKind: 'file' };
}

export function kindFromStored(fileType: string, mediaKind?: string, fileUrl?: string): MediaKind {
  if (mediaKind === 'image' || mediaKind === 'video' || mediaKind === 'audio' || mediaKind === 'file') {
    return mediaKind;
  }
  const ft = (fileType || '').toLowerCase();
  if (ft.startsWith('image/') || /^data:image\//i.test(fileUrl || '')) return 'image';
  if (ft.startsWith('video/') || /^data:video\//i.test(fileUrl || '')) return 'video';
  if (ft.startsWith('audio/') || /^data:audio\//i.test(fileUrl || '')) return 'audio';
  return 'file';
}

export function mediaKindLabel(kind: MediaKind): string {
  if (kind === 'image') return '图片';
  if (kind === 'video') return '视频';
  if (kind === 'audio') return '音频';
  return '文件';
}
