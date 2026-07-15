// MCP 画布访问策略（设置 → 通用 → MCP 控制）
// 与「会话助手」里的 Copilot tool 开关分离：那边管应用内 Agent，这边管外部 MCP

import { createLogger } from './logger';

const log = createLogger('mcpCanvasPolicy');
const KEY = 'reelvas.mcpCanvasPolicy.v1';

export type McpCanvasPolicy = {
  /** 总开关：关则页面拒绝一切 MCP tool_request */
  enabled: boolean;
  /** 允许 read_canvas_summary / get_node / list_* 等只读 */
  allowRead: boolean;
  /** 允许 create/update/delete/connect/layout/build/submit */
  allowWrite: boolean;
};

const DEFAULT: McpCanvasPolicy = {
  enabled: true,
  allowRead: true,
  allowWrite: true,
};

const READ_TOOLS = new Set([
  'canvas_status',
  'read_canvas_summary',
  'list_node_types',
  'list_node_fields',
  'list_skills',
  'search_skills',
  'get_node',
]);

const WRITE_TOOLS = new Set([
  'create_nodes',
  'create_or_update_nodes',
  'update_node',
  'update_nodes',
  'connect_nodes',
  'delete_nodes',
  'layout_nodes',
  'build_workflow',
  'submit_nodes',
]);

export function getMcpCanvasPolicy(): McpCanvasPolicy {
  if (typeof window === 'undefined') return { ...DEFAULT };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT };
    const o = JSON.parse(raw) as Partial<McpCanvasPolicy>;
    return {
      enabled: typeof o.enabled === 'boolean' ? o.enabled : DEFAULT.enabled,
      allowRead: typeof o.allowRead === 'boolean' ? o.allowRead : DEFAULT.allowRead,
      allowWrite: typeof o.allowWrite === 'boolean' ? o.allowWrite : DEFAULT.allowWrite,
    };
  } catch {
    return { ...DEFAULT };
  }
}

export function setMcpCanvasPolicy(patch: Partial<McpCanvasPolicy>): McpCanvasPolicy {
  const next = { ...getMcpCanvasPolicy(), ...patch };
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
      window.dispatchEvent(new CustomEvent('reelvas:mcp-policy', { detail: next }));
    } catch (err) {
      log.warn('setMcpCanvasPolicy', 'save failed', {
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }
  log.info('setMcpCanvasPolicy', 'saved', next);
  return next;
}

/** 页面执行 MCP tool 前检查；返回 null 表示允许，否则为拒绝原因 */
export function denyReasonForMcpTool(name: string, policy = getMcpCanvasPolicy()): string | null {
  if (!policy.enabled) {
    return 'MCP 已在设置中关闭（通用 → MCP 控制）';
  }
  if (READ_TOOLS.has(name) && !policy.allowRead) {
    return `只读工具 ${name} 已被关闭（未开启「读取画布」）`;
  }
  if (WRITE_TOOLS.has(name) && !policy.allowWrite) {
    return `写入工具 ${name} 已被关闭（未开启「写入画布」）`;
  }
  // 未分类工具：需要 enabled 即可
  return null;
}

/** 与 mcp-canvas-server 工具表对齐的展示列表（名称稳定） */
export const MCP_CANVAS_TOOL_CATALOG: Array<{ name: string; kind: 'read' | 'write' | 'meta' }> = [
  { name: 'canvas_status', kind: 'meta' },
  { name: 'read_canvas_summary', kind: 'read' },
  { name: 'list_node_types', kind: 'read' },
  { name: 'list_node_fields', kind: 'read' },
  { name: 'get_node', kind: 'read' },
  { name: 'update_node', kind: 'write' },
  { name: 'update_nodes', kind: 'write' },
  { name: 'submit_nodes', kind: 'write' },
  { name: 'create_nodes', kind: 'write' },
  { name: 'connect_nodes', kind: 'write' },
  { name: 'delete_nodes', kind: 'write' },
  { name: 'layout_nodes', kind: 'write' },
  { name: 'build_workflow', kind: 'write' },
];

export function countMcpToolsForPolicy(policy = getMcpCanvasPolicy()): number {
  if (!policy.enabled) return 0;
  return MCP_CANVAS_TOOL_CATALOG.filter((t) => {
    if (t.kind === 'meta') return true;
    if (t.kind === 'read') return policy.allowRead;
    if (t.kind === 'write') return policy.allowWrite;
    return true;
  }).length;
}
