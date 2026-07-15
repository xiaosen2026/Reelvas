'use client';

// TTS 高级模式：角色 → 音色映射

import { Plus, Trash2 } from 'lucide-react';
import { Dropdown } from './Dropdown';
import type { TtsCastMember } from '../../../lib/llm/ttsDialogue';
import type { SpeechVoiceOption } from '../../../lib/llm/openaiSpeech';

type Props = {
  cast: TtsCastMember[];
  voiceOptions: SpeechVoiceOption[];
  disabled?: boolean;
  onChange: (next: TtsCastMember[]) => void;
};

export function TtsCastEditor({
  cast,
  voiceOptions,
  disabled,
  onChange,
}: Props) {
  const update = (i: number, patch: Partial<TtsCastMember>) => {
    onChange(cast.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  };

  const remove = (i: number) => {
    if (cast.length <= 1) return;
    onChange(cast.filter((_, idx) => idx !== i));
  };

  const add = () => {
    const used = new Set(cast.map((c) => c.voice));
    const nextVoice =
      voiceOptions.find((v) => !used.has(v.value))?.value ||
      voiceOptions[0]?.value ||
      '';
    onChange([...cast, { name: `角色${cast.length + 1}`, voice: nextVoice }]);
  };

  return (
    <div className="flex flex-col gap-1.5 px-0.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">角色音色</span>
        <button
          type="button"
          disabled={disabled}
          onClick={add}
          className="flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-40"
        >
          <Plus className="size-3" />
          添加
        </button>
      </div>
      {cast.map((c, i) => (
        <div key={`${i}-${c.name}`} className="flex items-center gap-1 min-w-0">
          <input
            value={c.name}
            disabled={disabled}
            onChange={(e) => update(i, { name: e.target.value })}
            placeholder="角色名"
            className="w-18 shrink-0 rounded-md border border-border bg-transparent px-1.5 py-1 text-[11px] outline-none focus:border-zinc-400"
          />
          <div className="flex-1 min-w-0">
            <Dropdown
              value={
                voiceOptions.some((x) => x.value === c.voice)
                  ? c.voice
                  : voiceOptions[0]?.value || c.voice
              }
              options={voiceOptions}
              onChange={(v) => update(i, { voice: v })}
            />
          </div>
          <button
            type="button"
            title="删除角色"
            disabled={disabled || cast.length <= 1}
            onClick={() => remove(i)}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground disabled:opacity-30"
          >
            <Trash2 className="size-3" />
          </button>
        </div>
      ))}
      <p className="text-[10px] text-muted-foreground leading-snug">
        脚本格式：
        <code className="text-[10px]">@角色名[台词]</code>
        ，选中台词后按 @ 插入；与列表角色名一致才用对应音色
      </p>
    </div>
  );
}
