'use client';

import type { RefObject } from 'react';
import { Check } from 'lucide-react';
import { ContextWindowInfo } from './ContextWindowInfo';
import { CopilotMentionInput } from './CopilotMentionInput';
import { FloatingMenu } from './FloatingMenu';
import type { CopilotMsg } from './useCopilotChat';
import type { TextModelOption } from '../../lib/settingsStore';
import {
  CHAT_MODES,
  IChevron,
  IMsg,
  ISend,
  ISettings2,
  ISquare,
} from './copilotIcons';

type GenPerm = { image: boolean; video: boolean; audio: boolean; music: boolean };
type Drop = null | 'mode' | 'model';

export function CopilotComposer({
  input,
  setInput,
  loading,
  stop,
  onSend,
  mode,
  setMode,
  model,
  setModel,
  modelOptions,
  openDrop,
  setOpenDrop,
  chatSettings,
  setChatSettings,
  genPerm,
  setPermDialogOpen,
  messages,
  modeSystemPrompt,
  onCompressContext,
  openModelDrop,
  modeBtnRef,
  settingsBtnRef,
  modelBtnRef,
}: {
  input: string;
  setInput: (v: string) => void;
  loading: boolean;
  stop: () => void;
  onSend: () => void;
  mode: string;
  setMode: (m: string) => void;
  model: string;
  setModel: (m: string) => void;
  modelOptions: TextModelOption[];
  openDrop: Drop;
  setOpenDrop: React.Dispatch<React.SetStateAction<Drop>>;
  chatSettings: boolean;
  setChatSettings: React.Dispatch<React.SetStateAction<boolean>>;
  genPerm: GenPerm;
  setPermDialogOpen: (v: boolean) => void;
  messages: CopilotMsg[];
  modeSystemPrompt: string;
  onCompressContext: () => void;
  openModelDrop: (e: React.MouseEvent) => void;
  modeBtnRef: RefObject<HTMLButtonElement | null>;
  settingsBtnRef: RefObject<HTMLButtonElement | null>;
  modelBtnRef: RefObject<HTMLButtonElement | null>;
}) {
  const CurrentModeIcon = CHAT_MODES.find((m) => m.key === mode)?.Icon ?? IMsg;
  const permShort = (() => {
    const items: string[] = [];
    if (genPerm.image) items.push('图');
    if (genPerm.video) items.push('视');
    if (genPerm.audio) items.push('音');
    if (genPerm.music) items.push('乐');
    return items.length ? items.join('') : '权限';
  })();

  return (
    <>
      <div className="shrink-0 border-t border-border bg-background">
        <div className="px-3 pt-2">
          <CopilotMentionInput
            value={input}
            onChange={setInput}
            onSubmit={onSend}
            onStop={stop}
            loading={loading}
            placeholder="消息… @Skill · Enter 发送 · Shift+Enter 换行"
          />
        </div>
        <div className="flex items-center justify-between gap-1 px-2.5 pb-2 pt-1">
          <div className="flex min-w-0 items-center gap-1">
            <button
              ref={modeBtnRef}
              type="button"
              aria-label="选择对话模式"
              onClick={(e) => {
                e.stopPropagation();
                setChatSettings(false);
                setOpenDrop(openDrop === 'mode' ? null : 'mode');
              }}
              className="flex h-7 min-w-[72px] items-center justify-between gap-1 rounded-md bg-muted px-2 text-[11px] font-medium text-foreground hover:bg-muted/80"
            >
              <span className="flex min-w-0 items-center gap-1 truncate">
                <CurrentModeIcon />
                <span className="truncate">{mode}</span>
              </span>
              <IChevron />
            </button>
            {mode === 'Agent' ? (
              <button
                type="button"
                onClick={() => setPermDialogOpen(true)}
                className="max-w-[7rem] truncate text-[10px] text-muted-foreground underline decoration-dotted underline-offset-2 hover:text-foreground"
                title="生成权限"
              >
                {permShort}
              </button>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <ContextWindowInfo
              messages={messages}
              draft={input}
              model={model}
              systemPrompt={modeSystemPrompt}
              onCompress={onCompressContext}
            />
            <button
              ref={settingsBtnRef}
              type="button"
              aria-label="聊天设置"
              onClick={(e) => {
                e.stopPropagation();
                setOpenDrop(null);
                setChatSettings((v) => !v);
              }}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ISettings2 />
            </button>
            <button
              ref={modelBtnRef}
              type="button"
              aria-label="选择模型"
              onClick={openModelDrop}
              className="flex h-7 max-w-[100px] min-w-[64px] items-center justify-between gap-0.5 rounded-md px-1.5 text-xs text-foreground hover:bg-muted"
            >
              <span className="truncate">{model}</span>
              <IChevron />
            </button>
            <button
              type="button"
              aria-label={loading ? '停止生成' : '发送消息'}
              disabled={!loading && !input.trim()}
              onClick={() => {
                if (loading) stop();
                else onSend();
              }}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-default disabled:opacity-40"
            >
              {loading ? <ISquare /> : <ISend />}
            </button>
          </div>
        </div>
      </div>

      <FloatingMenu open={openDrop === 'mode'} anchorRef={modeBtnRef} align="left" minWidth={120} maxWidth={160} className="p-1">
        {CHAT_MODES.map(({ key, Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setMode(key);
              setOpenDrop(null);
              if (key === 'Agent') setPermDialogOpen(true);
            }}
            className="relative flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors text-foreground"
          >
            <span className="text-muted-foreground"><Icon /></span>
            <span>{key}</span>
            <span className="ml-auto flex h-3.5 w-3.5 items-center justify-center">
              {key === mode ? <Check className="w-3.5 h-3.5" /> : null}
            </span>
          </button>
        ))}
      </FloatingMenu>

      <FloatingMenu open={chatSettings} anchorRef={settingsBtnRef} align="right" minWidth={256} maxWidth={280} className="p-3">
        <p className="mb-3 text-xs font-semibold text-foreground">聊天设置</p>
        <p className="text-center text-[11px] text-muted-foreground">设置 → 会话助手</p>
      </FloatingMenu>

      <FloatingMenu open={openDrop === 'model'} anchorRef={modelBtnRef} align="right" minWidth={220} maxWidth={300} maxHeight={280} className="p-1">
        {modelOptions.length === 0 ? (
          <p className="px-2 py-2 text-xs text-muted-foreground">暂无模型，请在设置 → 文本模型中获取</p>
        ) : (
          modelOptions.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => {
                setModel(m.value);
                setOpenDrop(null);
              }}
              className="relative flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors text-foreground"
            >
              <span className="min-w-0 flex-1 truncate text-left">{m.label}</span>
              <span className="flex h-3.5 w-5 shrink-0 items-center justify-center">
                {m.value === model ? <Check className="w-3.5 h-3.5" /> : null}
              </span>
            </button>
          ))
        )}
      </FloatingMenu>
    </>
  );
}
