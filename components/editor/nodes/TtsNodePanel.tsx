'use client';

// TTS 节点面板：模式 / 文本 / 角色 / 模型

import {
  AudioLines,
  Sparkles,
  ArrowUp,
  Loader2,
  Square,
  Users,
  Wand2,
} from 'lucide-react';
import { Dropdown } from './Dropdown';
import { TtsCastEditor } from './TtsCastEditor';
import { TtsAtScriptInput } from './TtsAtScriptInput';
import {
  defaultSpeechVoice,
  listSpeechVoices,
  type SpeechVoiceOption,
} from '../../../lib/llm/openaiSpeech';
import {
  syncCastFromScript,
  type TtsCastMember,
  type TtsMode,
} from '../../../lib/llm/ttsDialogue';

const MODE_OPTIONS = [
  { value: 'normal', label: '普通模式' },
  { value: 'advanced', label: '高级 · 多人' },
];

export type TtsPanelModelOpt = {
  value: string;
  label: string;
  desc?: string;
  icon?: React.ReactNode;
};

type Props = {
  text: string;
  model: string;
  voice: string;
  mode: TtsMode;
  cast: TtsCastMember[];
  modelOptions: TtsPanelModelOpt[];
  defaultModel: string;
  voiceOptions: SpeechVoiceOption[];
  loading: boolean;
  enhancing: boolean;
  statusError: string;
  onText: (v: string) => void;
  onMode: (m: TtsMode) => void;
  onModel: (v: string, voice: string, cast: TtsCastMember[]) => void;
  onVoice: (v: string) => void;
  onCast: (c: TtsCastMember[]) => void;
  onSubmit: () => void;
  onStop: () => void;
  onEnhance: () => void;
  onSyncCast: () => void;
  onFillSample: () => void;
};

export function TtsNodePanel(p: Props) {
  const ensureCast = (name: string) => {
    const n = name.trim();
    if (!n) return;
    if (p.cast.some((c) => c.name.trim() === n)) return;
    const used = new Set(p.cast.map((c) => c.voice));
    const nextVoice =
      p.voiceOptions.find((v) => !used.has(v.value))?.value ||
      p.voiceOptions[0]?.value ||
      p.voice;
    p.onCast([...p.cast, { name: n, voice: nextVoice }]);
  };

  return (
    <>
      <div className="flex items-center gap-1.5">
        <Dropdown
          value="ttsGeneration"
          options={[{ value: 'ttsGeneration', label: '语音 TTS' }]}
          onChange={() => {}}
          icon={<AudioLines className="size-4" />}
          size="md"
        />
        <Dropdown
          value={p.mode}
          options={MODE_OPTIONS}
          onChange={(v) => p.onMode(v === 'advanced' ? 'advanced' : 'normal')}
          icon={<Users className="size-3.5" />}
        />
        <div className="flex-1" />
        {p.loading ? (
          <button
            type="button"
            title="停止"
            onClick={p.onStop}
            className="p-1.5 rounded-full border border-border text-muted-foreground hover:text-foreground"
          >
            <Square className="size-3.5 fill-current" />
          </button>
        ) : (
          <button
            type="button"
            onClick={p.onSubmit}
            title="生成语音"
            className="p-1.5 rounded-full bg-primary text-primary-foreground hover:opacity-90"
          >
            <ArrowUp className="size-4" />
          </button>
        )}
      </div>

      <div className="relative">
        {p.mode === 'advanced' ? (
          <TtsAtScriptInput
            value={p.text}
            cast={p.cast}
            disabled={p.loading}
            rows={6}
            placeholder={
              '选中台词后按 @ → 选择角色\n变成：@角色A[台词内容]\n也可手写 @旁白[开场旁白…]'
            }
            onChange={p.onText}
            onEnsureCast={ensureCast}
          />
        ) : (
          <textarea
            value={p.text}
            onChange={(e) => p.onText(e.target.value)}
            rows={4}
            placeholder="输入要朗读的文本…"
            className="w-full resize-none bg-transparent outline-none text-sm leading-relaxed px-1 placeholder:text-muted-foreground"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                p.onSubmit();
              }
            }}
          />
        )}
        <button
          type="button"
          title="增强提示词"
          disabled={!p.text.trim() || p.enhancing || p.loading}
          onClick={p.onEnhance}
          className="absolute bottom-1 right-1 p-1.5 rounded-lg bg-accent/60 hover:bg-accent text-muted-foreground disabled:opacity-40"
        >
          {p.enhancing ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Sparkles className="size-3.5" />
          )}
        </button>
      </div>

      {p.mode === 'advanced' ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              disabled={p.loading}
              onClick={p.onSyncCast}
              className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border border-border text-muted-foreground hover:text-foreground disabled:opacity-40"
            >
              <Wand2 className="size-3" />
              从脚本同步角色
            </button>
            <button
              type="button"
              disabled={p.loading}
              onClick={p.onFillSample}
              className="text-[11px] px-2 py-1 rounded-md border border-border text-muted-foreground hover:text-foreground disabled:opacity-40"
            >
              填入示例剧本
            </button>
          </div>
          <TtsCastEditor
            cast={p.cast}
            voiceOptions={p.voiceOptions}
            disabled={p.loading}
            onChange={p.onCast}
          />
        </div>
      ) : null}

      {p.statusError && !p.loading ? (
        <p className="text-[11px] text-red-500 px-1 line-clamp-2">{p.statusError}</p>
      ) : null}

      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
        <Dropdown
          value={p.model}
          options={
            p.modelOptions.length
              ? p.modelOptions
              : [{ value: p.defaultModel, label: p.defaultModel }]
          }
          onChange={(v) => {
            const nextVoices = listSpeechVoices(v);
            const keep = nextVoices.some((x) => x.value === p.voice);
            const nextVoice = keep ? p.voice : defaultSpeechVoice(v);
            const nextCast = syncCastFromScript(p.text, p.cast, v);
            p.onModel(v, nextVoice, nextCast);
          }}
          icon={<AudioLines className="size-3.5" />}
          wide
        />
        <Dropdown
          value={
            p.voiceOptions.some((x) => x.value === p.voice)
              ? p.voice
              : p.voiceOptions[0]?.value || p.voice
          }
          options={p.voiceOptions}
          onChange={p.onVoice}
        />
      </div>
      {p.mode === 'advanced' ? (
        <p className="text-[10px] text-muted-foreground px-0.5">
          格式 @角色[内容] · 右侧音色为未匹配角色默认声
        </p>
      ) : null}
    </>
  );
}
