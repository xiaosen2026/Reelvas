'use client';

// 视频节点参数条：模型 / 画质 / 比例 / 时长 / 数量（精简，无自定义展开）

import { Dropdown } from './Dropdown';

export type VideoCustomParams = {
  duration: string;
  /** 保留字段兼容旧数据，UI 不再暴露 */
  width: string;
  height: string;
  fps: string;
  seed: string;
  negativePrompt: string;
};

export const RES_OPTIONS = ['480p', '720p', '1080p'].map((v) => ({ value: v, label: v }));
export const RATIO_OPTIONS = ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'].map((v) => ({
  value: v,
  label: v,
}));
export const DURATION_OPTIONS = [
  '2秒',
  '3秒',
  '4秒',
  '5秒',
  '6秒',
  '8秒',
  '10秒',
  '12秒',
  '15秒',
  '20秒',
].map((v) => ({ value: v, label: v }));
export const QTY_OPTIONS = ['1x', '2x', '3x', '4x'].map((v) => ({ value: v, label: v }));

export function durationToSeconds(raw: string): number {
  const n = parseInt(String(raw || '').replace(/[^\d]/g, ''), 10);
  if (!Number.isFinite(n) || n <= 0) return 6;
  return Math.min(20, n);
}

export function secondsToDuration(n: number): string {
  return `${Math.min(20, Math.max(1, Math.round(n)))}秒`;
}

export function emptyCustomParams(partial?: Partial<VideoCustomParams>): VideoCustomParams {
  return {
    duration: partial?.duration || '6秒',
    width: partial?.width || '',
    height: partial?.height || '',
    fps: partial?.fps || '',
    seed: partial?.seed || '',
    negativePrompt: partial?.negativePrompt || '',
  };
}

type ModelOpt = { value: string; label: string; desc?: string; icon?: React.ReactNode };

type Props = {
  model: string;
  modelOptions: ModelOpt[];
  defaultModel: string;
  onModelChange: (v: string) => void;
  res: string;
  ratio: string;
  qty: string;
  custom: VideoCustomParams;
  onRes: (v: string) => void;
  onRatio: (v: string) => void;
  onQty: (v: string) => void;
  onCustom: (next: VideoCustomParams) => void;
  disabled?: boolean;
};

export function VideoParamsBar({
  model,
  modelOptions,
  defaultModel,
  onModelChange,
  res,
  ratio,
  qty,
  custom,
  onRes,
  onRatio,
  onQty,
  onCustom,
  disabled,
}: Props) {
  const sec = durationToSeconds(custom.duration);
  const durationValue = DURATION_OPTIONS.some((d) => d.value === custom.duration)
    ? custom.duration
    : secondsToDuration(sec);

  return (
    <div
      className={`flex items-center gap-1 flex-wrap min-w-0 rounded-xl border border-border/60 bg-muted/25 p-1 ${
        disabled ? 'opacity-50 pointer-events-none' : ''
      }`}
    >
      <div className="flex items-center gap-0.5 pl-1 min-w-0">
        <span className="text-[10px] font-medium text-muted-foreground/70 shrink-0">模型</span>
        <Dropdown
          value={model}
          options={modelOptions.length ? modelOptions : [{ value: defaultModel, label: defaultModel }]}
          onChange={onModelChange}
          wide
        />
      </div>

      <span className="w-px self-stretch my-1 bg-border/60 shrink-0" />

      <div className="flex items-center gap-0.5 pl-1 shrink-0">
        <span className="text-[10px] font-medium text-muted-foreground/70 shrink-0">画质</span>
        <Dropdown value={res} options={RES_OPTIONS} onChange={onRes} />
        <Dropdown value={ratio} options={RATIO_OPTIONS} onChange={onRatio} />
      </div>

      <span className="w-px self-stretch my-1 bg-border/60 shrink-0" />

      <div className="flex items-center gap-0.5 shrink-0">
        <span className="text-[10px] font-medium text-muted-foreground/70 shrink-0">时长</span>
        <Dropdown
          value={durationValue}
          options={DURATION_OPTIONS}
          onChange={(v) => onCustom({ ...custom, duration: v })}
        />
      </div>

      <span className="w-px self-stretch my-1 bg-border/60 shrink-0" />

      <div className="flex items-center gap-0.5 shrink-0">
        <span className="text-[10px] font-medium text-muted-foreground/70 shrink-0">数量</span>
        <Dropdown value={qty} options={QTY_OPTIONS} onChange={onQty} />
      </div>
    </div>
  );
}
