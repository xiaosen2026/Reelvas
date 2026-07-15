// 将多段同源 mp3/音频 Blob 顺序拼接为可播放 Object URL

import { createLogger } from '../logger';

const log = createLogger('ttsConcatAudio');

/** 简单二进制拼接（同码率 Edge/OpenAI mp3 通常可连续播放） */
export async function concatAudioBlobs(
  blobs: Blob[],
): Promise<{ url: string; blob: Blob; bytes: number }> {
  if (!blobs.length) throw new Error('没有可拼接的音频');
  if (blobs.length === 1) {
    const blob = blobs[0];
    const url = URL.createObjectURL(blob);
    return { url, blob, bytes: blob.size };
  }
  const parts: ArrayBuffer[] = [];
  let total = 0;
  for (const b of blobs) {
    const buf = await b.arrayBuffer();
    parts.push(buf);
    total += buf.byteLength;
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(new Uint8Array(p), offset);
    offset += p.byteLength;
  }
  const type = blobs[0].type || 'audio/mpeg';
  const blob = new Blob([out], { type });
  const url = URL.createObjectURL(blob);
  log.info('concatAudioBlobs', 'ok', { segments: blobs.length, bytes: total, type });
  return { url, blob, bytes: total };
}

export async function blobFromObjectUrl(url: string, signal?: AbortSignal): Promise<Blob> {
  if (url.startsWith('blob:') || url.startsWith('data:')) {
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`读取音频失败 HTTP ${res.status}`);
    return res.blob();
  }
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`下载音频失败 HTTP ${res.status}`);
  return res.blob();
}
