// 节点级 tool 的 OpenAI function schema（稳定命名/描述）

export type OpenAITool = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

import { nodeConfigs } from '../components/editor/nodes';

const MENU_TYPES = Object.keys(nodeConfigs);

const EDITABLE_FIELDS =
  'prompt, label, value, model, res, qty, aspect, quality, recipeId, voice, text, duration, status(只读勿写)';

export const NODE_TOOL_SCHEMAS: Record<string, OpenAITool> = {
  get_node: {
    type: 'function',
    function: {
      name: 'get_node',
      description:
        '读取画布上一个或多个节点的完整状态（id/type/位置/data 关键字段）。改参或提交前应先调用。传 ids；可 include_full_data=true 看更多字段。',
      parameters: {
        type: 'object',
        properties: {
          ids: {
            type: 'array',
            items: { type: 'string' },
            description: '节点 id 列表（来自 read_canvas_summary 或 create 返回值）',
          },
          include_full_data: {
            type: 'boolean',
            description: 'true 时返回完整 data 预览（默认 false，只返回关键字段）',
          },
        },
        required: ['ids'],
      },
    },
  },
  update_node: {
    type: 'function',
    function: {
      name: 'update_node',
      description: `更新已有节点的 data 与/或位置。merge 写入 data（不会整表替换）。常用字段：${EDITABLE_FIELDS}。改 prompt/model 后若要真正生成，再 call submit_nodes。`,
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: '目标节点 id' },
          data: {
            type: 'object',
            additionalProperties: true,
            description: '要合并的 data 补丁，如 { prompt, model, label, qty }',
          },
          x: { type: 'number' },
          y: { type: 'number' },
        },
        required: ['id'],
      },
    },
  },
  update_nodes: {
    type: 'function',
    function: {
      name: 'update_nodes',
      description: '批量 update_node。items[] 每项含 id 与可选 data/x/y。',
      parameters: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                data: { type: 'object', additionalProperties: true },
                x: { type: 'number' },
                y: { type: 'number' },
              },
              required: ['id'],
            },
          },
        },
        required: ['items'],
      },
    },
  },
  submit_nodes: {
    type: 'function',
    function: {
      name: 'submit_nodes',
      description:
        '触发节点真正「提交生成」（等同用户点生成按钮）。仅对已挂载的 image/video/text/tts/audio 等生成节点有效。提交前应 update_node 写好 prompt/model。需用户已授权对应生成权限。',
      parameters: {
        type: 'object',
        properties: {
          ids: {
            type: 'array',
            items: { type: 'string' },
            description: '要提交的节点 id 列表',
          },
          reason: {
            type: 'string',
            description: '可选：提交原因，写入日志',
          },
        },
        required: ['ids'],
      },
    },
  },
  list_node_fields: {
    type: 'function',
    function: {
      name: 'list_node_fields',
      description: '列出可创建 menu_type 及建议写入的 data 字段（改参参考）。',
      parameters: {
        type: 'object',
        properties: {
          menu_type: {
            type: 'string',
            description: `可选过滤：${MENU_TYPES.join(', ')}`,
          },
        },
      },
    },
  },
};


export const NODE_TOOL_NAMES = Object.keys(NODE_TOOL_SCHEMAS);
