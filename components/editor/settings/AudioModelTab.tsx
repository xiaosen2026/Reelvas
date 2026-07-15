'use client';

import { ModelConfigCore } from './ModelConfigCore';
import { AUDIO_MODELS } from '../../../lib/settingsData';

/** 音频/音乐：NewAPI Suno 接口（与 TTS 分离） */
export function AudioModelTab() {
  return (
    <ModelConfigCore
      label="音频模型"
      protocols={['NewAPI（Suno 音乐）']}
      defaultApi=""
      models={AUDIO_MODELS}
      channelKind="audio"
      seedLocalDebug
    />
  );
}
