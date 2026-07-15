'use client';

// 视频节点顶部工具栏 —— 选中时贴在结果卡片上方
// 高清/音频分离/视频修复：待实现；剪辑：简单裁剪旋转；尾帧截取：末帧 → 上传节点

import { useCallback, useState } from 'react';
import {
  Sparkles, Scissors, Camera, Volume2, Wand2,
  Download, Maximize2, Bot,
} from 'lucide-react';
import { useFlow } from '../flow';
import { NodeTopBar } from './NodeTopBar';
import { TbBtn, IconBtn, Div, MenuWrap, SimpleMenu } from './ImageNodeToolbarUi';
import type { ToolMenuItem } from './imageToolMenus';
import { spawnUploadCaptures } from './spawnUploadCaptures';
import { SimpleVideoClipEditor } from './SimpleVideoClipEditor';
import { createLogger } from '../../../lib/logger';

const log = createLogger('VideoNodeToolbar');

type Props = {
  nodeId: string;
  selected?: boolean;
  cardRef: React.RefObject<HTMLDivElement | null>;
  videoUrl?: string;
  hasVideo: boolean;
};

type OpenMenu = 'audio' | 'repair' | null;

const AUDIO_MENU: ToolMenuItem[] = [
  { id: 'audio-split', label: '音频分离', desc: '待实现 · 导出画面与完整音轨' },
  { id: 'voice-split', label: '人声分离', desc: '待实现 · 单独提取人声轨' },
  { id: 'ambient-split', label: '环境音分离', desc: '待实现 · 提取背景/环境声' },
];

const REPAIR_MENU: ToolMenuItem[] = [
  { id: 'de-watermark', label: '去水印', desc: '待实现 · 擦除画面水印' },
  { id: 'de-subtitle', label: '去字幕', desc: '待实现 · 擦除硬字幕' },
  { id: 'de-blur', label: '去模糊', desc: '待实现 · 增强清晰度' },
];

