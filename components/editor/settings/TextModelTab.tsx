'use client';

import { ModelConfigCore } from './ModelConfigCore';
import { TEXT_MODELS } from '../../../lib/settingsData';

export function TextModelTab() {
  return (
    <ModelConfigCore
      label="文本模型"
      protocols={['OpenAI (Chat)', 'Anthropic', 'Gemini']}
      defaultApi="http://localhost:8317"
      models={TEXT_MODELS}
      channelKind="text"
      seedLocalDebug
    />
  );
}
