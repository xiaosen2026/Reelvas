import { getRecipeById } from '../../../lib/recipePresets';
import type { ThinkingLevel } from './textThinking';

export function parseThinking(raw: unknown): ThinkingLevel {
  if (raw === 'low' || raw === 'medium' || raw === 'high' || raw === 'off') return raw;
  return 'off';
}

export function recipePatch(recipeId: string, extra: Record<string, unknown> = {}) {
  const recipe = getRecipeById(recipeId);
  return {
    recipeId: recipeId === 'none' ? '' : recipeId,
    recipeTitle: recipe?.title || '',
    ...extra,
  };
}