/** 灰色「待实现」按钮：可点/可悬停，不真正执行 */
function PendingBtn({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [tip, setTip] = useState(false);
  const show = () => {
    setTip(true);
    window.setTimeout(() => setTip(false), 1600);
  };
  return (
    <div className="relative">
      <button
        type="button"
        title={`${title} · 待实现`}
        onClick={show}
        onMouseEnter={show}
        className="flex items-center gap-1 h-8 px-2 rounded-full text-[11px] text-foreground opacity-35 hover:opacity-50 transition-opacity whitespace-nowrap cursor-not-allowed"
      >
        {children}
      </button>
      {tip ? (
        <span className="absolute left-1/2 -translate-x-1/2 top-full mt-1 z-50 whitespace-nowrap rounded-md border border-border bg-card px-2 py-0.5 text-[10px] text-muted-foreground shadow-sm">
          待实现
        </span>
      ) : null}
    </div>
  );
}

export function VideoNodeToolbar({ nodeId, selected, cardRef, videoUrl, hasVideo }: Props) {
  const rf = useFlow();
  const [open, setOpen] = useState<OpenMenu>(null);
  const [clipOpen, setClipOpen] = useState(false);
  const [pendingTip, setPendingTip] = useState('');
  const closeAll = useCallback(() => setOpen(null), []);

  const showPending = useCallback((label: string) => {
    setPendingTip(label);
    window.setTimeout(() => setPendingTip(''), 1600);
    log.info('showPending', label, { nodeId });
  }, [nodeId]);

  const getVideoEl = useCallback(
    () => cardRef.current?.querySelector('video') as HTMLVideoElement | null,
    [cardRef],
  );

  const onDownload = useCallback(() => {
    if (!videoUrl) return;
    const a = document.createElement('a');
    a.href = videoUrl;
    a.download = `video-${nodeId}.mp4`;
    a.target = '_blank';
    a.rel = 'noopener';
    a.click();
    log.info('onDownload', 'ok', { nodeId });
  }, [videoUrl, nodeId]);

  const onFullscreen = useCallback(() => {
    const v = getVideoEl();
    if (!v) return;
    if (v.requestFullscreen) void v.requestFullscreen().catch(() => {});
    log.info('onFullscreen', 'request', { nodeId });
  }, [getVideoEl, nodeId]);

  /** 尾帧截取 → 上传节点输出 */
  const onCaptureTailFrame = useCallback(() => {
    const v = getVideoEl();
    if (!v || !v.videoWidth) {
      log.warn('onCaptureTailFrame', 'no video el', { nodeId });
      return;
    }

    const capture = () => {
      const canvas = document.createElement('canvas');
      canvas.width = v.videoWidth;
      canvas.height = v.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/png');
      const fileName = `tail-frame-${nodeId}.png`;
      const nodes = rf.getNodes();
      const edges = rf.getEdges();
      const result = spawnUploadCaptures({
        sourceId: nodeId,
        captures: [{ dataUrl, fileName }],
        nodes,
        edges,
        thumbField: 'tailFrameUrl',
      });
      if (!result) {
        log.warn('onCaptureTailFrame', 'spawn fail', { nodeId });
        return;
      }
      rf.setNodes(() => result.nodes);
      rf.setEdges(() => result.edges);
      log.info('onCaptureTailFrame', 'ok', {
        nodeId,
        spawned: result.spawned,
        t: v.currentTime,
      });
    };

    const dur = v.duration;
    if (!Number.isFinite(dur) || dur <= 0) {
      // 无法 seek 时截当前帧
      capture();
      return;
    }

    const target = Math.max(0, dur - 0.05);
    const onSeeked = () => {
      v.removeEventListener('seeked', onSeeked);
      capture();
    };
    v.addEventListener('seeked', onSeeked);
    try {
      v.currentTime = target;
    } catch {
      v.removeEventListener('seeked', onSeeked);
      capture();
    }
  }, [getVideoEl, nodeId, rf]);

  const onMenuPick = useCallback(
    (menu: OpenMenu, item: ToolMenuItem) => {
      log.info('onMenuPick', 'pending', { nodeId, menu, item: item.id });
      closeAll();
      showPending(item.label);
    },
    [nodeId, closeAll, showPending],
  );

  const onClipExport = useCallback(
    async (blob: Blob, fileName: string) => {
      const dataUrl = await blobToDataUrl(blob);
      const nodes = rf.getNodes();
      const edges = rf.getEdges();
      const result = spawnUploadCaptures({
        sourceId: nodeId,
        captures: [{ dataUrl, fileName }],
        nodes,
        edges,
        thumbField: 'clipExportUrl',
      });
      if (!result) {
        log.warn('onClipExport', 'spawn fail', { nodeId });
        return;
      }
      rf.setNodes(() => result.nodes);
      rf.setEdges(() => result.edges);
      log.info('onClipExport', 'spawn upload', { nodeId, fileName, bytes: blob.size });
    },
    [nodeId, rf],
  );

  return (
    <>
      <NodeTopBar cardRef={cardRef} selected={selected} barW={680}>
        <div className="relative inline-flex items-center gap-0.5 rounded-full border border-border/60 bg-card/95 backdrop-blur px-1 py-1 shadow-sm">
          <PendingBtn title="高清">
            <Sparkles className="size-3.5" /> 高清
          </PendingBtn>

          <TbBtn
            title="简单剪辑（裁剪 / 旋转）"
            disabled={!hasVideo}
            onClick={() => setClipOpen(true)}
          >
            <Scissors className="size-3.5" /> 剪辑
          </TbBtn>

          <TbBtn
            title="尾帧截取 → 上传节点"
            onClick={onCaptureTailFrame}
            disabled={!hasVideo}
          >
            <Camera className="size-3.5" /> 尾帧截取
          </TbBtn>

          <Div />

          <MenuWrap
            open={open === 'audio'}
            onToggle={() => setOpen((o) => (o === 'audio' ? null : 'audio'))}
            onClose={closeAll}
            label="音频分离"
            icon={<Volume2 className="size-3.5" />}
            caret
            disabled={!hasVideo}
          >
            <SimpleMenu items={AUDIO_MENU} onPick={(i) => onMenuPick('audio', i)} />
          </MenuWrap>

          <MenuWrap
            open={open === 'repair'}
            onToggle={() => setOpen((o) => (o === 'repair' ? null : 'repair'))}
            onClose={closeAll}
            label="视频修复"
            icon={<Wand2 className="size-3.5" />}
            caret
            disabled={!hasVideo}
          >
            <SimpleMenu items={REPAIR_MENU} onPick={(i) => onMenuPick('repair', i)} />
          </MenuWrap>

          <Div />

          <IconBtn title="下载视频" onClick={onDownload} disabled={!hasVideo}>
            <Download className="size-4" />
          </IconBtn>
          <IconBtn title="全屏播放" onClick={onFullscreen} disabled={!hasVideo}>
            <Maximize2 className="size-4" />
          </IconBtn>

          <Div />

          <PendingBtn title="加入 Agent">
            <Bot className="size-3.5" /> 加入 Agent
          </PendingBtn>

          {pendingTip ? (
            <span className="absolute left-1/2 -translate-x-1/2 top-full mt-1 z-50 whitespace-nowrap rounded-md border border-border bg-card px-2 py-0.5 text-[10px] text-muted-foreground shadow-sm">
              {pendingTip} · 待实现
            </span>
          ) : null}
        </div>
      </NodeTopBar>

      {clipOpen && videoUrl ? (
        <SimpleVideoClipEditor
          videoUrl={videoUrl}
          onClose={() => setClipOpen(false)}
          onExport={onClipExport}
        />
      ) : null}
    </>
  );
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ''));
    r.onerror = () => reject(r.error || new Error('read fail'));
    r.readAsDataURL(blob);
  });
}
