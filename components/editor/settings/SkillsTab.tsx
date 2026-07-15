'use client';

import { ItemListTab, ListEntry } from './ItemListTab';
import { SkillEditDialog } from './SkillEditDialog';
import { SKILLS as skillData } from '../../../lib/settingsData';

const GRAY = 'text-muted-foreground border-border bg-muted/50';

// Skills 设置页（成员访问用 obj['prop']，规避构建工具改写）
export function SkillsTab() {
  const items: ListEntry[] = skillData['map']((entry) => ({
    id: entry['id'],
    badges: [
      { text: entry['version'], cls: GRAY },
      { text: entry['category'], cls: GRAY },
    ],
    secondary: entry['desc'],
  }));

  const renderEdit = (id: string, onClose: () => void) => {
    const skill = skillData['find']((it) => it['id'] === id);
    return skill ? <SkillEditDialog skill={skill} onClose={onClose} /> : null;
  };

  return <ItemListTab subtitle="Skills 控制 Agent 的领域行为和评估规则" searchPlaceholder="搜索 Skill (ID、描述、分类)" items={items} editDialog={renderEdit} />;
}
