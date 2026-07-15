// Copilot 画布 Tool 定义 + 执行（Ask 只读 / Plan 规划 / Agent 可写）
// OpenAI tools schema；执行依赖 WorkflowHandle（CanvasFlowCore）

import type { WorkflowHandle } from '../components/editor/CanvasFlowCore';
import { nodeConfigs } from '../components/editor/nodes';
import type { FlowEdge, FlowNode } from '../components/editor/flow/types';
import { GRID_SIZE } from '../components/editor/flow/constants';
import type { CopilotMode, ToolCallConfig } from './copilotAssistantStore';
import { createLogger } from './logger';
import {
  NODE_TOOL_NAMES,
  NODE_TOOL_SCHEMAS,
  executeNodeTool,
} from './copilotNodeTools';

const log = createLogger('copilotCanvasTools');

/** Agent 排布：节点之间固定空 3 格网格（GRID_SIZE=20 → 60px） */
const NODE_GAP_GRIDS = 3;
const NODE_GAP_PX = GRID_SIZE * NODE_GAP_GRIDS;

/** OpenAI function tool 形态 */
export type OpenAITool = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

const MENU_TYPES = Object.keys(nodeConfigs);

const TOOL_SCHEMAS: Record<string, OpenAITool> = {
  read_canvas_summary: {
    type: 'function',
    function: {
      name: 'read_canvas_summary',
      description:
        '只读：返回当前画布节点与连线摘要（id/type/label/位置/关键 data 字段）。回答画布问题前应先调用。',
      parameters: {
        type: 'object',
        properties: {
          include_data_keys: {
            type: 'boolean',
            description: '是否附带每个节点 data 的关键字段预览，默认 true',
          },
        },
      },
    },
  },
  list_node_types: {
    type: 'function',
    function: {
      name: 'list_node_types',
      description: '列出可创建的节点 menuType（create_nodes 必须用这些 key）及默认尺寸',
      parameters: { type: 'object', properties: {} },
    },
  },
  list_skills: {
    type: 'function',
    function: {
      name: 'list_skills',
      description: '列出内置 Skills 的 id 与简介（规划/创作时可参考）',
      parameters: { type: 'object', properties: {} },
    },
  },
  search_skills: {
    type: 'function',
    function: {
      name: 'search_skills',
      description: '按关键词检索内置 Skills',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '关键词，如 短剧、电商、广告' },
        },
        required: ['query'],
      },
    },
  },
  draft_workflow_plan: {
    type: 'function',
    function: {
      name: 'draft_workflow_plan',
      description:
        '把分步计划结构化登记（不修改画布）。步骤应含节点类型与连线意图。',
      parameters: {
        type: 'object',
        properties: {
          goal: { type: 'string', description: '用户目标一句话' },
          steps: {
            type: 'array',
            description: '有序步骤',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                detail: { type: 'string' },
                menu_types: {
                  type: 'array',
                  items: { type: 'string' },
                  description: '本步涉及的 nodeConfigs menuType',
                },
              },
              required: ['title'],
            },
          },
        },
        required: ['goal', 'steps'],
      },
    },
  },
  plan_canvas_actions: {
    type: 'function',
    function: {
      name: 'plan_canvas_actions',
      description:
        '输出将要执行的画布动作草案（create/connect/update）。可仅登记规划，Agent 随后可真正 create/connect。',
      parameters: {
        type: 'object',
        properties: {
          actions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                op: {
                  type: 'string',
                  enum: ['create', 'connect', 'update', 'delete'],
                },
                menu_type: { type: 'string' },
                source_id: { type: 'string' },
                target_id: { type: 'string' },
                note: { type: 'string' },
              },
              required: ['op'],
            },
          },
        },
        required: ['actions'],
      },
    },
  },
  create_nodes: {
    type: 'function',
    function: {
      name: 'create_nodes',
      description:
        'Agent：在画布创建一个或多个节点。menu_type 必须是 list_node_types 返回的 key。可指定 x/y 与 data（如 prompt）。返回新建 id 列表，后续 connect_nodes 要用。',
      parameters: {
        type: 'object',
        properties: {
          nodes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                menu_type: {
                  type: 'string',
                  description: `之一: ${MENU_TYPES.join(', ')}`,
                },
                x: { type: 'number' },
                y: { type: 'number' },
                id: { type: 'string', description: '可选自定义 id' },
                data: {
                  type: 'object',
                  description: '写入节点 data，如 { prompt, label, value }',
                  additionalProperties: true,
                },
              },
              required: ['menu_type'],
            },
          },
        },
        required: ['nodes'],
      },
    },
  },
  create_or_update_nodes: {
    type: 'function',
    function: {
      name: 'create_or_update_nodes',
      description:
        'Agent：创建新节点或更新已有节点 data/位置。更新时传 id；创建时传 menu_type。',
      parameters: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', description: '已有节点 id → 更新' },
                menu_type: { type: 'string', description: '新建时必填' },
                x: { type: 'number' },
                y: { type: 'number' },
                data: { type: 'object', additionalProperties: true },
              },
            },
          },
        },
        required: ['items'],
      },
    },
  },
  connect_nodes: {
    type: 'function',
    function: {
      name: 'connect_nodes',
      description:
        'Agent：创建有向连线 source → target（上游输出到下游输入）。两端必须是已有节点 id。',
      parameters: {
        type: 'object',
        properties: {
          edges: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                source: { type: 'string' },
                target: { type: 'string' },
              },
              required: ['source', 'target'],
            },
          },
        },
        required: ['edges'],
      },
    },
  },
  delete_nodes: {
    type: 'function',
    function: {
      name: 'delete_nodes',
      description: 'Agent：按 id 删除节点及其相关连线',
      parameters: {
        type: 'object',
        properties: {
          ids: { type: 'array', items: { type: 'string' } },
        },
        required: ['ids'],
      },
    },
  },
  layout_nodes: {
    type: 'function',
    function: {
      name: 'layout_nodes',
      description: 'Agent：简易网格/流水线排布，整理当前画布节点位置',
      parameters: {
        type: 'object',
        properties: {
          mode: {
            type: 'string',
            enum: ['flow', 'grid'],
            description: 'flow=按连线层级从左到右；grid=简单网格',
          },
          gap_x: {
            type: 'number',
            description: `节点水平净间距（px），默认 ${NODE_GAP_PX}=${NODE_GAP_GRIDS} 格网格`,
          },
          gap_y: {
            type: 'number',
            description: `节点垂直净间距（px），默认 ${NODE_GAP_PX}=${NODE_GAP_GRIDS} 格网格`,
          },
          origin_x: { type: 'number' },
          origin_y: { type: 'number' },
        },
      },
    },
  },
  /**
   * 高层：用户说业务目标时优先用这个，一次创建流水线节点+连线+排布
   * 例：「电商抠图设计工作流」→ upload→image(抠图)→image(设计稿)→…
   */
  build_workflow: {
    type: 'function',
    function: {
      name: 'build_workflow',
      description: `根据用户业务目标，在画布上一次性搭建「节点流水线」：按顺序创建节点、从左到右连线、自动排布。
用户通常说的是目标而不是 API，例如：
- 「做一个电商抠图设计工作流」
- 「短剧分镜：剧本到分镜图到视频」
- 「产品图上传后扩图再出视频」
你要把意图翻译成 steps[].menu_type 流水线，并尽量填 data.prompt / data.label。
menu_type 只能用: ${MENU_TYPES.join(', ')}
常见映射：
- 上传/素材 → upload
- 文案/提示词/剧本 → text 或 input 或 script
- 生图/抠图/设计稿/海报 → image（prompt 写清任务）
- 增强/超分 → upscale
- 扩图 → outpaint
- 视频 → video
- 配音 → tts 或 audio
- 分镜格子 → storyboard
- 全景 → panorama
- 便签说明 → note
不要等用户说 create_nodes；有业务目标就直接 build_workflow。`,
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: '工作流短标题，如「电商抠图设计」',
          },
          steps: {
            type: 'array',
            description: '从左到右的流水线步骤（顺序即连线顺序）',
            items: {
              type: 'object',
              properties: {
                menu_type: {
                  type: 'string',
                  description: `节点类型 key：${MENU_TYPES.join(', ')}`,
                },
                label: { type: 'string', description: '节点显示名，如「产品上传」「抠图」' },
                prompt: {
                  type: 'string',
                  description: '写入 data.prompt 的任务说明/提示词（图/视频/文本节点很有用）',
                },
                data: {
                  type: 'object',
                  additionalProperties: true,
                  description: '额外 data 字段',
                },
              },
              required: ['menu_type'],
            },
          },
          origin_x: { type: 'number', description: '起点 x，默认 80' },
          origin_y: { type: 'number', description: '起点 y，默认 120' },
          gap_x: {
            type: 'number',
            description: `相邻节点水平净间距（px），默认 ${NODE_GAP_PX}（${NODE_GAP_GRIDS} 格×${GRID_SIZE}px）`,
          },
        },
        required: ['steps'],
      },
    },
  },
  ask_user: {
    type: 'function',
    function: {
      name: 'ask_user',
      description:
        '向用户弹出选择题并等待回答后再继续。当有 2 个及以上互斥方案、需要用户拍板下一步时必须调用；禁止只在文本里写「你下一步怎么选」然后结束。',
      parameters: {
        type: 'object',
        properties: {
          question: {
            type: 'string',
            description: '简短问题，展示在弹窗标题区',
          },
          options: {
            type: 'array',
            description: '2–6 个互斥选项',
            minItems: 2,
            maxItems: 6,
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', description: '稳定 id，如 short-drama / ecommerce' },
                label: { type: 'string', description: '按钮文案，简体中文' },
              },
              required: ['id', 'label'],
            },
          },
          allow_free_text: {
            type: 'boolean',
            description: '是否允许用户自定义输入，默认 false',
          },
        },
        required: ['question', 'options'],
      },
    },
  },
};

