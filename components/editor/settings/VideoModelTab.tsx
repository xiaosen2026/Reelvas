'use client';

import { ModelConfigCore } from './ModelConfigCore';
import { VIDEO_MODELS } from '../../../lib/settingsData';
import { VIDEO_PROTOCOL_OPTIONS } from '../../../lib/llm/videoProtocolResolve';

/**
 * 视频只对接 NewAPI 一个网关。
 * 下拉项是同一平台上的接口形态（通用/Sora/可灵/即梦/火山），不是各模型官网。
 */
export function VideoModelTab() {
  return (
    <ModelConfigCore
      label="视频模型"
      protocols={[...VIDEO_PROTOCOL_OPTIONS]}
      defaultApi=""
      models={VIDEO_MODELS}
      channelKind="video"
      seedLocalDebug
    />
  );
}
