// 画布节点级 tool 执行：读取 / 改参 / 提交生成

import type { WorkflowHandle } from '../components/editor/CanvasFlowCore';
import { nodeConfigs } from '../components/editor/nodes';
import type { FlowNode } from '../components/editor/flow/types';
import { dispatchAgentSubmit, hasAgentSubmitListener } from './agentNodeBus';
import { createLogger } from './logger';
import { NODE_TOOL_NAMES, NODE_TOOL_SCHEMAS } from './copilotNodeToolSchemas';

export { NODE_TOOL_NAMES, NODE_TOOL_SCHEMAS };

const log = createLogger('copilotNodeTools');
const MENU_TYPES = Object.keys(nodeConfigs);
const EDITABLE_FIELDS =
  'prompt, label, value, model, res, qty, aspect, quality, recipeId, voice, text, duration';

function previewValue(v: unknown): unknown {
  if (v == null) return v;
  if (typeof v === 'string') {
    if (v.startsWith('data:')) return `dataURL(len=${v.length})`;
    if (v.length > 200) return `${v.slice(0, 200)}…`;
    return v;
  }
  if (Array.isArray(v)) {
    if (v.length > 8) return { length: v.length, sample: v.slice(0, 3).map(previewValue) };
    return v.map(previewValue);
  }
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(o)) {
      if (k === 'imageUrls' && Array.isArray(val)) {
        out[k] = { count: val.length, sample: val.slice(0, 2).map(previewValue) };
      } else out[k] = previewValue(val);
    }
    return out;
  }
  return v;
}

function nodeSnapshot(n: FlowNode, fullData: boolean): Record<string, unknown> {
  const data = (n.data || {}) as Record<string, unknown>;
  return {
    id: n.id,
    type: n.type,
    menu_hint: n.type,
    x: Math.round(n.position.x),
    y: Math.round(n.position.y),
    w: n.style?.width,
    h: n.style?.height,
    label: data.label,
    status: data.status,
    model: data.model,
    prompt: typeof data.prompt === 'string' ? previewValue(data.prompt) : data.prompt,
    data: fullData
      ? previewValue(data)
      : previewValue({
          label: data.label,
          prompt: data.prompt,
          value: data.value,
          model: data.model,
          status: data.status,
          error: data.error,
          res: data.res,
          qty: data.qty,
          aspect: data.aspect,
          quality: data.quality,
          recipeId: data.recipeId,
          voice: data.voice,
        }),
  };
}

export type NodeToolExecResult = {
  name: string;
  ok: boolean;
  result: unknown;
};

export function executeNodeTool(
  name: string,
  args: Record<string, unknown>,
  handle: WorkflowHandle | null | undefined,
): NodeToolExecResult | null {
  if (!NODE_TOOL_SCHEMAS[name]) return null;

  try {
    switch (name) {
      case 'get_node': {
        if (!handle) return { name, ok: false, result: { error: '画布未就绪' } };
        const ids = Array.isArray(args.ids) ? args.ids.map(String) : [];
        if (!ids.length) return { name, ok: false, result: { error: 'ids 不能为空' } };
        const full = args.include_full_data === true;
        const nodes = handle.getNodes();
        const found: unknown[] = [];
        const missing: string[] = [];
        ids.forEach((id) => {
          const n = nodes.find((x) => x.id === id);
          if (n) found.push(nodeSnapshot(n, full));
          else missing.push(id);
        });
        return {
          name,
          ok: missing.length === 0,
          result: { nodes: found, missing, count: found.length },
        };
      }
      case 'update_node': {
        if (!handle) return { name, ok: false, result: { error: '画布未就绪' } };
        const id = String(args.id || '').trim();
        if (!id) return { name, ok: false, result: { error: 'id 必填' } };
        const data =
          args.data && typeof args.data === 'object'
            ? (args.data as Record<string, unknown>)
            : undefined;
        const r = handle.agentUpdateNode(id, {
          data,
          x: typeof args.x === 'number' ? args.x : undefined,
          y: typeof args.y === 'number' ? args.y : undefined,
        });
        const after = handle.getNodes().find((n) => n.id === id);
        return {
          name,
          ok: r.ok,
          result: r.ok
            ? { id, updated: true, node: after ? nodeSnapshot(after, false) : null }
            : { error: r.error },
        };
      }
      case 'update_nodes': {
        if (!handle) return { name, ok: false, result: { error: '画布未就绪' } };
        const list = Array.isArray(args.items) ? args.items : [];
        const updated: string[] = [];
        const errors: string[] = [];
        list.forEach((raw, i) => {
          const it = raw as Record<string, unknown>;
          const id = String(it.id || '').trim();
          if (!id) {
            errors.push(`#${i}: 缺少 id`);
            return;
          }
          const r = handle.agentUpdateNode(id, {
            data:
              it.data && typeof it.data === 'object'
                ? (it.data as Record<string, unknown>)
                : undefined,
            x: typeof it.x === 'number' ? it.x : undefined,
            y: typeof it.y === 'number' ? it.y : undefined,
          });
          if (r.ok) updated.push(id);
          else errors.push(`#${i} ${id}: ${r.error}`);
        });
        return { name, ok: errors.length === 0, result: { updated, errors } };
      }
      case 'submit_nodes': {
        if (!handle) return { name, ok: false, result: { error: '画布未就绪' } };
        const ids = Array.isArray(args.ids) ? args.ids.map(String) : [];
        if (!ids.length) return { name, ok: false, result: { error: 'ids 不能为空' } };
        const reason = typeof args.reason === 'string' ? args.reason : undefined;
        const accepted: string[] = [];
        const noListener: string[] = [];
        const missing: string[] = [];
        const nodes = handle.getNodes();
        ids.forEach((id) => {
          if (!nodes.some((n) => n.id === id)) {
            missing.push(id);
            return;
          }
          if (hasAgentSubmitListener(id)) {
            dispatchAgentSubmit(id, reason);
            accepted.push(id);
          } else {
            handle.agentUpdateNode(id, { data: { autoGenerate: true } });
            noListener.push(id);
            if (dispatchAgentSubmit(id, reason || 'fallback')) accepted.push(id);
          }
        });
        log.info('submit_nodes', 'done', {
          accepted: accepted.length,
          noListener: noListener.length,
          missing: missing.length,
        });
        return {
          name,
          ok: missing.length === 0 && (accepted.length > 0 || noListener.length > 0),
          result: {
            submitted: accepted,
            queued_autoGenerate: noListener.filter((id) => !accepted.includes(id)),
            missing,
            note:
              'submitted=已触发生成；queued_autoGenerate=节点未监听时写入 autoGenerate，挂载后可能自动提交',
          },
        };
      }
      case 'list_node_fields': {
        const filter = String(args.menu_type || '').trim();
        const types = MENU_TYPES.filter((t) => !filter || t === filter).map((k) => {
          const c = nodeConfigs[k];
          return {
            menu_type: k,
            flow_type: c?.type,
            label: c?.labelPrefix,
            suggested_data_fields: EDITABLE_FIELDS,
            width: c?.width,
            height: c?.height,
          };
        });
        return { name, ok: true, result: { types } };
      }
      default:
        return null;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error('executeNodeTool', 'fail', { name, err: msg });
    return { name, ok: false, result: { error: msg } };
  }
}
