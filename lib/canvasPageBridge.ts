// 编辑器页：连接本地桥，执行 MCP/外部 Agent 的 tool_request

import type { MutableRefObject } from 'react';
import type { WorkflowHandle } from '../components/editor/CanvasFlowCore';
import { executeCanvasTool } from './copilotCanvasTools';
import {
  bridgeWsUrl,
  CANVAS_BRIDGE_DEFAULT_PORT,
  type BridgeMessage,
  type BridgeToolRequest,
} from './canvasBridgeProtocol';
import { createLogger } from './logger';
import { denyReasonForMcpTool } from './mcpCanvasPolicy';

const log = createLogger('canvasPageBridge');

function getBridgePort(): number {
  if (typeof window === 'undefined') return CANVAS_BRIDGE_DEFAULT_PORT;
  const w = window as unknown as { __REELVAS_BRIDGE_PORT__?: number };
  if (w.__REELVAS_BRIDGE_PORT__) return Number(w.__REELVAS_BRIDGE_PORT__) || CANVAS_BRIDGE_DEFAULT_PORT;
  // 与当前页面同源端口（serve:tts 同机挂载桥）；file/无端口时回退默认
  const p = Number(window.location?.port || 0);
  if (p > 0) return p;
  return CANVAS_BRIDGE_DEFAULT_PORT;
}

export type CanvasBridgeController = {
  stop: () => void;
  getState: () => { connected: boolean; url: string };
};

/**
 * 在打开的编辑器页启动桥客户端。workflowRef 需指向当前画布。
 */
export function startCanvasPageBridge(
  workflowRef: MutableRefObject<WorkflowHandle | null>,
): CanvasBridgeController {
  let ws: WebSocket | null = null;
  let stopped = false;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let pingTimer: ReturnType<typeof setInterval> | null = null;
  const url = bridgeWsUrl(getBridgePort());

  const send = (msg: BridgeMessage) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  };

  const handleToolRequest = async (msg: BridgeToolRequest) => {
    const name = String(msg.name || '');
    const args = (msg.arguments && typeof msg.arguments === 'object'
      ? msg.arguments
      : {}) as Record<string, unknown>;
    const handle = workflowRef.current;
    log.info('tool_request', 'run', { id: msg.id, name });

    // 设置 → 通用 → MCP 控制：总开关 / 读 / 写
    const denied = denyReasonForMcpTool(name);
    if (denied) {
      send({ type: 'tool_response', id: msg.id, ok: false, error: denied });
      return;
    }

    if (name === 'canvas_status') {
      send({
        type: 'tool_response',
        id: msg.id,
        ok: true,
        result: {
          page: typeof location !== 'undefined' ? location.pathname : '',
          hasWorkflow: Boolean(handle),
          nodeCount: handle?.getNodes().length ?? 0,
          edgeCount: handle?.getEdges().length ?? 0,
          bridge: 'page',
        },
      });
      return;
    }

    if (!handle) {
      send({
        type: 'tool_response',
        id: msg.id,
        ok: false,
        error: '画布 WorkflowHandle 未就绪',
      });
      return;
    }

    try {
      // mutation 工具推快照，便于用户撤销
      const mut = [
        'create_nodes',
        'create_or_update_nodes',
        'connect_nodes',
        'delete_nodes',
        'layout_nodes',
        'build_workflow',
        'update_node',
        'update_nodes',
        'submit_nodes',
      ].includes(name);
      if (mut) handle.agentPushSnapshot();

      const exec = executeCanvasTool(name, args, handle);
      send({
        type: 'tool_response',
        id: msg.id,
        ok: exec.ok,
        result: exec.result,
        error: exec.ok
          ? undefined
          : typeof (exec.result as { error?: string })?.error === 'string'
            ? (exec.result as { error: string }).error
            : 'tool failed',
      });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      log.error('tool_request', 'fail', { name, error });
      send({ type: 'tool_response', id: msg.id, ok: false, error });
    }
  };

  const connect = () => {
    if (stopped) return;
    try {
      ws = new WebSocket(url);
    } catch (err) {
      log.warn('connect', 'new WebSocket failed', {
        err: err instanceof Error ? err.message : String(err),
      });
      scheduleRetry();
      return;
    }

    ws.onopen = () => {
      log.info('connect', 'open', { url });
      send({
        type: 'hello',
        role: 'canvas',
        page: typeof location !== 'undefined' ? location.pathname : '',
        version: '0.2.0',
      });
      if (pingTimer) clearInterval(pingTimer);
      pingTimer = setInterval(() => send({ type: 'ping', t: Date.now() }), 15000);
    };

    ws.onmessage = (ev) => {
      let msg: BridgeMessage;
      try {
        msg = JSON.parse(String(ev.data)) as BridgeMessage;
      } catch {
        return;
      }
      if (msg.type === 'tool_request') {
        void handleToolRequest(msg);
      }
    };

    ws.onclose = () => {
      log.info('connect', 'closed');
      if (pingTimer) {
        clearInterval(pingTimer);
        pingTimer = null;
      }
      scheduleRetry();
    };

    ws.onerror = () => {
      // onclose 会重试
    };
  };

  const scheduleRetry = () => {
    if (stopped) return;
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = setTimeout(connect, 2000);
  };

  connect();

  return {
    stop: () => {
      stopped = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (pingTimer) clearInterval(pingTimer);
      try {
        ws?.close();
      } catch (_) {}
      ws = null;
    },
    getState: () => ({
      connected: !!(ws && ws.readyState === WebSocket.OPEN),
      url,
    }),
  };
}
