// 浏览器 ↔ MCP 桥协议（JSON over WebSocket）

/** 独立桥默认端口；与 serve:tts 同开时页面会优先用页面端口（通常 3000） */
export const CANVAS_BRIDGE_DEFAULT_PORT = 3000;
export const CANVAS_BRIDGE_WS_PATH = '/reelvas-canvas-bridge';

export type BridgeHello = {
  type: 'hello';
  role: 'canvas' | 'mcp';
  page?: string;
  version?: string;
};

export type BridgeToolRequest = {
  type: 'tool_request';
  id: string;
  name: string;
  arguments?: Record<string, unknown>;
};

export type BridgeToolResponse = {
  type: 'tool_response';
  id: string;
  ok: boolean;
  result?: unknown;
  error?: string;
};

export type BridgePing = { type: 'ping'; t?: number };
export type BridgePong = { type: 'pong'; t?: number };
export type BridgeStatus = {
  type: 'status';
  canvasConnected: boolean;
  clients?: number;
};

export type BridgeMessage =
  | BridgeHello
  | BridgeToolRequest
  | BridgeToolResponse
  | BridgePing
  | BridgePong
  | BridgeStatus;

export function bridgeWsUrl(port = CANVAS_BRIDGE_DEFAULT_PORT): string {
  return `ws://127.0.0.1:${port}${CANVAS_BRIDGE_WS_PATH}`;
}
