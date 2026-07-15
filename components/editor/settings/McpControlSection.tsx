'use client';

import { useCallback, useEffect, useState } from 'react';
import { Switch } from './Switch';
import {
  countMcpToolsForPolicy,
  getMcpCanvasPolicy,
  setMcpCanvasPolicy,
  type McpCanvasPolicy,
} from '@/lib/mcpCanvasPolicy';
import { bridgeWsUrl, CANVAS_BRIDGE_DEFAULT_PORT } from '@/lib/canvasBridgeProtocol';
import {
  CANVAS_AGENT_GUIDE_FILENAME,
  downloadCanvasAgentGuide,
} from '@/lib/canvasAgentGuide';
import { createLogger } from '@/lib/logger';

const log = createLogger('McpControlSection');

function pageBridgePort(): number {
  if (typeof window === 'undefined') return CANVAS_BRIDGE_DEFAULT_PORT;
  const p = Number(window.location?.port || 0);
  return p > 0 ? p : CANVAS_BRIDGE_DEFAULT_PORT;
}

const IMCP = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
);
const IDownload = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
);

export function McpControlSection() {
  const [policy, setPolicy] = useState<McpCanvasPolicy>(() => getMcpCanvasPolicy());
  const [bridgeOk, setBridgeOk] = useState<boolean | null>(null);
  const [bridgeHint, setBridgeHint] = useState('');

  const patchPolicy = (patch: Partial<McpCanvasPolicy>) => {
    setPolicy(setMcpCanvasPolicy(patch));
  };

  const probeBridge = useCallback(() => {
    const url = bridgeWsUrl(pageBridgePort());
    let settled = false;
    try {
      const ws = new WebSocket(url);
      const done = (ok: boolean, hint: string) => {
        if (settled) return;
        settled = true;
        setBridgeOk(ok);
        setBridgeHint(hint);
        try {
          ws.close();
        } catch (_) {}
      };
      const timer = window.setTimeout(
        () => done(false, '连接超时 — 请用 npm run serve:tts 打开本页'),
        2500,
      );
      ws.onopen = () => {
        window.clearTimeout(timer);
        done(true, `已连通 ${url}（操作当前打开的画布）`);
      };
      ws.onerror = () => {
        window.clearTimeout(timer);
        done(false, `无法连接 ${url}`);
      };
    } catch (err) {
      setBridgeOk(false);
      setBridgeHint(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    probeBridge();
  }, [probeBridge]);

  const toolCount = countMcpToolsForPolicy(policy);
  const wsUrl = bridgeWsUrl(pageBridgePort());
  const mcpCmd = 'node scripts/mcp-canvas-server.js';

  return (
    <div className="rounded-2xl border border-border/50 bg-white px-7 py-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <IMCP />MCP 控制（外部 Agent）
        </span>
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${
            policy.enabled && bridgeOk
              ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
              : policy.enabled
                ? 'border-amber-200 bg-amber-50 text-amber-700'
                : 'border-border bg-muted/40 text-muted-foreground'
          }`}
        >
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${
              policy.enabled && bridgeOk
                ? 'bg-emerald-500'
                : policy.enabled
                  ? 'bg-amber-500'
                  : 'bg-muted-foreground'
            }`}
          />
          {!policy.enabled
            ? '已关闭'
            : bridgeOk === null
              ? '检测桥…'
              : bridgeOk
                ? '桥在线'
                : '桥离线'}
        </span>
        <span className="text-[10px] text-muted-foreground">工具 {toolCount}</span>
      </div>

      <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
        这里管 <strong className="font-medium text-foreground">Claude Code / Codex 等外部 MCP</strong> 能否操作
        <strong className="font-medium text-foreground">当前打开的画布页</strong>。
        与「会话助手」里的 Copilot Tool 开关不是同一套：那边只影响应用内对话 Agent。
      </p>

      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-foreground">启用 MCP 画布服务</p>
          <p className="mt-1 text-xs text-muted-foreground">
            关闭后页面会拒绝一切外部 tool_request（即使 MCP 客户端仍在跑）。
          </p>
        </div>
        <Switch
          checked={policy.enabled}
          onChange={() => patchPolicy({ enabled: !policy.enabled })}
          label="启用 MCP"
        />
      </div>

      {policy.enabled ? (
        <>
          <div className="mt-4 space-y-1">
            <div className="flex items-center justify-between gap-4 py-3">
              <div className="flex items-center gap-4">
                <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">读取画布</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    read_canvas_summary / get_node / list_* 等只读工具
                  </p>
                </div>
              </div>
              <Switch
                checked={policy.allowRead}
                onChange={() => patchPolicy({ allowRead: !policy.allowRead })}
                label="读取画布"
              />
            </div>

            <div className="flex items-center justify-between gap-4 py-3">
              <div className="flex items-center gap-4">
                <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">写入画布</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    create / update / connect / delete / build_workflow / submit_nodes
                  </p>
                </div>
              </div>
              <Switch
                checked={policy.allowWrite}
                onChange={() => patchPolicy({ allowWrite: !policy.allowWrite })}
                label="写入画布"
              />
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-border/50">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 px-4 py-3">
              <span className="text-sm font-medium text-foreground">画布 MCP 桥（当前页）</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    downloadCanvasAgentGuide();
                    log.info('downloadGuide', 'ok');
                  }}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-background px-3 text-xs text-foreground transition-colors hover:bg-muted/30"
                >
                  <IDownload />
                  {CANVAS_AGENT_GUIDE_FILENAME}
                </button>
                <button
                  type="button"
                  onClick={probeBridge}
                  className="h-8 rounded-lg border border-border bg-background px-3 text-xs text-foreground transition-colors hover:bg-muted/30"
                >
                  检测连接
                </button>
              </div>
            </div>
            <table className="w-full table-fixed text-xs">
              <colgroup>
                <col className="w-[120px]" />
                <col />
                <col className="w-[56px]" />
                <col className="w-[100px]" />
              </colgroup>
              <thead>
                <tr className="border-b border-border/40 bg-muted/20">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">名称</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">地址 / 命令</th>
                  <th className="px-3 py-2 text-center font-medium text-muted-foreground">工具</th>
                  <th className="px-3 py-2 text-center font-medium text-muted-foreground">状态</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/20">
                  <td className="px-3 py-2.5 font-medium text-foreground">画布桥 WS</td>
                  <td className="truncate px-3 py-2.5 font-mono text-[11px] text-foreground" title={wsUrl}>
                    {wsUrl}
                  </td>
                  <td className="px-3 py-2.5 text-center tabular-nums text-foreground">—</td>
                  <td className="px-3 py-2.5 text-center">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                        bridgeOk
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
                          : bridgeOk === false
                            ? 'border-red-200 bg-red-50 text-red-500'
                            : 'border-amber-200 bg-amber-50 text-amber-600'
                      }`}
                    >
                      {bridgeOk === null ? '检测中' : bridgeOk ? '已连接' : '断开'}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2.5 font-medium text-foreground">MCP stdio</td>
                  <td className="truncate px-3 py-2.5 font-mono text-[11px] text-foreground" title={mcpCmd}>
                    {mcpCmd}
                  </td>
                  <td className="px-3 py-2.5 text-center tabular-nums text-foreground">{toolCount || '—'}</td>
                  <td className="px-3 py-2.5 text-center text-[10px] text-muted-foreground">
                    由 Claude/Codex 拉起
                  </td>
                </tr>
              </tbody>
            </table>
            {bridgeHint ? (
              <p className="border-t border-border/40 px-4 py-2 text-[11px] text-muted-foreground">
                {bridgeHint}
              </p>
            ) : null}
            <p className="border-t border-border/40 px-4 py-2 text-[11px] leading-relaxed text-muted-foreground">
              外部 IDE 配置 MCP 时用 <code className="rounded bg-muted px-1">stdio + node scripts/mcp-canvas-server.js</code>
              ，不要填 <code className="rounded bg-muted px-1">http://localhost:3001/sse</code>
              （那是旧占位，不是本项目真实服务）。
            </p>
          </div>
        </>
      ) : null}
    </div>
  );
}
