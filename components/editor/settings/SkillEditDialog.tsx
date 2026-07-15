'use client';

import { useState } from 'react';
import { EditDialogShell, FieldLabel } from './EditDialogShell';
import { TagInput } from './TagInput';
import { SkillItem } from '../../../lib/settingsData';

// 编辑 Skill 弹窗（结构复刻自原版：触发条件 + 规划配置）
// 注：成员访问使用 obj['prop'] 形式，规避构建工具对 word.word 记号的改写
export function SkillEditDialog({ skill, onClose }: { skill: SkillItem; onClose: () => void }) {
  const [category, setCategory] = useState(skill['category']);
  const [desc, setDesc] = useState(skill['desc']);
  const [keywords, setKeywords] = useState<string[]>(skill['keywords']);
  const [nodeTypes, setNodeTypes] = useState<string[]>(skill['nodeTypes']);
  const [planningHints, setPlanningHints] = useState(skill['metaPlanningHints']);
  const [styleGuide, setStyleGuide] = useState(skill['promptStyleGuide']);

  return (
    <EditDialogShell title={`编辑 Skill: ${skill['id']}`} onClose={onClose}>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <FieldLabel>ID</FieldLabel>
          <input value={skill['id']} disabled className="w-full h-10 rounded-lg border border-border bg-muted/30 px-3 text-sm font-mono text-muted-foreground" />
        </div>
        <div>
          <FieldLabel required>Category</FieldLabel>
          <input value={category} onChange={(ev) => setCategory(ev['currentTarget']['value'])} className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:border-ring transition-colors" />
        </div>
        <div>
          <FieldLabel required>Description</FieldLabel>
          <input value={desc} onChange={(ev) => setDesc(ev['currentTarget']['value'])} className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:border-ring transition-colors" />
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-foreground">触发条件</p>
        <p className="text-xs text-muted-foreground mt-0.5 mb-3">定义哪些关键词或节点类型会激活此 Skill</p>
        <FieldLabel required>关键词</FieldLabel>
        <TagInput value={keywords} onChange={setKeywords} placeholder="输入关键词后回车添加" />
        <p className="text-xs text-muted-foreground mt-1.5">支持 关键词:2 格式指定权重（默认权重 1）</p>
        <div className="mt-4">
          <FieldLabel>节点类型（可选）</FieldLabel>
          <TagInput value={nodeTypes} onChange={setNodeTypes} placeholder="输入节点类型后回车添加" />
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-foreground">规划配置</p>
        <p className="text-xs text-muted-foreground mt-0.5 mb-3">控制 Agent 在此领域的规划策略和提示词风格</p>
        <FieldLabel>规划提示（metaPlanningHints，可选）</FieldLabel>
        <textarea value={planningHints} onChange={(ev) => setPlanningHints(ev['currentTarget']['value'])} rows={4} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:border-ring transition-colors resize-none" />
        <div className="mt-4">
          <FieldLabel>风格指引（promptStyleGuide，可选）</FieldLabel>
          <textarea value={styleGuide} onChange={(ev) => setStyleGuide(ev['currentTarget']['value'])} rows={4} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:border-ring transition-colors resize-none" />
        </div>
      </div>
    </EditDialogShell>
  );
}
