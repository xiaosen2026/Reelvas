// Copilot 输入 @Skill 解析与高亮分段（CLI 风格）

import { SKILLS, type SkillItem } from './settingsData';
import { createLogger } from './logger';

const log = createLogger('copilotSkillMention');

/** @skill-id 形式：字母开头，可含数字/下划线/连字符 */
export const SKILL_MENTION_RE = /@([a-zA-Z][\w-]*)/g;

export interface SkillMention {
  id: string;
  raw: string;
  start: number;
  end: number;
  skill: SkillItem | null;
}

export interface HighlightSegment {
  text: string;
  kind: 'text' | 'skill' | 'skill-unknown';
  skillId?: string;
}

export function listSkillsForMention(): SkillItem[] {
  return SKILLS;
}

export function findSkillById(id: string): SkillItem | undefined {
  return SKILLS.find((s) => s.id === id || s.id.toLowerCase() === id.toLowerCase());
}

/** 从文本中提取全部 @mention */
export function parseSkillMentions(text: string): SkillMention[] {
  const out: SkillMention[] = [];
  if (!text) return out;
  const re = new RegExp(SKILL_MENTION_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const id = m[1];
    const skill = findSkillById(id) ?? null;
    out.push({
      id: skill?.id ?? id,
      raw: m[0],
      start: m.index,
      end: m.index + m[0].length,
      skill,
    });
  }
  return out;
}

/** 将输入拆成高亮分段 */
export function segmentSkillHighlights(text: string): HighlightSegment[] {
  if (!text) return [{ text: '', kind: 'text' }];
  const mentions = parseSkillMentions(text);
  if (mentions.length === 0) return [{ text, kind: 'text' }];

  const segs: HighlightSegment[] = [];
  let cursor = 0;
  for (const ment of mentions) {
    if (ment.start > cursor) {
      segs.push({ text: text.slice(cursor, ment.start), kind: 'text' });
    }
    segs.push({
      text: text.slice(ment.start, ment.end),
      kind: ment.skill ? 'skill' : 'skill-unknown',
      skillId: ment.id,
    });
    cursor = ment.end;
  }
  if (cursor < text.length) {
    segs.push({ text: text.slice(cursor), kind: 'text' });
  }
  return segs;
}

/** 光标前是否处于 @ 查询中，返回 query（不含 @） */
export function getActiveMentionQuery(
  text: string,
  caret: number,
): { start: number; query: string } | null {
  if (caret < 0 || caret > text.length) return null;
  const before = text.slice(0, caret);
  const at = before.lastIndexOf('@');
  if (at < 0) return null;
  // @ 前应为行首或空白/标点，避免邮箱
  if (at > 0) {
    const prev = before[at - 1];
    if (/[A-Za-z0-9_]/.test(prev)) return null;
  }
  const query = before.slice(at + 1);
  if (/[\s\n]/.test(query)) return null;
  if (query.length > 48) return null;
  return { start: at, query };
}

export function filterSkillsByQuery(query: string): SkillItem[] {
  const q = query.trim().toLowerCase();
  const all = listSkillsForMention();
  if (!q) return all;
  return all.filter(
    (s) =>
      s.id.toLowerCase().includes(q) ||
      s.category.toLowerCase().includes(q) ||
      s.desc.toLowerCase().includes(q),
  );
}

/**
 * 把 mention 对应的 Skill 规则拼进 system 附言
 */
export function buildSkillSystemAppendix(text: string): string {
  const mentions = parseSkillMentions(text);
  const seen = new Set<string>();
  const blocks: string[] = [];
  for (const m of mentions) {
    if (!m.skill || seen.has(m.skill.id)) continue;
    seen.add(m.skill.id);
    const s = m.skill;
    blocks.push(
      [
        `### Skill @${s.id} (${s.category}, ${s.version})`,
        s.desc ? `描述：${s.desc}` : '',
        s.metaPlanningHints ? `规划提示：\n${s.metaPlanningHints}` : '',
        s.promptStyleGuide ? `风格指引：\n${s.promptStyleGuide}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    );
  }
  if (blocks.length === 0) {
    log.debug('buildSkillSystemAppendix', 'no valid skills', {
      raw: mentions.map((x) => x.raw),
    });
    return '';
  }
  log.info('buildSkillSystemAppendix', 'injected', { skills: [...seen] });
  return `\n\n【用户 @ 引用的 Skills — 必须遵循】\n${blocks.join('\n\n')}`;
}

/** 在 start 处把 @query 替换为 @skillId + 空格 */
export function applySkillMention(
  text: string,
  mentionStart: number,
  caret: number,
  skillId: string,
): { text: string; caret: number } {
  const insert = `@${skillId} `;
  const next = text.slice(0, mentionStart) + insert + text.slice(caret);
  return { text: next, caret: mentionStart + insert.length };
}
