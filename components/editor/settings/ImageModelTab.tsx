'use client';

import { ModelConfigCore } from './ModelConfigCore';
import { ImageHostSection } from './ImageHostSection';
import { IMAGE_MODELS } from '../../../lib/settingsData';
import { IMAGE_PROTOCOL_OPTIONS } from '../../../lib/llm/imageProtocolResolve';

/**
 * 图像只对接 NewAPI 一个网关。
 * 下拉项是同一平台上的接口形态（OpenAI 兼容 / 火山 / 阿里 / 即梦 / MJ），不是各模型官网。
 */
export function ImageModelTab() {
  return (
    <div className="space-y-6">
      <ImageHostSection />
      <ModelConfigCore
        label="图像模型"
        protocols={[...IMAGE_PROTOCOL_OPTIONS]}
        defaultApi=""
        models={IMAGE_MODELS}
        channelKind="image"
        seedLocalDebug
      />
    </div>
  );
}
