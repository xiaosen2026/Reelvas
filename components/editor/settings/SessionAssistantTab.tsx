'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  COPILOT_MODES,
  getAssistantConfigMap,
  getDefaultModePrompt,
  resetModeAssistantConfig,
  setModeAssistantConfig,
  setToolEnabled,
  type CopilotMode,
  type ModeAssistantConfig,
  type ToolCallConfig,
} from '../../../lib/copilotAssistantStore';

const modeMeta: Record<CopilotMode, { title: string; desc: string }> = {
  Ask: { title: 'Ask', desc: '问答与解释，不执行画布操作' },
  Agent: { title: 'Agent', desc: '可规划并执行工具/画布操作' },
};

function ToolRow({
  tool,
  onToggle,
}: {
  tool: ToolCallConfig;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-border/40 last:border-b-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground font-mono">{tool.name}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{tool.desc}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={tool.enabled}
        aria-label={`切换 ${tool.name}`}
        onClick={onToggle}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          tool.enabled ? 'bg-emerald-500' : 'bg-muted'
        }`}
      >
        <span
          className={`block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
            tool.enabled ? 'translate-x-5.5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}

export function SessionAssistantTab() {
  const [mode, setMode] = useState<CopilotMode>('Ask');
  const [cfg, setCfg] = useState<ModeAssistantConfig>(() => getAssistantConfigMap().Ask);
  const [draft, setDraft] = useState(cfg.systemPrompt);
  const [hint, setHint] = useState('');

  const reload = useCallback((m: CopilotMode) => {
    const next = getAssistantConfigMap()[m];
    setCfg(next);
    setDraft(next.systemPrompt);
    setHint('');
  }, []);

  useEffect(() => {
    reload(mode);
  }, [mode, reload]);

  const flash = (msg: string) => {
    setHint(msg);
    window.setTimeout(() => setHint(''), 1500);
  };

  const onSavePrompt = () => {
    if (!draft.trim()) return;
    const map = setModeAssistantConfig(mode, { systemPrompt: draft.trim() });
    setCfg(map[mode]);
    setDraft(map[mode].systemPrompt);
    flash('已保存系统提示词');
  };

  const onReset = () => {
    const map = resetModeAssistantConfig(mode);
    setCfg(map[mode]);
    setDraft(map[mode].systemPrompt);
    flash('已恢复默认');
  };

  const onToggleTool = (id: string, enabled: boolean) => {
    const map = setToolEnabled(mode, id, enabled);
    setCfg(map[mode]);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-foreground">会话助手</h3>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
          配置 Copilot Ask / Agent 的系统提示词与 Tool Call（含节点读写、提交生成、上下文总结）。输入框可用{' '}
          <code className="px-1 rounded bg-muted text-[11px]">@skill-id</code> 引用 Skills。
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {COPILOT_MODES.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              mode === m
                ? 'bg-emerald-50 text-emerald-700 font-medium'
                : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
            }`}
          >
            {modeMeta[m].title}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-border/50 bg-white p-5">
        <div className="mb-3">
          <p className="text-sm font-semibold text-foreground">{modeMeta[mode].title} · 系统提示词</p>
          <p className="text-xs text-muted-foreground mt-1">{modeMeta[mode].desc}</p>
        </div>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={10}
          placeholder={getDefaultModePrompt(mode)}
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm leading-relaxed placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 resize-y min-h-40"
        />
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={onSavePrompt}
            disabled={!draft.trim() || draft.trim() === cfg.systemPrompt}
            className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-40"
          >
            保存
          </button>
          <button
            type="button"
            onClick={onReset}
            className="h-9 px-3 rounded-lg border border-border text-xs text-muted-foreground hover:bg-muted/30 transition-colors"
          >
            恢复默认
          </button>
          {hint && <span className="text-xs text-emerald-600">{hint}</span>}
        </div>
      </div>

      <div className="rounded-2xl border border-border/50 bg-white px-5 py-2">
        <div className="pt-3 pb-1">
          <p className="text-sm font-semibold text-foreground">Tool Call</p>
          <p className="text-xs text-muted-foreground mt-1">
            启用后挂载为真实 OpenAI function tools。Agent 可用 get_node / update_node / submit_nodes 控制节点，summarize_context 压缩长对话。
          </p>
        </div>
        {cfg.tools.map((t) => (
          <ToolRow key={t.id} tool={t} onToggle={() => onToggleTool(t.id, !t.enabled)} />
        ))}
      </div>
    </div>
  );
}
