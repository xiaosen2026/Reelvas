// 创建脚本：创造模式一键四栏故事板；修改模式基于已有正文修订

export type ScriptWorkMode = 'create' | 'revise';

export const SCRIPT_MODE_LABEL: Record<ScriptWorkMode, string> = {
  create: '创造',
  revise: '修改',
};

const SCRIPT_OUTPUT_RULES = `【输出硬性要求】
- 只要结果正文，中文输出。
- 禁止输出 HTML/XML 标签、禁止套 markdown 代码块、禁止复述用户原文、禁止写“根据您的需求”等客套。
- 比例 16:9 宽屏；画面从左到右横向四栏，每栏独立、细边框分隔；不要杂乱拼贴，不要自由散乱排版。
- 影视级质感，干净高级，无水印，无乱码文字。
- 角色外观、主色调、世界观在四栏内保持一致。

【最终正文必须按下列结构完整输出】

一张专业AI短剧前期视觉故事板，16：9宽屏比例，画面从左到右横向分成四个清晰区域，每个区域独立成栏，有细边框分隔，影视级质感，干净高级，无水印。

第一栏【短剧主视觉/封面定调】：展示《【短剧名称】》的核心海报级画面，【主角形象】占据第一栏主要面积，轮廓清楚，光影戏剧化，【视觉风格】，背景干净有层次，突出高级影视海报质感，画面中央或底部有短剧标题字，字体有设计感。

第二栏【人设细节/视觉锤】：3个微距特写，上下排列，浅景深，电影级打光，强化角色记忆点。
细节1：……
细节2：……
细节3：……

第三栏【剧情场景/情绪曲线】：3到4个高能剧情场景，上下排列，包含角色冲突、情绪爆发、环境氛围。人物动作有张力，表情戏剧化但不夸张。
场景1：……
场景2：……
场景3：……
场景4：……（可选）

第四栏【九宫格15秒爆点分镜】：3×3排列，编号1到9，每个格子代表一个连续镜头，严格按爆款短视频节奏设计。
镜头1：黄金3秒钩子-……
镜头2：人设亮相-……
镜头3：冲突升级-……
镜头4：细节特写-……
镜头5：核心反转-……
镜头6：视觉高潮-……
镜头7：情绪共鸣-……
镜头8：记忆强化-……
镜头9：悬念定格-……

短剧信息：
短剧名称：……
题材类型：……
核心看点：……
目标观众：……
核心场景：……
视觉风格：……
情绪基调：……
主色调：……
完播钩子：……

整体视觉要求：四栏风格统一；角色外观始终保持一致；整体呈现高级影视广告质感；画面干净；仅允许极少量中文标签（短剧主视觉、人设细节、剧情场景、九宫格分镜、镜头1至镜头9、情绪曲线）。

【质量标准】
- 时间节奏贴合约15秒短视频爆款：前3秒强钩子，中段冲突与反转，结尾悬念/标题收束。
- 特效与材质描述要可拍摄、可生成：写实材质、避免塑料感空话。
- 全部占位符必须用具体内容替换，不得保留【填写】字样。`;

/** 创造：从创意从零生成完整四栏故事板 */
export const SCRIPT_SYSTEM_PROMPT = `你是短剧 AI 前期视觉故事板专家。用户会给出一条短视频/短剧创意需求。你必须在一次回复内完成两步思考，但只输出最终故事板提示词正文。

【内部步骤，禁止写进正文】
1）先构思完整短视频创意：标题、场景、时间轴分镜（约15秒）、视觉关键、音效建议。
2）再把创意严格填入下方四栏故事板模板，生成可直接喂给文生图模型的中文提示词。

${SCRIPT_OUTPUT_RULES}`;

/** 修改：在已有故事板正文上按指令修订，非从零重写无关内容 */
export const SCRIPT_REVISE_SYSTEM_PROMPT = `你是短剧 AI 前期视觉故事板修订专家。用户会提供【现有故事板正文】与【修改要求】。你的任务是在保留未要求改动部分的前提下完成修订，并输出完整的四栏故事板提示词正文。

【内部原则，禁止写进正文】
1）先对照现有正文理解角色、风格、结构与镜头节奏。
2）仅按修改要求调整相关段落；未提及处尽量保持原表述与一致性。
3）若现有正文结构不完整，可补全为标准四栏结构，但角色与主设定以现有正文为准。
4）禁止无视现有正文另起炉灶（除非用户明确要求整篇重写）。

${SCRIPT_OUTPUT_RULES}`;

export const SCRIPT_USER_PREFIX =
  '请根据下列创意需求，直接输出完整的四栏故事板提示词正文（遵守 system 全部约束）：';

export const SCRIPT_REVISE_USER_PREFIX =
  '请根据【修改要求】修订【现有故事板正文】，输出修订后的完整四栏故事板提示词正文（遵守 system 全部约束）：';

export const SCRIPT_DEFAULT_PLACEHOLDER =
  '例如：生成一条15秒的短视频创意，要求是未来科技真实男性的打斗特效，能够制作爆款影视。';

export const SCRIPT_REVISE_PLACEHOLDER =
  '例如：把主角改成女性义体特工；主色调改为冷青；镜头5改成身份反转。';

export function parseScriptMode(raw: unknown): ScriptWorkMode {
  return raw === 'revise' ? 'revise' : 'create';
}

export function scriptSystemForMode(mode: ScriptWorkMode): string {
  return mode === 'revise' ? SCRIPT_REVISE_SYSTEM_PROMPT : SCRIPT_SYSTEM_PROMPT;
}

export function scriptPlaceholderForMode(mode: ScriptWorkMode): string {
  return mode === 'revise' ? SCRIPT_REVISE_PLACEHOLDER : SCRIPT_DEFAULT_PLACEHOLDER;
}

export function buildScriptUserMessage(
  idea: string,
  upstreamTexts: string[] = [],
  opts?: { mode?: ScriptWorkMode; baseDraft?: string },
): string {
  const mode = opts?.mode ?? 'create';
  const parts: string[] = [];
  const up = upstreamTexts.map((t) => t.trim()).filter(Boolean);
  const base = (opts?.baseDraft || '').trim();

  if (mode === 'revise') {
    if (base) {
      parts.push('【现有故事板正文】');
      parts.push(base);
    } else if (up.length) {
      parts.push('【现有故事板正文】');
      parts.push(up.join('\n\n---\n\n'));
    }
    if (base && up.length) {
      parts.push('【上游补充参考】');
      parts.push(up.join('\n\n---\n\n'));
    }
    parts.push(SCRIPT_REVISE_USER_PREFIX);
    parts.push(idea.trim());
    return parts.join('\n\n');
  }

  if (up.length) {
    parts.push('【上游参考】');
    parts.push(up.join('\n\n---\n\n'));
  }
  parts.push(SCRIPT_USER_PREFIX);
  parts.push(idea.trim());
  return parts.join('\n\n');
}

/** 修改模式是否具备可修订底稿 */
export function hasScriptReviseBase(resultText: string, upstreamTexts: string[]): boolean {
  if (resultText.trim()) return true;
  return upstreamTexts.some((t) => t.trim());
}
