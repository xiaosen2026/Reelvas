// 视频客户端门面：创建 + 轮询 + 尺寸工具

import { createVideoJob, parseSeconds, type VideoCreateParams } from './videoCreate';
import { waitVideoResult, type VideoWaitResult, type WaitVideoOptions } from './videoPoll';

export type OpenAIVideoCreateParams = VideoCreateParams & WaitVideoOptions;

export type OpenAIVideoResult = VideoWaitResult;

/** 创建任务并轮询直到拿到可播放 URL */
export async function createAndWaitVideo(
  params: OpenAIVideoCreateParams,
): Promise<OpenAIVideoResult> {
  params.onProgress?.('提交任务…');
  const created = await createVideoJob(params);
  return waitVideoResult(params, created);
}

/** 分辨率 + 比例 → width x height */
export function mapVideoSize(res: string, ratio: string): string {
  const r = (ratio || '16:9').trim();
  const level = /1080|4k|high/i.test(res) ? 1080 : /480|sd|low/i.test(res) ? 480 : 720;

  const table: Record<number, Record<string, string>> = {
    480: {
      '16:9': '854x480',
      '9:16': '480x854',
      '1:1': '480x480',
      '4:3': '640x480',
      '3:4': '480x640',
      '21:9': '1024x432',
    },
    720: {
      '16:9': '1280x720',
      '9:16': '720x1280',
      '1:1': '720x720',
      '4:3': '960x720',
      '3:4': '720x960',
      '21:9': '1680x720',
    },
    1080: {
      '16:9': '1920x1080',
      '9:16': '1080x1920',
      '1:1': '1080x1080',
      '4:3': '1440x1080',
      '3:4': '1080x1440',
      '21:9': '2560x1080',
    },
  };

  const byLevel = table[level] || table[720];
  return byLevel[r] || byLevel['16:9'] || '1280x720';
}

/** 解析 UI 时长文案（如 "6秒" / "8"），返回 1–20 的秒数字符串 */
export function mapVideoSeconds(duration: string | number): string {
  return String(parseSeconds(duration));
}

export { resolveVideoProtocol, VIDEO_PROTOCOL_OPTIONS } from './videoProtocolResolve';
export type { VideoProtocolKind } from './videoProtocolResolve';
