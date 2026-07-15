'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Switch } from './Switch';
import { ModelSelect } from './ModelSelect';
import { TEXT_MODELS, IMAGE_MODELS, VIDEO_MODELS } from '../../../lib/settingsData';
import {
  CANVAS_AGENT_GUIDE_FILENAME,
  downloadCanvasAgentGuide,
} from '../../../lib/canvasAgentGuide';
import { bridgeWsUrl, CANVAS_BRIDGE_DEFAULT_PORT } from '../../../lib/canvasBridgeProtocol';
import { createLogger } from '../../../lib/logger';

const log = createLogger('AgentTab');

const IDownload = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" x2="12" y1="15" y2="3" />
  </svg>
);
const ICard = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="4" width="16" height="16" rx="2" />
    <path d="M8 12h8" />
    <path d="M8 16h5" />
  </svg>
);
const IPin = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);
const ICheck = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);
const ICube = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="m21 16-9 5-9-5V8l9-5 9 5Z" />
    <path d="M3.27 6.96 12 12.01l8.73-5.05" />
    <path d="M12 22.08V12" />
  </svg>
);
const ISpark = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3 9.8 8.2 4.5 10.4l5.3 2.2L12 18l2.2-5.4 5.3-2.2-5.3-2.2Z" />
    <path d="M19 15v4" />
    <path d="M17 17h4" />
  </svg>
);

function SettingRow({
  icon,
  title,
  desc,
  checked,
  onChange,
}: {
  icon: ReactNode;
  title: string;
  desc: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/40 py-5 last:border-b-0">
      <div className="flex items-center gap-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          {icon}
        </span>
        <div>
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
        </div>
      </div>
      <Switch checked={checked} onChange={onChange} label={title} />
    </div>
  );
}

function bridgePort(): number {
  if (typeof window === 'undefined') return CANVAS_BRIDGE_DEFAULT_PORT;
  const p = Number(window.location?.port || 0);
  return p > 0 ? p : CANVAS_BRIDGE_DEFAULT_PORT;
}

export function AgentTab() {
  const [autoQuality, setAutoQuality] = useState(false);
  const [autoPlace, setAutoPlace] = useState(true);
  const [stepConfirm, setStepConfirm] = useState(true);
  const [textModel, setTextModel] = useState('GPT-5.4');
  const [imageModel, setImageModel] = useState('Banana Pro');
  const [videoModel, setVideoModel] = useState('Omni Flash');
  const [bridgeOk, setBridgeOk] = useState<boolean | null>(null);
  const [bridgeHint, setBridgeHint] = useState('');

  const probeBridge = useCallback(() => {
    const url = bridgeWsUrl(bridgePort());
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
      const timer = window.setTimeout(() => done(false, '连接超时 — 请用 npm run serve:tts 打开本页'), 2500);
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

  const onDownloadGuide = () => {
    downloadCanvasAgentGuide();
    log.info('onDownloadGuide', 'ok', { file: CANVAS_AGENT_GUIDE_FILENAME });
  };

  return (
    <div className="space-y-7">
      <div className="flex items-center gap-4 rounded-2xl border border-border/50 bg-indigo-50/80 px-6 py-4">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-white text-indigo-500 shadow-sm">
          <ISpark />
        </span>
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-medium text-foreground">想用 Codex / Claude Code 等外部 Agent 操作画布？</p>
          <button
            type="button"
            onClick={onDownloadGuide}
            className="mt-1 inline-flex items-center gap-1 text-blue-600 transition-colors hover:underline"
          >
            <IDownload />
            下载 {CANVAS_AGENT_GUIDE_FILENAME}
          </button>
          <span className="ml-1 text-muted-foreground">喂给 Agent，并配置 MCP + Skill</span>
          <p className="mt-2 text-[11px] text-muted-foreground">
            MCP：<code className="rounded bg-white/80 px-1">node scripts/mcp-canvas-server.js</code>
            {' · '}
            桥：
            <code className="rounded bg-white/80 px-1">{bridgeWsUrl(bridgePort())}</code>
          </p>
          <p className="mt-1 text-[11px]">
            <span
              className={
                bridgeOk === true
                  ? 'text-emerald-700'
                  : bridgeOk === false
                    ? 'text-red-600'
                    : 'text-muted-foreground'
              }
            >
              MCP 桥：{bridgeOk === null ? '检测中…' : bridgeOk ? '在线' : '离线'}
              {bridgeHint ? ` — ${bridgeHint}` : ''}
            </span>
            <button
              type="button"
              onClick={probeBridge}
              className="ml-2 text-blue-600 hover:underline"
            >
              重试
            </button>
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-border/50 bg-white px-6">
        <SettingRow
          icon={<ICard />}
          title="自动质量评估"
          desc="自动评价产出质量，不达标时返工"
          checked={autoQuality}
          onChange={() => setAutoQuality((v) => !v)}
        />
        <SettingRow
          icon={<IPin />}
          title="节点自动选位"
          desc="每步自动选择放置节点的位置"
          checked={autoPlace}
          onChange={() => setAutoPlace((v) => !v)}
        />
        <SettingRow
          icon={<ICheck />}
          title="每步确认"
          desc="多步计划时每步完成后等待你确认再继续"
          checked={stepConfirm}
          onChange={() => setStepConfirm((v) => !v)}
        />
      </div>

      <div className="rounded-2xl border border-border/50 bg-white px-6 py-5">
        <div className="mb-5 flex items-center gap-4">
          <span className="flex size-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <ICube />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">模型偏好</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Agent 优先使用的模型；不满足具体需求时 Agent 可自主选择
            </p>
          </div>
        </div>
        <div className="space-y-4 pl-14">
          <ModelSelect label="文本模型" models={TEXT_MODELS} value={textModel} onChange={setTextModel} />
          <ModelSelect label="图像模型" models={IMAGE_MODELS} value={imageModel} onChange={setImageModel} />
          <ModelSelect label="视频模型" models={VIDEO_MODELS} value={videoModel} onChange={setVideoModel} />
        </div>
      </div>
    </div>
  );
}
