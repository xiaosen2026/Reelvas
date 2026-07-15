'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  getDefaultEnhancePrompt,
  getEnhancePromptConfig,
  resetEnhancePromptConfig,
  setEnhancePromptConfig,
  type EnhanceNodeKind,
  type EnhancePromptConfig,
} from '../../../lib/enhancePromptStore';

export function EnhancePromptSection({ kind }: { kind: EnhanceNodeKind }) {
  const [cfg, setCfg] = useState<EnhancePromptConfig>(() => getEnhancePromptConfig(kind));
  const [draft, setDraft] = useState(cfg.systemPrompt);
  const [savedHint, setSavedHint] = useState('');

  useEffect(() => {
    const next = getEnhancePromptConfig(kind);
    setCfg(next);
    setDraft(next.systemPrompt);
    setSavedHint('');
  }, [kind]);

  const persist = useCallback(
    (patch: Partial<EnhancePromptConfig>) => {
      const next = setEnhancePromptConfig(kind, patch);
      setCfg(next[kind]);
      if (patch.systemPrompt !== undefined) setDraft(next[kind].systemPrompt);
      setSavedHint('已保存');
      window.setTimeout(() => setSavedHint(''), 1500);
    },
    [kind],
  );

  const onSave = () => {
    if (!draft.trim()) return;
    persist({ systemPrompt: draft.trim() });
  };

  const onReset = () => {
    const next = resetEnhancePromptConfig(kind);
    setCfg(next[kind]);
    setDraft(next[kind].systemPrompt);
    setSavedHint('已恢复默认');
    window.setTimeout(() => setSavedHint(''), 1500);
  };

  return (
    <div className="rounded-2xl border border-border/50 bg-white p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="text-sm font-semibold text-foreground">增强提示词</p>
          <p className="text-xs text-muted-foreground mt-1">
            节点输入框右下角 ✨ 按钮：用下方 system prompt 调用本地文本模型改写提示词
          </p>
        </div>
        <button
          type="button"
          onClick={() => persist({ enabled: !cfg.enabled })}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            cfg.enabled ? 'bg-emerald-500' : 'bg-muted'
          }`}
          title={cfg.enabled ? '已启用' : '已关闭'}
        >
          <span
            className={`block h-5 w-5 rounded-full bg-white shadow transition-transform ${
              cfg.enabled ? 'translate-x-5.5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      <label className="block text-xs font-medium text-foreground mb-1.5">
        增强用 System Prompt
      </label>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        disabled={!cfg.enabled}
        rows={6}
        placeholder={getDefaultEnhancePrompt(kind)}
        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm leading-relaxed placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 resize-y min-h-28 disabled:opacity-50"
      />

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={!cfg.enabled || !draft.trim() || draft.trim() === cfg.systemPrompt}
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
        {savedHint ? (
          <span className="text-xs text-emerald-600 tabular-nums">{savedHint}</span>
        ) : null}
      </div>
    </div>
  );
}
