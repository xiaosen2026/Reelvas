// 导出 Premiere 可导入的 FCP7 XML（xmeml v4）
// !!! 不能生成 .prproj（Adobe 私有格式）!!!
// 用「文件 → 导入」打开本 .xml 即可二次剪辑。
// 限制：素材最好是 http(s) 可访问路径；data:/blob: 需在 PR 里重新链接。

import type { TimelineClip } from './clipTypes';
import { DEFAULT_FPS } from './clipTypes';
import { createLogger } from '@/lib/logger';

const log = createLogger('exportPremiereXml');

function escXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toFrames(sec: number, fps: number): number {
  return Math.max(0, Math.round(sec * fps));
}

function fileNameFromUrl(url: string, fallback: string): string {
  if (url.startsWith('data:') || url.startsWith('blob:')) {
    const base = fallback.replace(/\.[^.]+$/, '') || 'media';
    if (url.startsWith('data:video') || /\.mp4/i.test(fallback)) return `${base}.mp4`;
    if (url.startsWith('data:audio') || /\.mp3/i.test(fallback)) return `${base}.mp3`;
    if (url.startsWith('data:image')) return `${base}.png`;
    return `${base}.bin`;
  }
  try {
    const u = new URL(url, 'http://local.invalid');
    const last = u.pathname.split('/').filter(Boolean).pop();
    if (last) return decodeURIComponent(last);
  } catch {
    /* ignore */
  }
  return fallback || 'media.bin';
}

function pathurlFor(url: string, fileName: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('file:')) return url;
  // data/blob：占位路径，导入后 PR 会提示重新链接
  if (url.startsWith('data:') || url.startsWith('blob:')) {
    return `file://localhost/ReelvasMedia/${encodeURIComponent(fileName)}`;
  }
  if (url.startsWith('/')) return `file://localhost${url}`;
  return url;
}

function rateBlock(fps: number): string {
  return `<rate>
          <timebase>${fps}</timebase>
          <ntsc>FALSE</ntsc>
        </rate>`;
}

/**
 * 生成 FCP7 XML（Premiere Pro 可导入）
 */