/** 模式 → 允许挂载的 tool 名（再与用户 enabled 配置求交） */
const MODE_TOOL_ALLOW: Record<CopilotMode, string[]> = {
  Ask: ['read_canvas_summary', 'list_node_types', 'list_skills', 'search_skills'],
  Agent: [
    'read_canvas_summary',
    'list_node_types',
    'list_skills',
    'search_skills',
    'plan_canvas_actions',
    'ask_user',
    'get_node',
    'update_node',
    'update_nodes',
    'submit_nodes',
    'list_node_fields',
    'summarize_context',
    // 业务目标优先：一键流水线
    'build_workflow',
    'create_nodes',
    'create_or_update_nodes',
    'connect_nodes',
    'delete_nodes',
    'layout_nodes',
  ],
};

/**
 * 根据模式与会话助手里启用的 tools，生成 OpenAI tools 数组。
 * 配置里未列出的 schema 工具，Agent 仍可按 MODE_TOOL_ALLOW 挂载（方便开箱即用）。
 */
export function buildOpenAIToolsForMode(
  mode: CopilotMode,
  configured: ToolCallConfig[],
): OpenAITool[] {
  const allow = new Set(MODE_TOOL_ALLOW[mode] || []);
  const enabledNames = new Set(
    configured.filter((t) => t.enabled).map((t) => t.name || t.id),
  );
  // 用户关掉的 id 要从 allow 去掉
  configured.forEach((t) => {
    if (!t.enabled) {
      allow.delete(t.id);
      allow.delete(t.name);
    }
  });
  // 配置里显式启用但未在默认 allow 的，Agent 可附加
  enabledNames.forEach((n) => {
    if (TOOL_SCHEMAS[n] && mode === 'Agent') allow.add(n);
  });

  const tools: OpenAITool[] = [];
  allow.forEach((name) => {
    const sch = TOOL_SCHEMAS[name] || NODE_TOOL_SCHEMAS[name] || (name === 'summarize_context' ? SUMMARIZE_TOOL_SCHEMA : undefined);
    if (sch) tools.push(sch);
  });
  log.info('buildOpenAIToolsForMode', 'ok', {
    mode,
    n: tools.length,
    names: tools.map((t) => t.function.name),
  });
  return tools;
}

