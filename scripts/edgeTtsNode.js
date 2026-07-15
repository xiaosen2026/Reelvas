// Node 侧 Edge 神经 TTS（主进程 / 本地代理共用）
// 含 Sec-MS-GEC 时钟偏移与空音频关闭重试
const crypto = require('crypto');
const WebSocket = require('ws');

const EDGE_TRUSTED_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const WIN_EPOCH = 11644473600;
const CHROMIUM_FULL = '143.0.3650.75';
const SEC_MS_GEC_VERSION = `1-${CHROMIUM_FULL}`;
const SKEWS = [0, -300, 300, -600, 600];

function uuidNoDash() {
  return crypto.randomUUID().replace(/-/g, '');
}

function generateSecMsGec(skewSeconds = 0) {
  let ticks = Date.now() / 1000 + skewSeconds;
  ticks += WIN_EPOCH;
  ticks -= ticks % 300;
  ticks = Math.floor(ticks * 1e7);
  return crypto
    .createHash('sha256')
    .update(String(ticks) + EDGE_TRUSTED_TOKEN, 'ascii')
    .digest('hex')
    .toUpperCase();
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function parseBinaryAudio(chunks, data) {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
  if (buf.length >= 2) {
    const hl = buf.readUInt16BE(0);
    if (hl > 0 && hl + 2 <= buf.length) {
      const header = buf.slice(2, 2 + hl).toString('utf8');
      if (/Path:\s*audio/i.test(header)) {
        const body = buf.slice(2 + hl);
        if (body.length) chunks.push(body);
        return;
      }
    }
  }
  const sep = buf.indexOf('\r\n\r\n');
  if (sep >= 0) {
    const header = buf.slice(0, sep).toString('utf8');
    if (/Path:\s*audio/i.test(header) || /Content-Type:\s*audio/i.test(header)) {
      const body = buf.slice(sep + 4);
      if (body.length) chunks.push(body);
    }
  }
}

function onceSynthesize(params) {
  const text = String(params.text || '').trim();
  const voice = String(params.voice || 'zh-CN-XiaoxiaoNeural').trim() || 'zh-CN-XiaoxiaoNeural';
  const timeoutMs = params.timeoutMs || 45000;
  const skew = params.skew || 0;
  const useExtOrigin = params.useExtOrigin !== false;

  const connId = uuidNoDash();
  const reqId = uuidNoDash();
  const url =
    'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1' +
    `?TrustedClientToken=${EDGE_TRUSTED_TOKEN}` +
    `&ConnectionId=${connId}` +
    `&Sec-MS-GEC=${generateSecMsGec(skew)}` +
    `&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}`;

  const headers = {
    'User-Agent':
      `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROMIUM_FULL.split('.')[0]}.0.0.0 Safari/537.36 Edg/${CHROMIUM_FULL.split('.')[0]}.0.0.0`,
    Pragma: 'no-cache',
    'Cache-Control': 'no-cache',
  };
  if (useExtOrigin) {
    headers.Origin = 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold';
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const chunks = [];
    const ws = new WebSocket(url, { headers });

    const finish = (err, buf) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      if (err) reject(err);
      else resolve(buf);
    };

    const timer = setTimeout(() => finish(new Error('Edge TTS 超时')), timeoutMs);

    ws.on('open', () => {
      const cfg =
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
        });
      ws.send(cfg);
      const ssml =
        "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='zh-CN'>" +
        `<voice name='${escapeXml(voice)}'>${escapeXml(text)}</voice></speak>`;
      ws.send(
        `X-RequestId:${reqId}\r\n` +
          'Content-Type:application/ssml+xml\r\n' +
          `X-Timestamp:${new Date().toString()}\r\n` +
          'Path:ssml\r\n\r\n' +
          ssml,
      );
    });

    ws.on('message', (data, isBinary) => {
      const asBuf = Buffer.isBuffer(data) ? data : Buffer.from(data);
      if (!isBinary && typeof data === 'string') {
        const s = data.toString();
        if (/Path:\s*turn\.end/i.test(s)) {
          if (!chunks.length) finish(new Error('Edge TTS 未返回音频数据'));
          else finish(null, Buffer.concat(chunks));
        }
        return;
      }
      if (!isBinary || asBuf.indexOf('Path:') >= 0) {
        const s = asBuf.toString('utf8');
        if (/Path:\s*turn\.end/i.test(s)) {
          if (!chunks.length) finish(new Error('Edge TTS 未返回音频数据'));
          else finish(null, Buffer.concat(chunks));
          return;
        }
        if (!/Path:\s*audio/i.test(s) && !isBinary) return;
      }
      parseBinaryAudio(chunks, asBuf);
    });

    ws.on('error', (e) => finish(e instanceof Error ? e : new Error(String(e))));
    ws.on('close', (code) => {
      if (settled) return;
      if (chunks.length) finish(null, Buffer.concat(chunks));
      else finish(new Error(`Edge TTS 连接关闭且无音频 (code=${code})`));
    });
  });
}

/**
 * @param {{ text: string, voice?: string, timeoutMs?: number }} params
 * @returns {Promise<Buffer>}
 */
async function synthesizeEdgeMp3Node(params) {
  const text = String(params.text || '').trim();
  if (!text) throw new Error('请输入要朗读的文本');
  const voice = String(params.voice || 'zh-CN-XiaoxiaoNeural').trim() || 'zh-CN-XiaoxiaoNeural';
  const timeoutMs = params.timeoutMs || 45000;

  let lastErr = null;
  for (let attempt = 0; attempt < SKEWS.length; attempt++) {
    const skew = SKEWS[attempt];
    const useExtOrigin = attempt < 3;
    try {
      const buf = await onceSynthesize({
        text,
        voice,
        timeoutMs,
        skew,
        useExtOrigin,
      });
      if (buf && buf.length) return buf;
      lastErr = new Error('Edge TTS 返回空缓冲');
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      await new Promise((r) => setTimeout(r, 120 + attempt * 80));
    }
  }
  throw lastErr || new Error('Edge TTS 失败');
}

module.exports = { synthesizeEdgeMp3Node };
