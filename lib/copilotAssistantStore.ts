// 会话助手配置：Ask / Agent 的 system prompt 与 tool call 开关（localStorage）

import { createLogger } from './logger';

const log = createLogger('copilotAssistantStore');
/** v5：Ask/Agent + 节点读写提交 tool + summarize_context */
const STORAGE_KEY = 'reelvas.copilotAssistant.v5';

export type CopilotMode = 'Ask' | 'Agent';

export interface ToolCallConfig {
  id: string;
  name: string;
  desc: string;
  enabled: boolean;
}

export interface ModeAssistantConfig {
  systemPrompt: string;
  tools: ToolCallConfig[];
}

export type AssistantConfigMap = Record<CopilotMode, ModeAssistantConfig>;

export const COPILOT_MODES: CopilotMode[] = ['Ask', 'Agent'];

const DEFAULT_TOOLS: Record<CopilotMode, ToolCallConfig[]> = {
  Ask: [
    {
      id: 'read_canvas_summary',
      name: 'read_canvas_summary',
      desc: '只读：概述当前画布节点与连线（不修改）',
      enabled: true,
    },
    {
      id: 'search_skills',
      name: 'search_skills',
      desc: '检索内置 Skills 说明',
      enabled: true,
    },
  ],
  Agent: [
    {
      id: 'read_canvas_summary',
      name: 'read_canvas_summary',
      desc: '只读：概述当前画布',
      enabled: true,
    },
    {
      id: 'list_node_types',
      name: 'list_node_types',
      desc: '列出可创建的 menu_type',
      enabled: true,
    },
    {
      id: 'list_skills',
      name: 'list_skills',
      desc: '列出可用 Skills',
      enabled: true,
    },
    {
      id: 'plan_canvas_actions',
      name: 'plan_canvas_actions',
      desc: '规划画布动作草案',
      enabled: true,
    },
    {
      id: 'ask_user',
      name: 'ask_user',
      desc: '弹窗请用户选择下一步（等回答后继续）',
      enabled: true,
    },
    {
      id: 'get_node',
      name: 'get_node',
      desc: '读取指定节点状态/参数',
      enabled: true,
    },
    {
      id: 'update_node',
      name: 'update_node',
      desc: '修改单个节点 data/位置',
      enabled: true,
    },
    {
      id: 'update_nodes',
      name: 'update_nodes',
      desc: '批量修改节点参数',
      enabled: true,
    },
    {
      id: 'submit_nodes',
      name: 'submit_nodes',
      desc: '触发节点真正生成（等同点生成）',
      enabled: true,
    },
    {
      id: 'list_node_fields',
      name: 'list_node_fields',
      desc: '列出节点可写字段参考',
      enabled: true,
    },
    {
      id: 'summarize_context',
      name: 'summarize_context',
      desc: '压缩长对话上下文',
      enabled: true,
    },
    {
      id: 'build_workflow',
      name: 'build_workflow',
      desc: '按业务目标一键搭流水线（优先）',
      enabled: true,
    },
    {
      id: 'create_nodes',
      name: 'create_nodes',
      desc: '批量创建节点（真实落盘）',
      enabled: true,
    },
    {
      id: 'create_or_update_nodes',
      name: 'create_or_update_nodes',
      desc: '创建或更新节点',
      enabled: true,
    },
    {
      id: 'connect_nodes',
      name: 'connect_nodes',
      desc: '创建 source→target 连线',
      enabled: true,
    },
    {
      id: 'layout_nodes',
      name: 'layout_nodes',
      desc: '网格/流水线排布',
      enabled: true,
    },
    {
      id: 'delete_nodes',
      name: 'delete_nodes',
      desc: '按 id 删除节点',
      enabled: true,
    },
  ],
};