export function getCanvasToolGuideText(mode: CopilotMode): string {
  if (mode === 'Ask') {
    return `\n\n【画布工具】Ask 模式仅只读：需要了解画布时先 call read_canvas_summary；可用 list_node_types / list_skills。禁止创建/连线。`;
  }
  return `\n\n【画布工具 · Agent · 重要】
用户说话方式是业务目标，不是工程师指令。例如：
「我需要做一个电商设计抠图设计工作流」→ 你应直接 call build_workflow，而不是让用户再说 create_nodes。

推荐流程：
	1. （可选）read_canvas_summary 看现有画布，避免重复。
	2. 目标不明确或有多条互斥路线 → 必须 call ask_user 弹出选项等用户点选，禁止只在文本里写「你下一步怎么选」然后结束。
	3. 目标明确后立刻 call build_workflow（优先）或 create_nodes+connect_nodes。
	4. 精细改某个节点：get_node → update_node（写 prompt/model 等）→ submit_nodes（真正点生成）。
	5. 对话过长、token 吃紧：call summarize_context 压缩旧轮次后再继续。
	6. 用中文简短说明搭好了什么；不要只回复计划而不 call 工具。

	节点控制 tool：
	- get_node / update_node / update_nodes / submit_nodes / list_node_fields
	- 改参不会自动生成；要出图/出视频必须 submit_nodes
	- 提交前确认用户已授权对应 image/video/audio 权限

	意图 → menu_type 速查：
	上传/原图 → upload | 文案/提示词 → text 或 input | 生图/抠图/海报/设计 → image
	增强 → upscale | 扩图 → outpaint | 视频 → video | 配音 → tts | 分镜 → storyboard | 说明 → note
	可用 menu_type: ${MENU_TYPES.join(', ')}
	节点 tool: ${NODE_TOOL_NAMES.join(', ')}, summarize_context`;
}

