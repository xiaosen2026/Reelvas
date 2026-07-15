'use client';

// 视频 / 音频 / TTS：设置渠道模型列表 → 节点下拉实时联动

import { useEffect, useMemo, useState } from 'react';
import {
  listAudioModelOptions,
  listTtsModelOptions,
  listVideoModelOptions,
  subscribeChannels,
  type TextModelOption,
} from '../../../lib/settingsStore';
import { createLogger } from '../../../lib/logger';

const log = createLogger('useChannelModelOptions');

/** 订阅渠道模型列表；设置页保存后节点下拉刷新。 */
export function useChannelModelOptions(kind: 'video' | 'audio' | 'tts' = 'video'): TextModelOption[] {
  const [rev, setRev] = useState(0);

  useEffect(() => {
    return subscribeChannels((changed) => {
      if (changed !== kind) return;
      log.debug('subscribe', 'refresh', { kind });
      setRev((n) => n + 1);
    });
  }, [kind]);

  return useMemo(() => {
    void rev;
    if (kind === 'audio') return listAudioModelOptions();
    if (kind === 'tts') return listTtsModelOptions();
    return listVideoModelOptions();
  }, [kind, rev]);
}