const DEFAULT_PROMPTS: Record<CopilotMode, string> = {
  Ask: `你是 Reelvas 画布助手（Ask 模式）。
- 只回答问题、解释概念、给建议，不规划多步执行，不声称已修改画布。
- 用简体中文，简洁专业。
- 若用户 @ 了 Skill，严格遵循该 Skill 的领域规则与风格指引。
- 不知道的信息如实说明，不要编造 API/扣费调用结果。`,
  Agent: `你是 Reelvas 短剧/视频工作流 Agent。

【角色】帮用户把创意落地为画布节点工作流；写视频提示词时默认遵循下方 Seedance 2.0 导演规则（MIT，来源 github.com/Emily2040/seedance-2.0）。

【典型任务】
- 短剧：剧本→角色卡→生图→分镜→视频
- 电商：上传→抠图→设计稿→视频
- 分析：查看画布给出建议

【画布流程】
1. text 节点：角色卡/剧本摘要
2. upload 节点：参考图/参考视频
3. image 节点：关键场景静帧
4. storyboard 节点：分镜组织（可选）
5. video 节点：提示词写清景别/运镜/光线/声音；参考用 @Image/@Video 绑定
6. 连线：upload→image→video（或首尾帧链路）

【生成权限】
用户勾选了 image/video/audio/music 权限的，才自动提交对应生成；未勾选只建节点不提交。

【工具使用】
完整流水线优先 build_workflow；补节点用 create_nodes + connect_nodes。
精细控制：get_node → update_node（改 prompt/model 等）→ submit_nodes（真正提交生成）。
目标不清或有多条互斥路线时，必须 call ask_user 弹窗等用户点选后再继续，禁止只在文本里写「你下一步怎么选」然后结束。
对话过长时 call summarize_context 压缩后再继续。
完成用中文总结。禁止编造 API/扣费调用成功。

【Seedance 2.0 · 默认视频提示词 OS】
（用户无需 @；写/改/排查视频提示词时一律启用。可另 @seedance-2 查看完整 skill 说明。）

一、原则
1. 听懂意图：用户说的是感觉与结果，你要译成可拍的镜头语言，不要把参数题甩回用户。
2. 故事连续：跨多轮记住主体、模式、参考、已定约束与失败点；不要让用户重复已确认的决定。
3. 对人口径：对新手说人话，对专业用户可用导演术语；标准不降。

二、快车道（默认）
单段、非专家、无 IP/肖像/品牌/安全风险、无平台事实题时：
- 直接写简报 + 紧凑提示词；一个可见动作 + 一个动机运镜 + 一个真实光源 + 声音意图。
- 单 clip 约 40–110 词（中文等价紧凑）；导演内部分析可长，给用户的成稿要短。
- 先出第一段；仅当用户说继续/加长/下一段，或故事明显装不进一段时，再升级为序列。

三、中文提示词硬规则
- 参考标签原样保留：@Image1 / @Video1 / @Audio1 / @图片1 / @视频1，禁止翻译或改写。
- 顺序：先参考角色绑定 → 动作 → 镜头 → 光线 → 声音 → 约束。
- 禁止空泛词：电影感/高级感/氛围感/大片感 → 拆成景别、运镜、光源、材质、色彩、空气。
- 不要让模型生成最终字幕、广告文案、法务文案；剪辑阶段再加。
- 连续剧情禁止一次写完整结局：先 Clip01，用真实结尾写 Clip02。

四、紧凑模板
- T2V：[主体][动作与终点] 在 [场景]。镜头：[一个运镜]。光：[真实光源]。声：[意图]。约束：[连续性/安全]。
- I2V：@Image1 为参考，严格保持[主体/logo/脸]不变；仅改变[动作/光/镜头]。镜头：…。声音：…。
- 首尾帧：@图片1 为首帧，@图片2 为尾帧；保持同一主体与布局，动作连续不跳切，自然过渡到尾帧姿势。
- 中文范例：@Image1为产品参考，严格保持logo、标签、瓶身形状和颜色不变。仅改变光线和微小动作：左侧暖色条形光扫过玻璃，水珠沿瓶身缓慢下滑。镜头固定产品近景，轻微推镜到标签。声音：低环境声，结尾一声轻微玻璃声。不要新增字幕、水印或无关文字。

五、序列（多段）
- 先定故事目标与最终结果，再拆场景与 clip；每 clip 只做一个可见任务 + 一个完成终点。
- 模板：项目目标 / 已发生 / 本段只拍 / 不能提前出现 / 参考绑定 / 提示词。
- 已接受成片的观察状态优先于计划；拒绝的镜头不得当续写源。
- 场景内可链式续写；跨场景用规范参考重新锚定，重置 extension 深度。

六、安全改写
受保护角色/明星/品牌/歌曲/真实人脸或声音：保留创意功能，改成原创角色、原创世界、已授权参考或后期方案；禁止用换语言/谐音规避。

七、与画布结合
- 写进 video/image 节点的 prompt 字段时遵守上述规则。
- 用户有参考素材时优先 upload/image 连到 video，并在文案中用 @ 指明角色（身份/首帧/尾帧/运镜/节奏）。
- 排查烂片：先找根因（身份漂移、动作过多、光无动机、空泛形容词），再改一个变量重试。`,
};

function cloneDefaults(): AssistantConfigMap {
  return {
    Ask: {
      systemPrompt: DEFAULT_PROMPTS.Ask,
      tools: DEFAULT_TOOLS.Ask.map((t) => ({ ...t })),
    },
    Agent: {
      systemPrompt: DEFAULT_PROMPTS.Agent,
      tools: DEFAULT_TOOLS.Agent.map((t) => ({ ...t })),
    },
  };
}