/** 上下文总结 tool（Agent；宿主在 run loop 侧执行真正压缩） */
export const SUMMARIZE_TOOL_SCHEMA: OpenAITool = {
  type: 'function',
  function: {
    name: 'summarize_context',
    description:
      '压缩当前对话上下文：保留最近若干轮原文，更早内容折叠为摘要。对话很长、重复工具结果多、或接近上下文上限时调用。不修改画布。',
    parameters: {
      type: 'object',
      properties: {
        keep_last_turns: {
          type: 'number',
          description: '保留最近多少条消息（默认 8，范围 4–40）',
        },
        note: {
          type: 'string',
          description: '写入摘要的一句话焦点',
        },
      },
    },
  },
};

function previewData(data: Record<string, unknown>): Record<string, unknown> {
  const keys = [
    'label',
    'prompt',
    'value',
    'model',
    'status',
    'error',
    'videoMode',
    'fileName',
    'mediaKind',
  ];
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    const v = data[k];
    if (v == null || v === '') continue;
    if (typeof v === 'string' && v.length > 120) out[k] = `${v.slice(0, 120)}…`;
    else if (typeof v === 'string' && v.startsWith('data:')) out[k] = `dataURL(len=${v.length})`;
    else out[k] = v;
  }
  return out;
}

function layoutFlow(nodes: FlowNode[], edges: FlowEdge[], gapX: number, gapY: number, ox: number, oy: number): FlowNode[] {
  const ids = new Set(nodes.map((n) => n.id));
  const indeg = new Map<string, number>();
  const outs = new Map<string, string[]>();
  nodes.forEach((n) => {
    indeg.set(n.id, 0);
    outs.set(n.id, []);
  });
  edges.forEach((e) => {
    if (!ids.has(e.source) || !ids.has(e.target)) return;
    indeg.set(e.target, (indeg.get(e.target) || 0) + 1);
    outs.get(e.source)?.push(e.target);
  });
  const layer = new Map<string, number>();
  const q = nodes.filter((n) => (indeg.get(n.id) || 0) === 0).map((n) => n.id);
  q.forEach((id) => layer.set(id, 0));
  const seen = new Set(q);
  while (q.length) {
    const id = q.shift()!;
    const L = layer.get(id) || 0;
    for (const t of outs.get(id) || []) {
      layer.set(t, Math.max(layer.get(t) || 0, L + 1));
      if (!seen.has(t)) {
        seen.add(t);
        q.push(t);
      }
    }
  }
  nodes.forEach((n) => {
    if (!layer.has(n.id)) layer.set(n.id, 0);
  });
  const byLayer = new Map<number, FlowNode[]>();
  nodes.forEach((n) => {
    const L = layer.get(n.id) || 0;
    if (!byLayer.has(L)) byLayer.set(L, []);
    byLayer.get(L)!.push(n);
  });
  const next: FlowNode[] = [];
  const sortedLayers = [...byLayer.keys()].sort((a, b) => a - b);
  sortedLayers.forEach((L) => {
    const list = byLayer.get(L)!;
    list.forEach((n, i) => {
      const w = n.style?.width ?? 400;
      next.push({
        ...n,
        position: { x: ox + L * (w + gapX), y: oy + i * gapY },
      });
    });
  });
  return next;
}

