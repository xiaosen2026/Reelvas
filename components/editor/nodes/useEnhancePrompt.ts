// 节点「增强提示词」：读取节点管理配置 + 本地 LLM 改写 prompt

import { useCallback, useState } from 'react';
import {
  getEnhancePromptConfig,
  type EnhanceNodeKind,
} from '../../../lib/enhancePromptStore';
import { getPrimaryTextChannel } from '../../../lib/settingsStore';
import { chatCompletion } from '../../../lib/llm/openaiChat';
import { recordTextUsage } from '../../../lib/usageStore';
import { createLogger } from '../../../lib/logger';

const log = createLogger('useEnhancePrompt');

export type EnhanceOptions = {
  /** 覆盖 system：节点选中的 Recipe 优先于节点管理默认增强词 */
  systemPrompt?: string | null;
  /** 强制启用（Recipe 路径忽略节点管理 enabled 开关） */
  force?: boolean;
};

export function useEnhancePrompt(kind: EnhanceNodeKind) {
  const [enhancing, setEnhancing] = useState(false);

  const enhance = useCallback(
    async (prompt: string, opts?: EnhanceOptions): Promise<string | null> => {
      const text = prompt.trim();
      if (!text || enhancing) return null;

      const cfg = getEnhancePromptConfig(kind);
      const override = opts?.systemPrompt?.trim() || '';
      const systemPrompt = override || cfg.systemPrompt.trim();

      if (!override && !cfg.enabled) {
        log.warn('enhance', 'disabled in node settings', { kind });
        return null;
      }
      if (!systemPrompt) {
        log.warn('enhance', 'empty systemPrompt', { kind });
        return null;
      }

      const channel = getPrimaryTextChannel();
      if (!channel?.apiKey?.trim() || !channel?.apiAddr?.trim()) {
        log.error('enhance', 'no text channel');
        throw new Error('未配置文本渠道：请在设置 → 文本模型中填写 API 地址与 Key');
      }

      const model = channel.models[0]?.name || 'grok-4.5';
      setEnhancing(true);
      log.info('enhance', 'start', {
        kind,
        model,
        len: text.length,
        viaRecipe: !!override,
      });

      try {
        const res = await chatCompletion({
          baseUrl: channel.apiAddr,
          apiKey: channel.apiKey,
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: text },
          ],
          temperature: 0.7,
        });
        const out = (res.content || '').trim();
        if (!out) throw new Error('增强结果为空');

        const apiTok = res.usage?.total_tokens;
        const tokens =
          typeof apiTok === 'number' && apiTok > 0
            ? apiTok
            : Math.max(1, Math.ceil((text.length + out.length) / 4));
        recordTextUsage(tokens);

        log.info('enhance', 'ok', { kind, outLen: out.length, tokens, viaRecipe: !!override });
        return out;
      } finally {
        setEnhancing(false);
      }
    },
    [kind, enhancing],
  );

  return { enhancing, enhance };
}
