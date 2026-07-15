// Agent → 节点提交通道：tool call 派发，节点组件监听并触发本地点击「生成」

import { createLogger } from './logger';

const log = createLogger('agentNodeBus');

export const AGENT_SUBMIT_EVENT = 'reelvas:agent-submit-node';

export type AgentSubmitDetail = {
  nodeId: string;
  reason?: string;
};

type Handler = (detail: AgentSubmitDetail) => void;

const handlers = new Map<string, Set<Handler>>();

/** 节点挂载时订阅；返回取消函数 */
export function subscribeAgentSubmit(nodeId: string, handler: Handler): () => void {
  if (!handlers.has(nodeId)) handlers.set(nodeId, new Set());
  handlers.get(nodeId)!.add(handler);
  return () => {
    const set = handlers.get(nodeId);
    if (!set) return;
    set.delete(handler);
    if (!set.size) handlers.delete(nodeId);
  };
}

/** tool 执行侧：请求某节点提交生成（同步通知已挂载组件） */
export function dispatchAgentSubmit(nodeId: string, reason?: string): boolean {
  const id = String(nodeId || '').trim();
  if (!id) return false;
  const detail: AgentSubmitDetail = { nodeId: id, reason };
  const set = handlers.get(id);
  if (!set?.size) {
    log.warn('dispatchAgentSubmit', 'no listener', { id, reason });
    return false;
  }
  set.forEach((h) => {
    try {
      h(detail);
    } catch (err) {
      log.error('dispatchAgentSubmit', 'handler error', {
        id,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  });
  log.info('dispatchAgentSubmit', 'ok', { id, n: set.size, reason });
  return true;
}

/** 是否有节点监听（用于 tool 结果提示） */
export function hasAgentSubmitListener(nodeId: string): boolean {
  return (handlers.get(String(nodeId || '').trim())?.size ?? 0) > 0;
}
