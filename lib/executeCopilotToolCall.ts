// 单次 tool 执行：ask_user 弹窗等待 / 画布 tool 同步执行

import type { WorkflowHandle } from '../components/editor/CanvasFlowCore';
import { executeCanvasTool } from './copilotCanvasTools';
import { formatToolDetail } from './formatToolDetail';
import { parseAskUserArgs, type AskUserAnswer, type AskUserRequest } from './askUserTypes';
import { createLogger } from './logger';
import type { CopilotMsg, ToolCallRecord } from './runCopilotSend';

const log = createLogger('CopilotChat');

const MUTATION = [
  'create_nodes',
  'connect_nodes',
  'delete_nodes',
  'create_or_update_nodes',
  'build_workflow',
  'update_node',
  'update_nodes',
];

export type SummarizeRequest = {
  keepLast: number;
  note?: string;
};

export type SummarizeResult = {
  summary: string;
  kept: number;
  removed: number;
};

export type ExecToolCallArgs = {
  name: string;
  argsRaw: string;
  workflow: WorkflowHandle | null;
  onAskUser?: (req: AskUserRequest) => Promise<AskUserAnswer>;
  onSummarize?: (req: SummarizeRequest) => Promise<SummarizeResult>;
  beforeAskUser?: () => void;
  isAborted?: () => boolean;
  round: number;
  uid: () => string;
};

export type ExecToolCallResult = {
  result: unknown;
  ok: boolean;
  record: ToolCallRecord;
  row: CopilotMsg;
  aborted?: boolean;
};

export async function executeCopilotToolCall(a: ExecToolCallArgs): Promise<ExecToolCallResult> {
  const isMutation = MUTATION.includes(a.name);
  let result: unknown;
  let ok = false;
  let undoable = false;

  if (a.name === 'ask_user') {
    if (!a.onAskUser) {
      result = { error: '宿主未实现 ask_user 弹窗', pending: true };
      ok = false;
    } else {
      a.beforeAskUser?.();
      const req = parseAskUserArgs(a.argsRaw);
      log.info('send', 'ask_user wait', { question: req.question, n: req.options.length });
      try {
        const answer = await a.onAskUser(req);
        if (a.isAborted?.()) {
          return {
            result: { cancelled: true },
            ok: false,
            aborted: true,
            record: { name: a.name, ok: false, detail: '已中止' },
            row: {
              id: a.uid(),
              role: 'tool',
              content: '已中止',
              toolCall: { name: a.name, ok: false, detail: '已中止' },
            },
          };
        }
        result = {
          selected_id: answer.selected_id,
          selected_label: answer.selected_label,
          free_text: answer.free_text || null,
          cancelled: Boolean(answer.cancelled),
        };
        ok = !answer.cancelled;
      } catch (askErr) {
        const msg = askErr instanceof Error ? askErr.message : String(askErr);
        result = { error: msg, cancelled: true };
        ok = false;
      }
    }
  } else if (a.name === 'summarize_context') {
    if (!a.onSummarize) {
      result = { error: '宿主未实现 summarize_context', pending: true };
      ok = false;
    } else {
      let args: Record<string, unknown> = {};
      try {
        args = a.argsRaw.trim() ? (JSON.parse(a.argsRaw) as Record<string, unknown>) : {};
      } catch {
        args = {};
      }
      const keepRaw = Number(args.keep_last_turns);
      const keepLast = Number.isFinite(keepRaw)
        ? Math.min(40, Math.max(4, Math.floor(keepRaw)))
        : 8;
      const note = typeof args.note === 'string' ? args.note.trim() : undefined;
      try {
        const out = await a.onSummarize({ keepLast, note });
        result = {
          summary: out.summary,
          kept: out.kept,
          removed: out.removed,
          note: note || null,
        };
        ok = true;
      } catch (sumErr) {
        const msg = sumErr instanceof Error ? sumErr.message : String(sumErr);
        result = { error: msg };
        ok = false;
      }
    }
  } else {
    if (isMutation && a.workflow) a.workflow.agentPushSnapshot();
    const exec = executeCanvasTool(a.name, a.argsRaw, a.workflow);
    result = exec.result;
    ok = exec.ok;
    undoable = isMutation && exec.ok;
  }

  const record: ToolCallRecord = {
    name: a.name,
    ok,
    detail: result ? formatToolDetail(a.name, result) : '',
    undoable,
  };
  log.info('send', 'tool done', { name: a.name, ok, round: a.round });
  return {
    result,
    ok,
    record,
    row: {
      id: a.uid(),
      role: 'tool',
      content: record.detail || a.name,
      toolCall: record,
    },
  };
}
