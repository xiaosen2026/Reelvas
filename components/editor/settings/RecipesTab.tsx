'use client';

import { ItemListTab, ListEntry } from './ItemListTab';
import { RecipeEditDialog } from './RecipeEditDialog';
import { RECIPES as recipeData, TYPE_BADGE as typeBadge } from '../../../lib/settingsData';

const GRAY = 'text-muted-foreground border-border bg-muted/50';

// Recipes 设置页（成员访问用 obj['prop']，规避构建工具改写）
export function RecipesTab() {
  const items: ListEntry[] = recipeData['map']((entry) => ({
    id: entry['id'],
    badges: [
      { text: entry['version'], cls: GRAY },
      { text: entry['type'], cls: typeBadge[entry['type']] ?? GRAY },
    ],
    secondary: entry['title'],
  }));

  const renderEdit = (id: string, onClose: () => void) => {
    const recipe = recipeData['find']((it) => it['id'] === id);
    return recipe ? <RecipeEditDialog recipe={recipe} onClose={onClose} /> : null;
  };

  return <ItemListTab subtitle="Recipes 控制生成节点的提示词策略" searchPlaceholder="搜索 Recipe (ID、名称、类型)" items={items} editDialog={renderEdit} />;
}