export function buildPremiereFcp7Xml(
  clips: TimelineClip[],
  opts?: { name?: string; fps?: number },
): string {
  const fps = opts?.fps ?? DEFAULT_FPS;
  const seqName = opts?.name || 'Reelvas Timeline';
  const endFrame = Math.max(
    1,
    ...clips.map((c) => toFrames(c.startSec + c.durationSec, fps)),
    fps * 5,
  );

  const fileIdByUrl = new Map<string, string>();
  let fileSeq = 0;
  const ensureFileId = (url: string) => {
    let id = fileIdByUrl.get(url);
    if (!id) {
      id = `file-${++fileSeq}`;
      fileIdByUrl.set(url, id);
    }
    return id;
  };

  const makeFileXml = (c: TimelineClip, fileId: string): string => {
    const name = fileNameFromUrl(c.url, c.name || fileId);
    const pathurl = pathurlFor(c.url, name);
    const mediaDur = Math.max(
      toFrames(c.trimInSec + c.durationSec, fps),
      toFrames(c.durationSec, fps),
      fps,
    );
    const isAudio = c.kind === 'audio';
    return `<file id="${escXml(fileId)}">
            <name>${escXml(name)}</name>
            <pathurl>${escXml(pathurl)}</pathurl>
            ${rateBlock(fps)}
            <duration>${mediaDur}</duration>
            <media>
              ${
                isAudio
                  ? `<audio>
                <samplecharacteristics>
                  <depth>16</depth>
                  <samplerate>48000</samplerate>
                </samplecharacteristics>
              </audio>`
                  : `<video>
                <samplecharacteristics>
                  <width>1920</width>
                  <height>1080</height>
                  <progressive>TRUE</progressive>
                </samplecharacteristics>
              </video>
              <audio>
                <samplecharacteristics>
                  <depth>16</depth>
                  <samplerate>48000</samplerate>
                </samplecharacteristics>
              </audio>`
              }
            </media>
          </file>`;
  };

  const buildClipItems = (list: TimelineClip[], prefix: 'v' | 'a') => {
    return list
      .map((c, i) => {
        const fileId = ensureFileId(c.url);
        // 首次出现内嵌完整 file，后续只引用 id
        const first = [...fileIdByUrl.entries()].find(([, id]) => id === fileId)?.[0] === c.url
          && list.findIndex((x) => x.url === c.url) === i;
        // 上面逻辑不准：用计数
        return { c, fileId, i };
      })
      .map(({ c, fileId, i }, _, arr) => {
        const seenBefore = arr.slice(0, i).some((x) => x.c.url === c.url);
        const start = toFrames(c.startSec, fps);
        const end = toFrames(c.startSec + c.durationSec, fps);
        const inF = toFrames(c.trimInSec, fps);
        const outF = toFrames(c.trimInSec + c.durationSec, fps);
        const id = `clipitem-${prefix}-${i + 1}`;
        const fileXml = seenBefore
          ? `<file id="${escXml(fileId)}"/>`
          : makeFileXml(c, fileId);
        const audioSrc =
          prefix === 'a'
            ? `<sourcetrack>
            <mediatype>audio</mediatype>
            <trackindex>1</trackindex>
          </sourcetrack>`
            : `<compositemode>normal</compositemode>`;
        return `        <clipitem id="${id}">
          <name>${escXml(c.name)}</name>
          <enabled>TRUE</enabled>
          <duration>${Math.max(1, outF - inF)}</duration>
          ${rateBlock(fps)}
          <start>${start}</start>
          <end>${end}</end>
          <in>${inF}</in>
          <out>${outF}</out>
          ${fileXml}
          ${audioSrc}
        </clipitem>`;
      })
      .join('\n');
  };

  const videoList = clips.filter((c) => c.kind === 'video' || c.kind === 'image');
  const audioList = clips.filter((c) => c.kind === 'audio' || c.kind === 'video');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xmeml>
<!-- Reelvas → Premiere Pro：请用 文件 → 导入 打开本 XML（非 .prproj） -->
<!-- data:/blob: 素材导入后可能显示离线，请在 PR 中重新链接到本地文件 -->
<xmeml version="4">
  <sequence id="sequence-1">
    <name>${escXml(seqName)}</name>
    <duration>${endFrame}</duration>
    ${rateBlock(fps)}
    <timecode>
      ${rateBlock(fps)}
      <string>00:00:00:00</string>
      <frame>0</frame>
      <displayformat>NDF</displayformat>
    </timecode>
    <media>
      <video>
        <format>
          <samplecharacteristics>
            ${rateBlock(fps)}
            <width>1920</width>
            <height>1080</height>
            <progressive>TRUE</progressive>
          </samplecharacteristics>
        </format>
        <track>
${buildClipItems(videoList, 'v') || '          <!-- empty -->'}
          <enabled>TRUE</enabled>
          <locked>FALSE</locked>
        </track>
      </video>
      <audio>
        <format>
          <samplecharacteristics>
            <depth>16</depth>
            <samplerate>48000</samplerate>
          </samplecharacteristics>
        </format>
        <track>
${buildClipItems(audioList, 'a') || '          <!-- empty -->'}
          <enabled>TRUE</enabled>
          <locked>FALSE</locked>
        </track>
      </audio>
    </media>
  </sequence>
</xmeml>
`;

  log.info('buildPremiereFcp7Xml', 'ok', {
    clips: clips.length,
    video: videoList.length,
    audio: audioList.length,
    endFrame,
    fps,
  });
  return xml;
}

export function downloadPremiereXml(clips: TimelineClip[], name?: string): void {
  const xml = buildPremiereFcp7Xml(clips, { name });
  const blob = new Blob([xml], { type: 'text/xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(name || 'reelvas-premiere').replace(/[^\w一-鿿-]+/g, '_')}-${Date.now()}.xml`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
  log.info('downloadPremiereXml', 'triggered', { bytes: blob.size });
}
