'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  createSession,
  ensureActiveSession,
  listSessions,
  removeSession,
  saveSession,
  setActiveSessionId,
  type CopilotSession,
} from '../../lib/copilotSessionStore';
import { listTextModelOptions, type TextModelOption } from '../../lib/settingsStore';
import { CopilotSessionList } from './CopilotSessionList';
import { CopilotTranscript } from './CopilotTranscript';
import { getModeAssistantConfig, isCopilotMode, type CopilotMode } from '../../lib/copilotAssistantStore';
import { useCopilotChat } from './useCopilotChat';
import type { WorkflowHandle } from './CanvasFlowCore';
import { createLogger } from '../../lib/logger';
import { AgentPermissionDialog } from './AgentPermissionDialog';
import { AskUserDialog } from './AskUserDialog';
import { COPILOT_ICON_BTN as gb, IPanelRight, IPlus, IX } from './copilotIcons';
import { CopilotComposer } from './CopilotComposer';

const log = createLogger('CopilotPanel');

export function CopilotPanel({
  onClose,
  workflowRef,
}: {
  onClose?: () => void;
  workflowRef?: React.MutableRefObject<WorkflowHandle | null>;
}) {
  const [modelOptions, setModelOptions] = useState<TextModelOption[]>([
    { value: 'grok-4.5', label: 'grok-4.5', icon: '🌀', desc: '本地 · OpenAI 兼容' },
  ]);
  const [showSessions, setShowSessions] = useState(false);
  const [sessions, setSessions] = useState<CopilotSession[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionQuery, setSessionQuery] = useState('');
  const [input, setInput] = useState('');
  const [mode, setMode] = useState('Ask');
  const [model, setModel] = useState('grok-4.5');
  const [openDrop, setOpenDrop] = useState<null | 'mode' | 'model'>(null);
  const [chatSettings, setChatSettings] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const modeBtnRef = useRef<HTMLButtonElement>(null);
  const settingsBtnRef = useRef<HTMLButtonElement>(null);
  const modelBtnRef = useRef<HTMLButtonElement>(null);
  const sessionIdRef = useRef<string | null>(null);
  sessionIdRef.current = sessionId;
  const [genPerm, setGenPerm] = useState({ image: false, video: false, audio: false, music: false });
  const [permDialogOpen, setPermDialogOpen] = useState(false);

  const {
    messages,
    loading,
    error,
    send,
    stop,
    loadMessages,
    askRequest,
    answerAskUser,
  } = useCopilotChat(model);
  const modeKey: CopilotMode = isCopilotMode(mode) ? mode : 'Ask';
  const modeSystemPrompt = getModeAssistantConfig(modeKey).systemPrompt;
  const anyOpen = openDrop !== null || chatSettings;

  const refreshSessions = useCallback(() => {
    setSessions(listSessions());
  }, []);

  const closeAll = useCallback(() => {
    setOpenDrop(null);
    setChatSettings(false);
  }, []);

  const refreshModels = useCallback(() => {
    const opts = listTextModelOptions();
    setModelOptions(opts);
    return opts;
  }, []);

  useEffect(() => {
    const opts = refreshModels();
    const s = ensureActiveSession(opts[0]?.value ?? 'grok-4.5');
    setSessionId(s.id);
    setModel(s.model || opts[0]?.value || 'grok-4.5');
    loadMessages(s.messages ?? []);
    refreshSessions();
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated || !sessionId) return;
    saveSession(sessionId, { messages, model });
    refreshSessions();
  }, [messages, model, sessionId, hydrated, refreshSessions]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  const onSelectSession = useCallback(
    (id: string) => {
      if (id === sessionIdRef.current) return;
      if (sessionIdRef.current) {
        saveSession(sessionIdRef.current, { messages, model });
      }
      const s = listSessions().find((x) => x.id === id);
      if (!s) { refreshSessions(); return; }
      setActiveSessionId(s.id);
      setSessionId(s.id);
      if (s.model) setModel(s.model);
      loadMessages(s.messages ?? []);
      setInput('');
      refreshSessions();
    },
    [loadMessages, messages, model, refreshSessions],
  );

  const onNewChat = useCallback(() => {
    if (sessionIdRef.current) {
      saveSession(sessionIdRef.current, { messages, model });
    }
    const empty = listSessions().find((s) => s.messages.length === 0 && s.title === '新对话');
    const s = empty ?? createSession(model);
    setActiveSessionId(s.id);
    setSessionId(s.id);
    loadMessages([]);
    setInput('');
    setShowSessions(true);
    refreshSessions();
  }, [loadMessages, messages, model, refreshSessions]);

  const onDeleteSession = useCallback(
    (id: string) => {
      removeSession(id);
      if (id === sessionIdRef.current) {
        const next = listSessions()[0] ?? createSession(model);
        setActiveSessionId(next.id);
        setSessionId(next.id);
        if (next.model) setModel(next.model);
        loadMessages(next.messages ?? []);
      }
      refreshSessions();
    },
    [loadMessages, model, refreshSessions],
  );

  const onCompressContext = useCallback(() => {
    if (messages.length < 4) return;
    const kept = messages.slice(-6);
    loadMessages(kept);
    if (sessionIdRef.current) {
      saveSession(sessionIdRef.current, { messages: kept, model });
      refreshSessions();
    }
  }, [loadMessages, messages, model, refreshSessions]);

  const onSend = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    if (!sessionIdRef.current) {
      const s = createSession(model);
      setSessionId(s.id);
      setActiveSessionId(s.id);
      refreshSessions();
    }
    setInput('');
    await send(text, { mode, workflow: workflowRef?.current ?? null, genPerm } as any);
  }, [input, loading, mode, model, send, refreshSessions, workflowRef, genPerm]);

  const openModelDrop = (e: React.MouseEvent) => {
    e.stopPropagation();
    setChatSettings(false);
    if (openDrop === 'model') {
      setOpenDrop(null);
      return;
    }
    const opts = refreshModels();
    if (opts[0] && !opts.some((m) => m.value === model)) setModel(opts[0].value);
    setOpenDrop('model');
  };

  const backdrop =
    anyOpen && typeof document !== 'undefined'
      ? createPortal(
          <div className="fixed inset-0 z-[9990]" onClick={closeAll} aria-hidden />,
          document.body,
        )
      : null;

  return (
    <React.Fragment>
      {backdrop}
      {/* 实心面板 + flex 分栏：上会话流、下工具栏（Claude Code / Codex 结构），避免毛玻璃叠层闪烁 */}
      <div
        className="absolute top-[calc(var(--titlebar-height)+0.5rem)] right-4 z-50 h-[calc(100%-var(--titlebar-height)-1.5rem)] flex flex-row overflow-hidden rounded-xl border border-border bg-background shadow-sm"
        style={{ width: showSessions ? 624 : 400 }}
      >
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="text-sm font-semibold text-foreground">Copilot</span>
              <span className="truncate rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{mode}</span>
            </div>
            <div className="flex items-center gap-0.5">
              <button type="button" title="新建对话" onClick={onNewChat} className={gb}><IPlus /></button>
              <button
                type="button"
                title="会话列表"
                onClick={() => setShowSessions((v) => !v)}
                className={showSessions ? `${gb} bg-muted text-foreground` : gb}
              >
                <IPanelRight />
              </button>
              <button type="button" title="关闭" onClick={onClose} className={gb}><IX /></button>
            </div>
          </div>

          {/* 会话区：仅此区域滚动 */}
          <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
            <CopilotTranscript
              messages={messages}
              loading={loading}
              error={error}
              mode={mode}
              onPickAction={setInput}
              workflowRef={workflowRef}
            />
          </div>

          {/* 工具栏：钉在底部，实心，不叠在会话上 */}
          <CopilotComposer
            input={input}
            setInput={setInput}
            loading={loading}
            stop={stop}
            onSend={() => { void onSend(); }}
            mode={mode}
            setMode={setMode}
            model={model}
            setModel={setModel}
            modelOptions={modelOptions}
            openDrop={openDrop}
            setOpenDrop={setOpenDrop}
            chatSettings={chatSettings}
            setChatSettings={setChatSettings}
            genPerm={genPerm}
            setPermDialogOpen={setPermDialogOpen}
            messages={messages}
            modeSystemPrompt={modeSystemPrompt}
            onCompressContext={onCompressContext}
            openModelDrop={openModelDrop}
            modeBtnRef={modeBtnRef}
            settingsBtnRef={settingsBtnRef}
            modelBtnRef={modelBtnRef}
          />
        </div>

        {showSessions ? (
          <CopilotSessionList
            sessions={sessions}
            activeId={sessionId}
            query={sessionQuery}
            onQuery={setSessionQuery}
            onSelect={onSelectSession}
            onDelete={onDeleteSession}
          />
        ) : null}
      </div>

      <AgentPermissionDialog
        open={permDialogOpen}
        initial={genPerm}
        onClose={(p) => { setGenPerm(p); setPermDialogOpen(false); }}
      />
      <AskUserDialog
        open={Boolean(askRequest)}
        request={askRequest}
        onAnswer={answerAskUser}
      />
    </React.Fragment>
  );
}
