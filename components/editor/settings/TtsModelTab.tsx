'use client';

import { ModelConfigCore } from './ModelConfigCore';
import { TTS_MODELS } from '../../../lib/settingsData';

/** TTS 语音：NewAPI OpenAI 兼容 /v1/audio/speech（与音乐分离） */
export function TtsModelTab() {
  return (
    <ModelConfigCore
      label="TTS 模型"
      protocols={['NewAPI（OpenAI TTS）']}
      defaultApi=""
      models={TTS_MODELS}
      channelKind="tts"
      seedLocalDebug
    />
  );
}
