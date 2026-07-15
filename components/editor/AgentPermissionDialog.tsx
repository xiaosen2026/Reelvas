'use client';

// Agent 权限授权对话框——首次切 Agent 时弹窗，类似 Cursor/Claude 的「需要你的授权」
// 之后可在输入框下方修改权限

import { useEffect, useRef, useState } from 'react';
import { Bot, Image as ImageIcon, Video, Music, Film, Shield, X } from 'lucide-react';
import type { GenPerm } from '../../lib/copilotGenPerm';
import { GEN_PERM_LABELS } from '../../lib/copilotGenPerm';

type Props = {
  open: boolean;
  onClose: (perm: GenPerm) => void;
  /** 如果之前已授权部分，传进去默认勾上 */
  initial?: Partial<GenPerm>;
};

const ALL_KEYS: (keyof GenPerm)[] = ['image', 'video', 'audio', 'music'];

export function AgentPermissionDialog({ open, onClose, initial }: Props) {
  const [local, setLocal] = useState<GenPerm>({
    image: initial?.image ?? false,
    video: initial?.video ?? false,
    audio: initial?.audio ?? false,
    music: initial?.music ?? false,
  });
  const [tip, setTip] = useState('');
  const bgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setLocal({
        image: initial?.image ?? false,
        video: initial?.video ?? false,
        audio: initial?.audio ?? false,
        music: initial?.music ?? false,
      });
      setTip('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const allOn = ALL_KEYS.every((k) => local[k]);
  const anyOn = ALL_KEYS.some((k) => local[k]);

  return (
    <div
      ref={bgRef}
      className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === bgRef.current && anyOn) {
          onClose(local);
        }
      }}
    >
      <div className="w-[min(480px,92vw)] rounded-xl border border-border/60 bg-card shadow-lg overflow-hidden">
        {/* header */}
        <div className="flex items-center gap-3 px-5 pt-5 pb-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            <Shield className="size-5" />
          </span>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-foreground">Agent 需要你的授权</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Agent 将在画布上创建节点、连线、提交生成任务。选择允许的自动操作：
            </p>
          </div>
          <button type="button" onClick={() => anyOn ? onClose(local) : null} className="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted/50">
            <X className="size-4" />
          </button>
        </div>

        {/* permission list */}
        <div className="px-5 py-3 space-y-2">
          {ALL_KEYS.map((k) => {
            const checked = local[k];
            return (
              <label
                key={k}
                className={`flex items-center gap-3 p-2.5 rounded-lg border transition-colors cursor-pointer ${
                  checked
                    ? 'border-emerald-300 bg-emerald-50/60'
                    : 'border-border/50 hover:border-border bg-muted/20'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => setLocal((p) => ({ ...p, [k]: !p[k] }))}
                  className="accent-emerald-600 size-4"
                />
                <span className="flex items-center gap-2 text-xs text-foreground flex-1 min-w-0">
                  <span className={`flex size-7 items-center justify-center rounded-lg ${
                    checked ? 'bg-emerald-200/60 text-emerald-700' : 'bg-muted/50 text-muted-foreground'
                  }`}>
                    {k === 'image' ? <ImageIcon className="size-4" /> : k === 'video' ? <Video className="size-4" /> : k === 'audio' ? <Music className="size-4" /> : <Film className="size-4" />}
                  </span>
                  <span>
                    <span className="font-medium">{GEN_PERM_LABELS[k]}</span>
                    <span className="ml-2 text-muted-foreground">
                      {k === 'image' ? '自动生图' : k === 'video' ? '自动生成视频' : k === 'audio' ? '自动生成音频' : '自动生成音乐'}
                    </span>
                  </span>
                </span>
                {checked && <span className="text-[10px] text-emerald-600 font-medium">已授权</span>}
              </label>
            );
          })}
        </div>

        {/* tip */}
        {tip ? <p className="px-5 pb-1 text-[10px] text-amber-600">{tip}</p> : null}

        {/* actions */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border/30 bg-muted/10">
          <p className="text-[10px] text-muted-foreground">
            {allOn ? '已允许所有自动操作' : anyOn ? '只允许勾选的自动操作' : '暂不授权，仅搭节点框架'}
          </p>
          <div className="flex gap-2">
            {!anyOn ? (
              <button
                type="button"
                onClick={() => setLocal({ image: true, video: true, audio: true, music: true })}
                className="h-8 px-3 rounded-lg border border-border text-xs text-muted-foreground hover:bg-muted/30"
              >
                全选
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                if (!anyOn) {
                  setTip('至少授权一项，或关闭对话框使用 Ask 模式');
                  return;
                }
                onClose(local);
              }}
              className={`h-8 px-4 rounded-lg text-xs font-medium transition-colors ${
                anyOn
                  ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {anyOn ? `确认授权 (${ALL_KEYS.filter((k) => local[k]).length})` : '暂不授权'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
