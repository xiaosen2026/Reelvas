// 节点预设：从设置 Recipes 读取，按生成类型筛选

import { RECIPES, type RecipeItem } from './settingsData';
import { createLogger } from './logger';

const log = createLogger('recipePresets');

export type RecipeType = '文本' | '图片' | '视频';

export function listRecipesByType(type: RecipeType): RecipeItem[] {
  const list = RECIPES.filter((r) => r.type === type);
  log.debug('listRecipesByType', 'ok', { type, count: list.length });
  return list;
}

/** 下拉选项：无预设 + 指定类型 Recipes */
export function listRecipeOptions(type: RecipeType): { value: string; label: string }[] {
  return [
    { value: 'none', label: '无预设' },
    ...listRecipesByType(type).map((r) => ({ value: r.id, label: r.title })),
  ];
}

export function getRecipeById(id: string | undefined | null): RecipeItem | null {
  if (!id || id === 'none') return null;
  return RECIPES.find((r) => r.id === id) ?? null;
}

/** 组装 chat messages：可选 system + user */
export function buildChatMessages(
  userText: string,
  recipeId?: string | null,
): { role: 'system' | 'user'; content: string }[] {
  const recipe = getRecipeById(recipeId);
  const messages: { role: 'system' | 'user'; content: string }[] = [];
  if (recipe?.systemPrompt?.trim()) {
    messages.push({ role: 'system', content: recipe.systemPrompt.trim() });
  }
  messages.push({ role: 'user', content: userText });
  log.info('buildChatMessages', 'built', {
    recipeId: recipe?.id ?? 'none',
    hasSystem: messages[0]?.role === 'system',
    userLen: userText.length,
  });
  return messages;
}
