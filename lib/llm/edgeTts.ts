// Edge Read Aloud 免费神经 TTS → mp3 Blob（可播放/下载）

import { sha256Hex } from './sha256';
import { createLogger } from '../logger';

const log = createLogger('edgeTts');

const EDGE_TRUSTED_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const WIN_EPOCH = 11644473600;
const CHROMIUM_FULL = '143.0.3650.75';
const SEC_MS_GEC_VERSION = `1-${CHROMIUM_FULL}`;

function uuidNoDash(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '');
  }
  return (Date.now().toString(16) + Math.random().toString(16).slice(2)).slice(0, 32);
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Sec-MS-GEC：Windows 文件时间对齐 5 分钟 + SHA256 */
export function generateSecMsGec(skewSeconds = 0): string {
  let ticks = Date.now() / 1000 + skewSeconds;
  ticks += WIN_EPOCH;
  ticks -= ticks % 300;
  ticks = Math.floor(ticks * 1e7);
  return sha256Hex(String(ticks) + EDGE_TRUSTED_TOKEN).toUpperCase();
}

function pushAudioChunk(chunks: ArrayBuffer[], bytes: Uint8Array, start: number) {
  const audio = bytes.subarray(start);
  if (!audio.byteLength) return;
  // 拷贝为独立 ArrayBuffer，避免 SharedArrayBuffer 类型与切片兼容问题
  const copy = new Uint8Array(audio.byteLength);
  copy.set(audio);
  chunks.push(copy.buffer);
}

function parseBinaryAudio(chunks: ArrayBuffer[], buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf);
  if (bytes.length >= 2) {
    const hl = (bytes[0] << 8) | bytes[1];
    if (hl > 0 && hl + 2 <= bytes.length) {
      const header = new TextDecoder().decode(bytes.subarray(2, 2 + hl));
      if (/Path:\s*audio/i.test(header)) {
        pushAudioChunk(chunks, bytes, 2 + hl);
        return;
      }
    }
  }
  let sep = -1;
  for (let i = 0; i < bytes.length - 3; i++) {
    if (
      bytes[i] === 0x0d &&
      bytes[i + 1] === 0x0a &&
      bytes[i + 2] === 0x0d &&
      bytes[i + 3] === 0x0a
    ) {
      sep = i + 4;
      break;
    }
  }
  if (sep < 0) return;
  const header = new TextDecoder().decode(bytes.subarray(0, sep));
  if (/Path:\s*audio/i.test(header) || /Content-Type:\s*audio/i.test(header)) {
    pushAudioChunk(chunks, bytes, sep);
  }
}

/**
 * Edge 免费神经 TTS → audio/mpeg Blob
 * 需访问 speech.platform.bing.com（公开 Read Aloud，无用户 Key）
 */
export async function synthesizeEdgeMp3(params: {
  text: string;
  voice: string;
  signal?: AbortSignal;
}): Promise<Blob> {
  if (typeof WebSocket === 'undefined') throw new Error('当前环境无 WebSocket');

  const connId = uuidNoDash();
  const reqId = uuidNoDash();
  const gec = generateSecMsGec();
  const url =
    'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1' +
    `?TrustedClientToken=${EDGE_TRUSTED_TOKEN}` +
    `&ConnectionId=${connId}` +
    `&Sec-MS-GEC=${gec}` +
    `&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}`;

  log.info('synthesizeEdgeMp3', 'connect', { voice: params.voice, chars: params.text.length });
  const chunks: ArrayBuffer[] = [];

  return new Promise<Blob>((resolve, reject) => {
    let settled = false;
    const ws = new WebSocket(url);
    ws.binaryType = 'arraybuffer';

    const cleanup = () => {
      clearTimeout(timer);
      params.signal?.removeEventListener('abort', onAbort);
    };
    const finishErr = (e: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      reject(e);
    };
    const finishOk = () => {
      if (settled) return;
      settled = true;
      cleanup();
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      if (!chunks.length) {
        reject(new Error('Edge TTS 未返回音频数据'));
        return;
      }
      const blob = new Blob(chunks, { type: 'audio/mpeg' });
      log.info('synthesizeEdgeMp3', 'ok', { size: blob.size });
      resolve(blob);
    };

    const onAbort = () => finishErr(new DOMException('Aborted', 'AbortError'));
    params.signal?.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(() => finishErr(new Error('Edge TTS 超时')), 60000);

    ws.onopen = () => {
      if (params.signal?.aborted) {
        finishErr(new DOMException('Aborted', 'AbortError'));
        return;
      }
      ws.send(
        `X-Timestamp:${new Date().toString()}\r\n` +
          'Content-Type:application/json; charset=utf-8\r\n' +
          'Path:speech.config\r\n\r\n' +
          JSON.stringify({
            context: {
              synthesis: {
                audio: {
                  metadataoptions: {
                    sentenceBoundaryEnabled: 'false',
                    wordBoundaryEnabled: 'false',
                  },
                  outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
                },
              },
            },
          }),
      );
      const ssml =
        "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='zh-CN'>" +
        `<voice name='${escapeXml(params.voice)}'>${escapeXml(params.text)}</voice></speak>`;
      ws.send(
        `X-RequestId:${reqId}\r\n` +
          'Content-Type:application/ssml+xml\r\n' +
          `X-Timestamp:${new Date().toString()}\r\n` +
          'Path:ssml\r\n\r\n' +
          ssml,
      );
    };

    ws.onmessage = (ev) => {
      if (typeof ev.data === 'string') {
        if (/Path:\s*turn\.end/i.test(ev.data)) finishOk();
        return;
      }
      parseBinaryAudio(chunks, ev.data as ArrayBuffer);
    };
    ws.onerror = () => finishErr(new Error('Edge TTS WebSocket 错误（可能被网络拦截）'));
    ws.onclose = () => {
      if (!settled) {
        if (chunks.length) finishOk();
        else finishErr(new Error('Edge TTS 连接关闭且无音频'));
      }
    };
  });
}