function layoutGrid(nodes: FlowNode[], gapX: number, gapY: number, ox: number, oy: number): FlowNode[] {
  const cols = Math.max(1, Math.ceil(Math.sqrt(nodes.length)));
  return nodes.map((n, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const w = n.style?.width ?? 400;
    const h = n.style?.height ?? 300;
    return {
      ...n,
      position: { x: ox + col * (w + gapX), y: oy + row * (h + gapY) },
    };
  });
}

export type ToolExecResult = {
  name: string;
  ok: boolean;
  result: unknown;
};

export function executeCanvasTool(
  name: string,
  argsRaw: string | Record<string, unknown>,
  handle: WorkflowHandle | null | undefined,
): ToolExecResult {
  let args: Record<string, unknown> = {};
  try {
    args =
      typeof argsRaw === 'string'
        ? argsRaw.trim()
          ? (JSON.parse(argsRaw) as Record<string, unknown>)
          : {}
        : argsRaw || {};
  } catch {
    return { name, ok: false, result: { error: 'arguments JSON 解析失败', raw: String(argsRaw).slice(0, 200) } };
  }

  log.info('executeCanvasTool', 'run', { name, keys: Object.keys(args) });

  try {
    switch (name) {
      case 'ask_user': {
        // 实际弹窗由 runCopilotSend 的 onAskUser 处理；此处仅作无 UI 回退
        return {
          name,
          ok: false,
          result: {
            error: 'ask_user 需宿主弹窗',
            pending: true,
            question: String(args.question || ''),
          },
        };
      }
      case 'read_canvas_summary': {
        if (!handle) return { name, ok: false, result: { error: '画布未就绪' } };
        const nodes = handle.getNodes();
        const edges = handle.getEdges();
        const includeData = args.include_data_keys !== false;
        return {
          name,
          ok: true,
          result: {
            nodeCount: nodes.length,
            edgeCount: edges.length,
            nodes: nodes.map((n) => ({
              id: n.id,
              type: n.type,
              x: Math.round(n.position.x),
              y: Math.round(n.position.y),
              w: n.style?.width,
              h: n.style?.height,
              label: n.data?.label,
              ...(includeData ? { data: previewData(n.data || {}) } : {}),
            })),
            edges: edges.map((e) => ({
              id: e.id,
              source: e.source,
              target: e.target,
            })),
            menuTypes: MENU_TYPES,
          },
        };
      }
      case 'list_node_types': {
        return {
          name,
          ok: true,
          result: {
            types: MENU_TYPES.map((k) => {
              const c = nodeConfigs[k];
              return {
                menu_type: k,
                flow_type: c.type,
                label: c.labelPrefix,
                width: c.width,
                height: c.height,
              };
            }),
          },
        };
      }
      case 'list_skills':
      case 'search_skills': {
        // 延迟读 settingsData，避免环依赖
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { SKILLS } = require('./settingsData') as {
          SKILLS: Array<{ id: string; name: string; description?: string; category?: string }>;
        };
        const q = String(args.query || '').toLowerCase();
        let list = SKILLS || [];
        if (name === 'search_skills' && q) {
          list = list.filter(
            (s) =>
              s.id.toLowerCase().includes(q) ||
              s.name.toLowerCase().includes(q) ||
              (s.description || '').toLowerCase().includes(q) ||
              (s.category || '').toLowerCase().includes(q),
          );
        }
        return {
          name,
          ok: true,
          result: {
            skills: list.map((s) => ({
              id: s.id,
              name: s.name,
              description: (s.description || '').slice(0, 160),
              category: s.category,
            })),
          },
        };
      }
      case 'draft_workflow_plan':
      case 'plan_canvas_actions': {
        return {
          name,
          ok: true,
          result: {
            recorded: true,
            note: '计划已登记，未修改画布',
            payload: args,
          },
        };
      }
      case 'create_nodes': {
        if (!handle) return { name, ok: false, result: { error: '画布未就绪' } };
        const list = Array.isArray(args.nodes) ? args.nodes : [];
        const created: Array<{ id: string; menu_type: string }> = [];
        const errors: string[] = [];
        list.forEach((item, i) => {
          const it = item as Record<string, unknown>;
          const menuType = String(it.menu_type || '');
          const r = handle.agentCreateNode({
            menuType,
            x: typeof it.x === 'number' ? it.x : undefined,
            y: typeof it.y === 'number' ? it.y : undefined,
            id: typeof it.id === 'string' ? it.id : undefined,
            data: (it.data as Record<string, unknown>) || undefined,
          });
          if (r.ok && r.id) created.push({ id: r.id, menu_type: menuType });
          else errors.push(`#${i}: ${r.error || 'fail'}`);
        });
        return {
          name,
          ok: errors.length === 0,
          result: { created, errors },
        };
      }
      case 'create_or_update_nodes': {
        if (!handle) return { name, ok: false, result: { error: '画布未就绪' } };
        const list = Array.isArray(args.items) ? args.items : [];
        const created: string[] = [];
        const updated: string[] = [];
        const errors: string[] = [];
        list.forEach((item, i) => {
          const it = item as Record<string, unknown>;
          const id = typeof it.id === 'string' ? it.id : '';
          if (id && handle.getNodes().some((n) => n.id === id)) {
            const r = handle.agentUpdateNode(id, {
              data: (it.data as Record<string, unknown>) || undefined,
              x: typeof it.x === 'number' ? it.x : undefined,
              y: typeof it.y === 'number' ? it.y : undefined,
            });
            if (r.ok) updated.push(id);
            else errors.push(`#${i}: ${r.error}`);
          } else {
            const menuType = String(it.menu_type || '');
            if (!menuType) {
              errors.push(`#${i}: 缺少 menu_type 或有效 id`);
              return;
            }
            const r = handle.agentCreateNode({
              menuType,
              x: typeof it.x === 'number' ? it.x : undefined,
              y: typeof it.y === 'number' ? it.y : undefined,
              id: id || undefined,
              data: (it.data as Record<string, unknown>) || undefined,
            });
            if (r.ok && r.id) created.push(r.id);
            else errors.push(`#${i}: ${r.error || 'fail'}`);
          }
        });
        return { name, ok: errors.length === 0, result: { created, updated, errors } };
      }
      case 'connect_nodes': {
        if (!handle) return { name, ok: false, result: { error: '画布未就绪' } };
        const list = Array.isArray(args.edges) ? args.edges : [];
        const connected: string[] = [];
        const errors: string[] = [];
        list.forEach((item, i) => {
          const it = item as Record<string, unknown>;
          const r = handle.agentConnect(String(it.source || ''), String(it.target || ''));
          if (r.ok) connected.push(r.id || 'ok');
          else errors.push(`#${i}: ${r.error}`);
        });
        return { name, ok: errors.length === 0, result: { connected, errors } };
      }
      case 'delete_nodes': {
        if (!handle) return { name, ok: false, result: { error: '画布未就绪' } };
        const ids = Array.isArray(args.ids) ? args.ids.map(String) : [];
        const r = handle.agentDeleteNodes(ids);
        return { name, ok: r.ok, result: r };
      }
      case 'layout_nodes': {
        if (!handle) return { name, ok: false, result: { error: '画布未就绪' } };
        const mode = String(args.mode || 'flow');
        // 默认节点间距 = 3 格网格（与 build_workflow 一致）
        const gapX = typeof args.gap_x === 'number' ? args.gap_x : NODE_GAP_PX;
        const gapY = typeof args.gap_y === 'number' ? args.gap_y : NODE_GAP_PX;
        const ox = typeof args.origin_x === 'number' ? args.origin_x : 80;
        const oy = typeof args.origin_y === 'number' ? args.origin_y : 80;
        const nodes = handle.getNodes();
        const edges = handle.getEdges();
        const next =
          mode === 'grid'
            ? layoutGrid(nodes, gapX, gapY, ox, oy)
            : layoutFlow(nodes, edges, gapX, gapY, ox, oy);
        handle.agentSetGraph(next, edges);
        return {
          name,
          ok: true,
          result: { mode, moved: next.length },
        };
      }
      case 'build_workflow': {
        if (!handle) return { name, ok: false, result: { error: '画布未就绪' } };
        const steps = Array.isArray(args.steps) ? args.steps : [];
        if (!steps.length) {
          return { name, ok: false, result: { error: 'steps 不能为空' } };
        }
        const ox = typeof args.origin_x === 'number' ? args.origin_x : 80;
        const oy = typeof args.origin_y === 'number' ? args.origin_y : 120;
        // !!! 节点之间固定空 3 格：cursor 步进 = 节点宽 + NODE_GAP_PX !!!
        const gapX = typeof args.gap_x === 'number' ? args.gap_x : NODE_GAP_PX;
        const title = String(args.title || '').trim();
        const created: Array<{ id: string; menu_type: string; label?: string }> = [];
        const errors: string[] = [];
        let cursorX = ox;

        steps.forEach((raw, i) => {
          const step = raw as Record<string, unknown>;
          const menuType = String(step.menu_type || '').trim();
          if (!menuType) {
            errors.push(`#${i}: 缺少 menu_type`);
            return;
          }
          const cfg = nodeConfigs[menuType];
          const w = cfg?.width ?? 400;
          const label =
            typeof step.label === 'string' && step.label.trim()
              ? step.label.trim()
              : undefined;
          const prompt =
            typeof step.prompt === 'string' && step.prompt.trim()
              ? step.prompt.trim()
              : undefined;
          const extra =
            step.data && typeof step.data === 'object'
              ? (step.data as Record<string, unknown>)
              : {};
          const data: Record<string, unknown> = { ...extra };
          if (label) data.label = label;
          // !!! 提示词必须写入 data.prompt，Image/Text/Video 节点面板会读这个字段 !!!
          if (prompt) {
            data.prompt = prompt;
            // 文本类：同时写 value，便于上游 collectUpstream 当输入文本
            if (menuType === 'text' || menuType === 'input' || menuType === 'script') {
              if (data.value == null || data.value === '') data.value = prompt;
            }
          }

          const r = handle.agentCreateNode({
            menuType,
            x: cursorX,
            y: oy,
            data,
          });
          if (r.ok && r.id) {
            created.push({ id: r.id, menu_type: menuType, label });
            cursorX += w + gapX;
          } else {
            errors.push(`#${i} ${menuType}: ${r.error || 'fail'}`);
          }
        });

        const edgeIds: string[] = [];
        for (let i = 0; i < created.length - 1; i++) {
          const r = handle.agentConnect(created[i].id, created[i + 1].id);
          if (r.ok && r.id) edgeIds.push(r.id);
          else errors.push(`连线 ${created[i].id}→${created[i + 1].id}: ${r.error}`);
        }

        // 可选便签标题
        if (title && created.length) {
          handle.agentCreateNode({
            menuType: 'note',
            x: ox,
            y: oy - 200,
            data: { label: title, value: title, content: title },
          });
        }

        log.info('build_workflow', 'done', {
          title,
          steps: created.length,
          edges: edgeIds.length,
          errors: errors.length,
        });
        return {
          name,
          ok: created.length > 0 && errors.length === 0,
          result: {
            title: title || undefined,
            created,
            edges: edgeIds,
            pipeline: created.map((c) => c.label || c.menu_type).join(' → '),
            errors,
            hint: '已在画布创建流水线；用户可继续改 prompt 或点生成',
          },
        };
      }
      default: {
        const nodeRes = executeNodeTool(name, args, handle);
        if (nodeRes) return nodeRes;
        if (name === 'summarize_context') {
          return {
            name,
            ok: false,
            result: {
              error: 'summarize_context 需宿主执行',
              pending: true,
              keep_last_turns: args.keep_last_turns,
              note: args.note,
            },
          };
        }
        return { name, ok: false, result: { error: `未知工具: ${name}` } };
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error('executeCanvasTool', 'fail', { name, msg });
    return { name, ok: false, result: { error: msg } };
  }
}