function normalizeMode(raw: unknown, mode: CopilotMode): ModeAssistantConfig {
  const base = cloneDefaults()[mode];
  if (!raw || typeof raw !== 'object') return base;
  const o = raw as Partial<ModeAssistantConfig>;
  if (typeof o.systemPrompt === 'string' && o.systemPrompt.trim()) {
    base.systemPrompt = o.systemPrompt;
  }
  if (Array.isArray(o.tools)) {
    const byId = new Map(
      o.tools
        .filter((t): t is ToolCallConfig => !!t && typeof t === 'object' && typeof (t as ToolCallConfig).id === 'string')
        .map((t) => [t.id, t]),
    );
    base.tools = base.tools.map((t) => {
      const hit = byId.get(t.id);
      if (!hit) return t;
      return {
        ...t,
        enabled: typeof hit.enabled === 'boolean' ? hit.enabled : t.enabled,
        name: typeof hit.name === 'string' && hit.name.trim() ? hit.name : t.name,
        desc: typeof hit.desc === 'string' && hit.desc.trim() ? hit.desc : t.desc,
      };
    });
    // 允许用户自定义追加的 tool（仅保留合法字段）
    byId.forEach((t, id) => {
      if (base.tools.some((x) => x.id === id)) return;
      if (!t.name?.trim()) return;
      base.tools.push({
        id,
        name: t.name.trim(),
        desc: (t.desc || '').trim() || id,
        enabled: !!t.enabled,
      });
    });
  }
  return base;
}

function normalize(raw: unknown): AssistantConfigMap {
  const base = cloneDefaults();
  if (!raw || typeof raw !== 'object') return base;
  const o = raw as Partial<Record<CopilotMode, unknown>>;
  (COPILOT_MODES as CopilotMode[]).forEach((m) => {
    base[m] = normalizeMode(o[m], m);
  });
  return base;
}

function read(): AssistantConfigMap {
  if (typeof window === 'undefined') return cloneDefaults();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return cloneDefaults();
    return normalize(JSON.parse(raw));
  } catch (err) {
    log.warn('read', 'parse failed', { err: err instanceof Error ? err.message : String(err) });
    return cloneDefaults();
  }
}

function write(map: AssistantConfigMap): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch (err) {
    log.warn('write', 'save failed', { err: err instanceof Error ? err.message : String(err) });
  }
}

export function getAssistantConfigMap(): AssistantConfigMap {
  return read();
}

export function getModeAssistantConfig(mode: CopilotMode): ModeAssistantConfig {
  return read()[mode];
}

export function setModeAssistantConfig(
  mode: CopilotMode,
  patch: Partial<ModeAssistantConfig>,
): AssistantConfigMap {
  const cur = read();
  const nextMode: ModeAssistantConfig = {
    systemPrompt: (patch.systemPrompt ?? cur[mode].systemPrompt).trim() || DEFAULT_PROMPTS[mode],
    tools: patch.tools ? patch.tools.map((t) => ({ ...t })) : cur[mode].tools.map((t) => ({ ...t })),
  };
  const next = { ...cur, [mode]: nextMode };
  write(next);
  log.info('setModeAssistantConfig', 'saved', {
    mode,
    toolsOn: nextMode.tools.filter((t) => t.enabled).length,
  });
  return next;
}

export function setToolEnabled(mode: CopilotMode, toolId: string, enabled: boolean): AssistantConfigMap {
  const cur = read();
  const tools = cur[mode].tools.map((t) => (t.id === toolId ? { ...t, enabled } : t));
  return setModeAssistantConfig(mode, { tools });
}

export function resetModeAssistantConfig(mode: CopilotMode): AssistantConfigMap {
  const cur = read();
  const next = { ...cur, [mode]: cloneDefaults()[mode] };
  write(next);
  log.info('resetModeAssistantConfig', 'reset', { mode });
  return next;
}

export function getDefaultModePrompt(mode: CopilotMode): string {
  return DEFAULT_PROMPTS[mode];
}

/** 把启用的 tools 拼进 system 附言（模型侧可见约定，尚未真实 function-call 时用文字约束） */
export function formatToolsForSystem(tools: ToolCallConfig[]): string {
  const on = tools.filter((t) => t.enabled);
  if (on.length === 0) {
    return '\n\n【Tool Call】当前模式未启用任何工具；仅文字回复。';
  }
  const lines = on.map((t) => `- ${t.name}: ${t.desc}`).join('\n');
  return `\n\n【可用 Tool Call】（若运行时未挂载真实工具，请用文字说明将如何调用，勿伪造执行结果）\n${lines}`;
}

export function isCopilotMode(v: string): v is CopilotMode {
  return (COPILOT_MODES as string[]).includes(v);
}
