// 图像节点：配方 systemPrompt 二次改写

import { getPrimaryTextChannel } from '../../../lib/settingsStore';
import { chatCompletion } from '../../../lib/llm/openaiChat';
import { buildChatMessages, getRecipeById } from '../../../lib/recipePresets';
import { recordTextUsage } from '../../../lib/usageStore';
import { createLogger } from '../../../lib/logger';

const log = createLogger('applyImageRecipe');

/** 有 recipe 时走文本通道改写 prompt；无通道/空结果则回退原文 */
export async function applyImageRecipe(
  userText: string,
  recipeId: string | undefined,
  signal?: AbortSignal,
): Promise<string> {
  if (!recipeId || recipeId === 'none') return userText;
  const recipe = getRecipeById(recipeId);
  if (!recipe?.systemPrompt?.trim()) return userText;

  const channel = getPrimaryTextChannel();
  if (!channel?.apiKey?.trim() || !channel?.apiAddr?.trim()) {
    log.warn('applyImageRecipe', 'no text channel, skip recipe rewrite', { recipeId });
    return userText;
  }

  const model = channel.models[0]?.name || 'grok-4.5';
  log.info('applyImageRecipe', 'rewrite', { recipeId, model, inLen: userText.length });
  const res = await chatCompletion({
    baseUrl: channel.apiAddr,
    apiKey: channel.apiKey,
    model,
    messages: buildChatMessages(userText, recipeId),
    temperature: 0.7,
    signal,
  });
  const out = (res.content || '').trim();
  if (!out) {
    log.warn('applyImageRecipe', 'empty rewrite, keep original', { recipeId });
    return userText;
  }
  const apiTok = res.usage?.total_tokens;
  const tokens =
    typeof apiTok === 'number' && apiTok > 0
      ? apiTok
      : Math.max(1, Math.ceil((userText.length + out.length) / 4));
  recordTextUsage(tokens);
  log.info('applyImageRecipe', 'ok', { recipeId, outLen: out.length, tokens });
  return out;
}
