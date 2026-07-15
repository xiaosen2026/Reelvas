'use client';

// 剪辑编辑器 —— 保留原版布局框架；媒体/时间轴改为画布真实数据（去掉 mockFiles / simulateClips）

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  X, Play, Square, Scissors, Image, Type,
  Trash2, Link2, Plus, Download, Music, Sliders,
  Crop, Copy, Volume2, Repeat, Minus, Film,
  SkipBack, SkipForward, GripHorizontal, SlidersHorizontal,
} from 'lucide-react';
import type { WorkflowHandle } from './CanvasFlowCore';
import { createLogger } from '@/lib/logger';
import {
  collectCanvasMedia,
  colorForIndex,
  probeDuration,
} from './clip/collectCanvasMedia';
import type { ClipMediaItem, TimelineClip } from './clip/clipTypes';
import { DEFAULT_FPS } from './clip/clipTypes';
import { downloadPremiereXml } from './clip/exportPremiereXml';

const log = createLogger('ClipEditor');

interface ClipEditorProps {
  onClose: () => void;
  /** 从画布读真实节点媒体；不传则素材列表为空 */
  workflowRef?: React.MutableRefObject<WorkflowHandle | null>;
}

type TabKey = '媒体' | '音效' | '文本' | '设置';
const topTabs: { key: TabKey; icon: typeof Image }[] = [
  { key: '媒体', icon: Image },
  { key: '音效', icon: Music },
  { key: '文本', icon: Type },
  { key: '设置', icon: Sliders },
];
const mediaFilters = ['全部', '图片', '视频', '音频'] as const;
type MediaFilter = (typeof mediaFilters)[number];
const sidebarItems = ['导入', '画布素材', '历史记录', '我的资产'];

const FPS = DEFAULT_FPS;

/** 深色细滚动条（Firefox + WebKit），不改布局只美化 */
const clipScroll =
  '[scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.18)_transparent] ' +
  '[&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar]:w-1.5 ' +
  '[&::-webkit-scrollbar-track]:bg-transparent ' +
  '[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/15 ' +
  'hover:[&::-webkit-scrollbar-thumb]:bg-white/30 ' +
  '[&::-webkit-scrollbar-corner]:bg-transparent';

function useDragResize(initial: number, min: number, max: number, reverse = false) {
  const [size, setSize] = useState(initial);
  const startRef = useRef({ startX: 0, startSize: 0 });
  const dragging = useRef(false);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    startRef.current = { startX: e.clientX, startSize: size };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const dx = (ev.clientX - startRef.current.startX) * (reverse ? -1 : 1);
      setSize(Math.max(min, Math.min(max, startRef.current.startSize + dx)));
    };
    const onUp = () => {
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [size, min, max, reverse]);

  return { size, setSize, onMouseDown };
}

function useDragVertical(initial: number, min: number, max: number) {
  const [size, setSize] = useState(initial);
  const startRef = useRef({ startY: 0, startSize: 0 });
  const dragging = useRef(false);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    startRef.current = { startY: e.clientY, startSize: size };
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const dy = startRef.current.startY - ev.clientY;
      setSize(Math.max(min, Math.min(max, startRef.current.startSize + dy)));
    };
    const onUp = () => {
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [size, min, max]);

  return { size, setSize, onMouseDown };
}

let clipIdSeq = 1;

export function ClipEditor({ onClose, workflowRef }: ClipEditorProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('媒体');
  const [activeFilter, setActiveFilter] = useState<MediaFilter>('全部');
  const [activeSide, setActiveSide] = useState('画布素材');
  const [playing, setPlaying] = useState(false);
  const [currentSec, setCurrentSec] = useState(0);
  const [timelineZoom, setTimelineZoom] = useState(0.85);
  const [muted, setMuted] = useState(false);
  const [looping, setLooping] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [msg, setMsg] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [showTransform, setShowTransform] = useState(true);
  const [showBlend, setShowBlend] = useState(true);
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [showAspectMenu, setShowAspectMenu] = useState(false);
  const aspectMenuRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(100);
  const [posX, setPosX] = useState(0);
  const [posY, setPosY] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [opacity, setOpacity] = useState(100);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const animRef = useRef<number>(0);

  // —— 真实画布媒体 + 时间轴（替换 mock）——
  const [mediaItems, setMediaItems] = useState<ClipMediaItem[]>([]);
  const [clips, setClips] = useState<TimelineClip[]>([]);

  const leftPanel = useDragResize(256, 180, 500);
  const rightPanel = useDragResize(224, 120, 400, true);
  const timelineH = useDragVertical(200, 100, 500);

  const refreshFromCanvas = useCallback(async () => {
    const nodes = workflowRef?.current?.getNodes() ?? [];
    const raw = collectCanvasMedia(nodes);
    const withDur = await Promise.all(
      raw.map(async (m) => {
        if (m.durationSec > 0) return m;
        const d = await probeDuration(m.url, m.kind);
        return { ...m, durationSec: d };
      }),
    );
    setMediaItems(withDur);
    log.info('refreshFromCanvas', 'ok', { n: withDur.length });
  }, [workflowRef]);

  useEffect(() => {
    void refreshFromCanvas();
  }, [refreshFromCanvas]);

  // 时间轴总长 = 所有片段终点；空轨给 30s 可滚动工作区（不是成片只有 5 秒）
  // 有片段时再加 2s 尾余量，方便往后拖
  const totalSec = useMemo(() => {
    if (!clips.length) return 30;
    const end = Math.max(...clips.map((c) => c.startSec + c.durationSec));
    return Math.max(end + 2, 10);
  }, [clips]);

  const totalFrames = Math.max(1, Math.ceil(totalSec * FPS));
  const currentFrame = Math.min(totalFrames, Math.round(currentSec * FPS));

  const filteredMedia = useMemo(() => {
    if (activeFilter === '全部') return mediaItems;
    if (activeFilter === '图片') return mediaItems.filter((m) => m.kind === 'image');
    if (activeFilter === '视频') return mediaItems.filter((m) => m.kind === 'video');
    return mediaItems.filter((m) => m.kind === 'audio');
  }, [mediaItems, activeFilter]);

  const addMediaToTimeline = useCallback((item: ClipMediaItem) => {
    setClips((prev) => {
      const end = prev.reduce((m, c) => Math.max(m, c.startSec + c.durationSec), 0);
      const clip: TimelineClip = {
        id: `clip-${clipIdSeq++}`,
        mediaId: item.id,
        kind: item.kind,
        name: item.name,
        url: item.url,
        startSec: end,
        durationSec: Math.max(0.2, item.durationSec || 3),
        trimInSec: 0,
        color: colorForIndex(prev.length),
      };
      return [...prev, clip];
    });
  }, []);

  /* 播放（按秒） */
  useEffect(() => {
    if (!playing) return;
    let lastT = performance.now();
    const tick = (t: number) => {
      const dt = (t - lastT) / 1000;
      lastT = t;
      setCurrentSec((prev) => {
        const next = prev + dt;
        if (next >= totalSec) {
          if (looping) return 0;
          setPlaying(false);
          return totalSec;
        }
        return next;
      });
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [playing, totalSec, looping]);

  useEffect(() => {
    if (!playing) cancelAnimationFrame(animRef.current);
  }, [playing]);

  const aspectCss = (() => {
    switch (aspectRatio) {
      case '适应': return undefined;
      case '16:9': return '16/9';
      case '4:3': return '4/3';
      case '2.35:1': return '2.35/1';
      case '2:1': return '2/1';
      case '1.85:1': return '1.85/1';
      case '9:16': return '9/16';
      case '3:4': return '3/4';
      case '5.8寸': return '9/19.5';
      case '1:1': return '1/1';
      default: return '16/9';
    }
  })();

  useEffect(() => {
    if (canvasWrapRef.current) canvasWrapRef.current.style.aspectRatio = aspectCss || '';
  }, [aspectCss]);

  useEffect(() => {
    if (!showAspectMenu) return;
    const onDown = (e: MouseEvent) => {
      if (aspectMenuRef.current && !aspectMenuRef.current.contains(e.target as Node)) {
        setShowAspectMenu(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [showAspectMenu]);

  const activeClip = useMemo(
    () =>
      clips.find(
        (cl) => currentSec >= cl.startSec && currentSec < cl.startSec + cl.durationSec,
      ) || null,
    [clips, currentSec],
  );

  /* 预览：有真实视频则用 video；否则 canvas 占位 */
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !activeClip || activeClip.kind !== 'video') return;
    const local = activeClip.trimInSec + (currentSec - activeClip.startSec);
    if (Math.abs(v.currentTime - local) > 0.3) {
      try {
        v.currentTime = Math.max(0, local);
      } catch {
        /* ignore */
      }
    }
    v.muted = muted;
    if (playing) void v.play().catch(() => {});
    else v.pause();
  }, [activeClip, currentSec, playing, muted]);

  /* Canvas 占位绘制（无视频/图片时） */
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    if (activeClip?.kind === 'video' || activeClip?.kind === 'image') return;
    const w = (c.width = c.clientWidth * devicePixelRatio);
    const h = (c.height = c.clientHeight * devicePixelRatio);
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(devicePixelRatio, devicePixelRatio);
    const cw = c.clientWidth;
    const ch = c.clientHeight;
    ctx.clearRect(0, 0, cw, ch);
    ctx.fillStyle = '#1a1a1e';
    ctx.fillRect(0, 0, cw, ch);
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let y = 0; y < ch; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(cw, y);
      ctx.stroke();
    }
    for (let x = 0; x < cw; x += 20) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, ch);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      clips.length ? (activeClip?.name || '音频/空片段') : '从左侧添加画布素材到时间轴',
      cw / 2,
      ch / 2,
    );
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`frame ${currentFrame} / ${totalFrames}`, cw - 8, ch - 8);
  }, [currentFrame, totalFrames, activeClip, clips.length, aspectRatio]);

  const PX_PER_SEC = 40 * timelineZoom;
  const trackWidth = Math.max(400, totalSec * PX_PER_SEC + 80);
  const playheadLeft = currentSec * PX_PER_SEC;

  const handleRulerClick = useCallback(
    (e: React.MouseEvent) => {
      const el = e.currentTarget as HTMLElement;
      const rect = el.getBoundingClientRect();
      const scrollParent = el.parentElement;
      const x = e.clientX - rect.left + (scrollParent?.scrollLeft || 0);
      setCurrentSec(Math.max(0, Math.min(totalSec, x / PX_PER_SEC)));
    },
    [totalSec, PX_PER_SEC],
  );

  const handlePlayheadDrag = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      // 拖动时禁止页面选中文字（否则会拖出蓝色选区）
      const prevUserSelect = document.body.style.userSelect;
      document.body.style.userSelect = 'none';
      window.getSelection()?.removeAllRanges();
      const startX = e.clientX;
      const startPos = currentSec;
      const onMove = (ev: MouseEvent) => {
        ev.preventDefault();
        const dx = ev.clientX - startX;
        setCurrentSec(Math.max(0, Math.min(totalSec, startPos + dx / PX_PER_SEC)));
      };
      const onUp = () => {
        document.body.style.userSelect = prevUserSelect;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [currentSec, totalSec, PX_PER_SEC],
  );

  const timeStr = (sec: number) => {
    const fr = Math.round(sec * FPS);
    const f = fr % FPS;
    const s = Math.floor(fr / FPS) % 60;
    const m = Math.floor(fr / (FPS * 60));
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(f).padStart(2, '0')}`;
  };

  const onExportPremiere = useCallback(() => {
    if (!clips.length) {
      setMsg('时间轴为空，请先添加素材');
      log.warn('onExportPremiere', 'empty');
      return;
    }
    setExporting(true);
    try {
      downloadPremiereXml(clips, 'Reelvas Timeline');
      const hasEmbedded = clips.some(
        (c) => c.url.startsWith('data:') || c.url.startsWith('blob:'),
      );
      setMsg(
        hasEmbedded
          ? '已导出 Premiere XML。素材为本地 data/blob 时，请在 PR 中重新链接媒体文件。'
          : '已导出 Premiere 可导入的 XML（文件 → 导入）',
      );
      log.info('onExportPremiere', 'ok', { n: clips.length });
    } finally {
      setExporting(false);
      setShowExportMenu(false);
    }
  }, [clips]);

  const onExportJson = useCallback(() => {
    if (!clips.length) {
      setMsg('时间轴为空，请先添加素材');
      return;
    }
    const project = {
      version: 1,
      totalSec,
      clips: clips.map((c) => ({
        name: c.name,
        kind: c.kind,
        startSec: c.startSec,
        durationSec: c.durationSec,
        trimInSec: c.trimInSec,
        url: c.url.startsWith('data:') ? `[dataURL ${c.url.length}]` : c.url,
      })),
    };
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reelvas-timeline-${Date.now()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    setShowExportMenu(false);
    setMsg('已导出工程 JSON');
  }, [clips, totalSec]);

  const onExportSingleVideo = useCallback(() => {
    const v = clips.find((c) => c.kind === 'video');
    if (!v) {
      setMsg('时间轴无视频片段');
      return;
    }
    const a = document.createElement('a');
    a.href = v.url;
    a.download = `clip-export-${Date.now()}.mp4`;
    a.target = '_blank';
    a.rel = 'noopener';
    a.click();
    setShowExportMenu(false);
  }, [clips]);

  useEffect(() => {
    if (!showExportMenu) return;
    const onDown = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [showExportMenu]);

  const removeSelected = () => {
    if (!selectedClipId) return;
    setClips((prev) => prev.filter((c) => c.id !== selectedClipId));
    setSelectedClipId(null);
  };

  // 标尺：按缩放自适应刻度间隔，避免 00:00/01/02… 挤成一团
  const majorTicks = useMemo(() => {
    const ticks: { left: number; label: string; major: boolean }[] = [];
    // 目标：标签间距大约 ≥ 56px
    const minLabelPx = 56;
    const stepCandidates = [1, 2, 5, 10, 15, 30, 60, 120, 300];
    const stepSec =
      stepCandidates.find((s) => s * PX_PER_SEC >= minLabelPx) ??
      Math.max(1, Math.ceil(minLabelPx / Math.max(PX_PER_SEC, 1)));
    const end = Math.ceil(totalSec);
    for (let s = 0; s <= end; s += stepSec) {
      const m = Math.floor(s / 60);
      const sec = s % 60;
      ticks.push({
        left: s * PX_PER_SEC,
        label: `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`,
        major: true,
      });
    }
    // 次刻度（无字）
    const minorStep = stepSec >= 5 ? 1 : stepSec;
    if (minorStep < stepSec) {
      for (let s = 0; s <= end; s += minorStep) {
        if (s % stepSec === 0) continue;
        ticks.push({ left: s * PX_PER_SEC, label: '', major: false });
      }
    }
    return ticks;
  }, [totalSec, PX_PER_SEC]);

  return (
    <div
      className="fixed inset-0 z-[200] bg-[#0a0a0a] flex flex-col overflow-hidden select-none"
      onDragStart={(e) => e.preventDefault()}
    >
      {/* 顶栏 —— 原版 */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-white/[0.06] shrink-0">
        <button onClick={onClose} className="w-7 h-7 rounded-md flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.08] transition-colors">
          <X className="w-4 h-4" />
        </button>
        <span className="text-sm font-medium text-white/80">剪辑编辑器</span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => void refreshFromCanvas()}
          className="h-8 px-3 rounded-md border border-white/10 text-xs text-white/50 hover:bg-white/5 mr-1"
        >
          刷新素材
        </button>

        {/* 导出下拉 */}
        <div className="relative" ref={exportMenuRef}>
          <button
            type="button"
            onClick={() => setShowExportMenu((v) => !v)}
            className="h-8 px-4 rounded-md bg-emerald-600 hover:bg-emerald-500 text-sm text-white font-medium transition-colors flex items-center gap-1.5"
          >
            {exporting ? '导出中…' : '导出'}
            <svg className={`w-3 h-3 transition-transform ${showExportMenu ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
          </button>
          {showExportMenu && (
            <div className="absolute top-full right-0 mt-1.5 w-52 rounded-lg border border-white/[0.08] bg-[#17171b] shadow-lg overflow-hidden z-30 py-1">
              <button type="button" onClick={onExportPremiere} disabled={exporting || !clips.length} className="w-full px-3.5 py-2 text-left text-xs text-white/80 hover:bg-white/[0.06] disabled:opacity-30 flex items-center gap-2">
                <span className="text-white/40 text-[10px] font-mono w-8">XML</span>
                导出 Premiere 可导入 XML
                <span className="ml-auto text-[9px] text-white/20">FCP7</span>
              </button>
              <button type="button" onClick={onExportJson} disabled={!clips.length} className="w-full px-3.5 py-2 text-left text-xs text-white/80 hover:bg-white/[0.06] disabled:opacity-30 flex items-center gap-2">
                <span className="text-white/40 text-[10px] font-mono w-8">JSON</span>
                导出工程 JSON
              </button>
              <div className="mx-3 my-1 h-px bg-white/[0.06]" />
              <button type="button" onClick={onExportSingleVideo} disabled={!clips.length} className="w-full px-3.5 py-2 text-left text-xs text-white/80 hover:bg-white/[0.06] disabled:opacity-30 flex items-center gap-2">
                <span className="text-white/40 text-[10px] w-8">MP4</span>
                仅下载首段视频源文件
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 主区域 —— 原版三栏 */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* 左侧面板 */}
        <div className="flex flex-col shrink-0 border-r border-white/[0.06] overflow-hidden" style={{ width: leftPanel.size }}>
          <div className="px-2 py-1.5 shrink-0">
            <div className="grid w-full rounded-md bg-white/[0.04] p-1" style={{ gridTemplateColumns: 'repeat(4, minmax(0px, 1fr))' }}>
              {topTabs.map(({ key, icon: Icon }) => (
                <button key={key} onClick={() => setActiveTab(key)} className={`flex items-center justify-center gap-1 py-2 h-8 rounded-sm px-1 text-[11px] font-medium transition-colors ${activeTab === key ? 'bg-black/80 text-white shadow-sm' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}>
                  <Icon className="w-3.5 h-3.5" /><span className="truncate leading-tight">{key}</span>
                </button>
              ))}
            </div>
          </div>

          {activeTab === '媒体' && (
            <div className="flex-1 flex min-h-0">
              {/* 左侧子导航 */}
              <div className="w-[76px] border-r border-white/[0.06] flex flex-col py-2 px-1.5 gap-0.5 shrink-0 bg-white/[0.015]">
                {sidebarItems.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setActiveSide(s)}
                    className={`text-[11px] px-2 py-2 rounded-md text-left transition-colors leading-tight ${
                      activeSide === s
                        ? 'text-white bg-white/[0.1] font-medium'
                        : 'text-white/35 hover:text-white/65 hover:bg-white/[0.04]'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>

              <div className="flex-1 flex flex-col min-w-0">
                {/* 类型筛选 chips */}
                <div className="flex items-center gap-1 px-2.5 py-2 shrink-0 border-b border-white/[0.04]">
                  {mediaFilters.map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setActiveFilter(f)}
                      className={`rounded-full px-2.5 py-1 text-[11px] transition-colors ${
                        activeFilter === f
                          ? 'bg-white text-black font-medium'
                          : 'text-white/40 hover:text-white/70 hover:bg-white/[0.06]'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>

                <div className={`flex-1 overflow-auto px-2.5 py-2 ${clipScroll}`}>
                  {activeSide !== '画布素材' && activeSide !== '导入' ? (
                    <div className="flex flex-col items-center justify-center min-h-[200px] px-3 text-center">
                      <div className="mb-3 flex size-11 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-white/25">
                        <Image className="size-5" strokeWidth={1.5} />
                      </div>
                      <p className="text-[12px] text-white/45 font-medium">「{activeSide}」暂未接入</p>
                      <p className="mt-1.5 text-[11px] text-white/25 leading-relaxed">
                        请切换左侧「画布素材」使用当前工作流中的媒体
                      </p>
                    </div>
                  ) : filteredMedia.length === 0 ? (
                    <div className="flex flex-col items-center justify-center min-h-[220px] px-4 text-center">
                      <div className="mb-3 flex size-12 items-center justify-center rounded-2xl border border-dashed border-white/12 bg-white/[0.02] text-white/20">
                        {activeFilter === '视频' ? (
                          <Film className="size-6" strokeWidth={1.25} />
                        ) : activeFilter === '音频' ? (
                          <Music className="size-6" strokeWidth={1.25} />
                        ) : (
                          <Image className="size-6" strokeWidth={1.25} />
                        )}
                      </div>
                      <p className="text-[12px] text-white/50 font-medium">
                        {activeFilter === '全部'
                          ? '画布暂无可用媒体'
                          : `暂无${activeFilter}素材`}
                      </p>
                      <p className="mt-1.5 text-[11px] text-white/25 leading-relaxed max-w-[11rem]">
                        请先在画布上传或生成视频 / 图片 / 音频，再点顶部「刷新素材」
                      </p>
                      <button
                        type="button"
                        onClick={() => void refreshFromCanvas()}
                        className="mt-4 h-7 rounded-md border border-white/10 px-3 text-[11px] text-white/55 hover:bg-white/[0.06] hover:text-white/80 transition-colors"
                      >
                        刷新素材
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-2 pb-2">
                        {filteredMedia.map((item) => (
                          <div key={item.id} className="group relative w-full">
                            <div className="relative flex flex-col gap-1">
                              <div className="relative w-full overflow-hidden rounded-lg border border-white/[0.06] bg-white/[0.03] group-hover:border-white/15 transition-colors" style={{ paddingBottom: '56.25%' }}>
                                {item.kind === 'image' ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={item.url} alt="" className="absolute inset-0 size-full object-cover" />
                                ) : item.kind === 'video' ? (
                                  <video src={item.url} muted playsInline preload="metadata" className="absolute inset-0 size-full object-cover" />
                                ) : (
                                  <div className="absolute inset-0 flex items-center justify-center text-white/20">
                                    <Music className="w-6 h-6" />
                                  </div>
                                )}
                                <div className="absolute left-1 top-1 rounded bg-black/55 px-1 py-0.5 text-[9px] text-white/70 leading-none">
                                  {item.kind === 'video' ? '视频' : item.kind === 'audio' ? '音频' : '图片'}
                                  {item.durationSec > 0 ? ` · ${item.durationSec.toFixed(1)}s` : ''}
                                </div>
                                <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <button
                                    type="button"
                                    title="添加到时间轴"
                                    onClick={() => addMediaToTimeline(item)}
                                    className="w-8 h-8 rounded-full bg-emerald-600/95 flex items-center justify-center text-white hover:bg-emerald-500 shadow-sm transition-colors"
                                  >
                                    <Plus className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                              <span className="text-white/45 text-[10px] truncate px-0.5" title={item.name}>
                                {item.name}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="py-2 text-center text-[10px] text-white/20">
                        共 {filteredMedia.length} 项
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
          {activeTab === '音效' && (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex gap-1 px-2 py-1.5 shrink-0">
                <button type="button" className="rounded px-2.5 py-0.5 text-[11px] bg-white/15 text-white">画布音频</button>
              </div>
              {mediaItems.filter((m) => m.kind === 'audio').length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-white/15">
                  <Music className="w-10 h-10 mb-3 opacity-20" strokeWidth={1} />
                  <p className="text-sm">画布中暂无音频</p>
                </div>
              ) : (
                <div className={`flex-1 overflow-auto px-2 grid grid-cols-2 gap-1.5 content-start ${clipScroll}`}>
                  {mediaItems.filter((m) => m.kind === 'audio').map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => addMediaToTimeline(item)}
                      className="rounded border border-white/[0.06] p-2 text-left text-[11px] text-white/50 hover:bg-white/5"
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {activeTab === '文本' && (
            <div className={`flex-1 flex flex-col min-h-0 p-3 gap-2 overflow-auto ${clipScroll}`}>
              <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-4 text-center text-white/40 text-sm">Default text</div>
              <p className="text-white/20 text-[11px] text-center">默认文本</p>
            </div>
          )}
          {activeTab === '设置' && (
            <div className={`flex-1 flex flex-col min-h-0 p-3 gap-4 overflow-auto text-white/60 text-xs ${clipScroll}`}>
              <div>
                <label className="block mb-1.5 text-white/40">宽高比</label>
                <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} className="w-full h-8 rounded bg-white/[0.06] border border-white/[0.08] px-2 text-white/80 text-xs focus:outline-none">
                  <option>16:9</option><option>9:16</option><option>1:1</option><option>原始</option>
                </select>
              </div>
              <div>
                <label className="block mb-1.5 text-white/40">帧率</label>
                <select className="w-full h-8 rounded bg-white/[0.06] border border-white/[0.08] px-2 text-white/80 text-xs focus:outline-none">
                  <option>30 fps</option><option>60 fps</option><option>24 fps</option>
                </select>
              </div>
              <div>
                <label className="block mb-1.5 text-white/40">背景</label>
                <div className="flex items-center gap-2">
                  <input type="color" defaultValue="#000000" className="w-8 h-8 rounded border border-white/[0.08] bg-transparent cursor-pointer" />
                  <input type="text" defaultValue="#000000" className="flex-1 h-8 rounded bg-white/[0.06] border border-white/[0.08] px-2 text-white/80 text-xs font-mono focus:outline-none" />
                </div>
              </div>
              <p className="text-white/25 text-[11px]">画布媒体 {mediaItems.length} · 时间轴片段 {clips.length}</p>
            </div>
          )}
        </div>

        <div className="relative w-1 shrink-0 cursor-col-resize hover:bg-white/20 active:bg-white/30 transition-colors group z-10" onMouseDown={leftPanel.onMouseDown}>
          <div className="absolute inset-y-0 left-1/2 w-3 -translate-x-1/2" />
        </div>

        {/* 中间播放器 —— 原版结构 */}
        <div className="flex-1 flex min-w-0 overflow-hidden">
          <div className="flex-1 flex flex-col items-center justify-center bg-white/[0.02] relative overflow-hidden">
            <div ref={canvasWrapRef} className="w-3/4 max-w-lg rounded border border-white/[0.06] bg-[#1a1a1e] overflow-hidden relative">
              {activeClip?.kind === 'video' ? (
                <video
                  ref={videoRef}
                  key={activeClip.id}
                  src={activeClip.url}
                  className="size-full object-contain bg-black"
                  playsInline
                  style={{
                    transform: `scale(${scale / 100}) translate(${posX}px, ${posY}px) rotate(${rotation}deg)`,
                    opacity: opacity / 100,
                  }}
                />
              ) : activeClip?.kind === 'image' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={activeClip.url}
                  alt=""
                  className="size-full object-contain bg-black"
                  style={{
                    transform: `scale(${scale / 100}) translate(${posX}px, ${posY}px) rotate(${rotation}deg)`,
                    opacity: opacity / 100,
                  }}
                />
              ) : (
                <canvas ref={canvasRef} className="size-full" />
              )}
            </div>
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3">
              <button type="button" onClick={() => setCurrentSec((s) => Math.max(0, s - 1 / FPS))} className="text-white/20 hover:text-white/60 transition-colors"><SkipBack className="w-3.5 h-3.5" /></button>
              <button type="button" onClick={() => setPlaying(!playing)} className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
                {playing ? <Square className="w-3.5 h-3.5 text-white fill-white" /> : <Play className="w-3.5 h-3.5 text-white ml-0.5 fill-white" />}
              </button>
              <button type="button" onClick={() => setCurrentSec((s) => Math.min(totalSec, s + 1 / FPS))} className="text-white/20 hover:text-white/60 transition-colors"><SkipForward className="w-3.5 h-3.5" /></button>
              <span className="text-xs text-emerald-400/80 tabular-nums ml-2 whitespace-nowrap">{timeStr(currentSec)} / {timeStr(totalSec)}</span>
              <div className="relative" ref={aspectMenuRef}>
                <button type="button" onClick={() => setShowAspectMenu((v) => !v)} className="text-[10px] text-white/30 hover:text-white/60 border border-white/10 rounded px-1.5 py-0.5 transition-colors whitespace-nowrap">{aspectRatio}</button>
                {showAspectMenu && <AspectMenu current={aspectRatio} onSelect={(r) => { setAspectRatio(r); setShowAspectMenu(false); }} />}
              </div>
            </div>
          </div>

          <div className="relative w-1 shrink-0 cursor-col-resize hover:bg-white/20 active:bg-white/30 transition-colors group z-10" onMouseDown={rightPanel.onMouseDown}>
            <div className="absolute inset-y-0 left-1/2 w-3 -translate-x-1/2" />
          </div>

          {/* 右侧属性 —— 原版 */}
          <div className={`flex flex-col overflow-y-auto overflow-x-hidden shrink-0 border-l border-white/[0.06] ${clipScroll}`} style={{ width: rightPanel.size }}>
            <div className="px-3 py-2.5 border-b border-white/[0.06] shrink-0">
              <span className="text-xs font-medium text-white/70">
                {selectedClipId
                  ? clips.find((c) => c.id === selectedClipId)?.name ?? '元素属性'
                  : '属性'}
              </span>
            </div>
            {selectedClipId === null ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 p-4">
                <SlidersHorizontal className="text-white/15 size-10" strokeWidth={1} />
                <div className="flex flex-col gap-2 text-center">
                  <p className="text-sm font-medium text-white/40">草稿参数</p>
                  <p className="text-white/15 text-xs">点击时间轴上的元素来编辑其属性</p>
                </div>
              </div>
            ) : (
              <>
                <div className="px-3 py-3 border-b border-white/[0.04]">
                  <button type="button" onClick={() => setShowTransform(!showTransform)} className="flex items-center justify-between w-full">
                    <span className="text-xs font-medium text-white/60">变换</span>
                    <svg className={`w-3 h-3 text-white/20 transition-transform ${showTransform ? '' : '-rotate-90'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
                  </button>
                  {showTransform && (
                    <div className="space-y-3 mt-3">
                      <div>
                        <label className="block text-[11px] text-white/30 mb-1">缩放</label>
                        <div className="flex items-center gap-2">
                          <input type="range" min={0} max={200} value={scale} onChange={(e) => setScale(Number(e.target.value))} className="flex-1 h-1 rounded-full bg-white/10 appearance-none cursor-pointer" />
                          <input type="number" value={scale} onChange={(e) => setScale(Number(e.target.value))} className="w-12 h-7 rounded bg-white/[0.06] border border-white/[0.08] px-1.5 text-xs text-white/80 text-right focus:outline-none" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] text-white/30 mb-1">位置</label>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 flex items-center gap-1"><span className="text-[10px] text-white/20 w-3">X</span><input type="number" value={posX} onChange={(e) => setPosX(Number(e.target.value))} className="flex-1 h-7 rounded bg-white/[0.06] border border-white/[0.08] px-1.5 text-xs text-white/80 focus:outline-none" /></div>
                          <div className="flex-1 flex items-center gap-1"><span className="text-[10px] text-white/20 w-3">Y</span><input type="number" value={posY} onChange={(e) => setPosY(Number(e.target.value))} className="flex-1 h-7 rounded bg-white/[0.06] border border-white/[0.08] px-1.5 text-xs text-white/80 focus:outline-none" /></div>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] text-white/30 mb-1">旋转</label>
                        <div className="flex items-center gap-2">
                          <input type="range" min={0} max={360} value={rotation} onChange={(e) => setRotation(Number(e.target.value))} className="flex-1 h-1 rounded-full bg-white/10 appearance-none cursor-pointer" />
                          <input type="number" value={rotation} onChange={(e) => setRotation(Number(e.target.value))} className="w-12 h-7 rounded bg-white/[0.06] border border-white/[0.08] px-1.5 text-xs text-white/80 text-right focus:outline-none" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="px-3 py-3">
                  <button type="button" onClick={() => setShowBlend(!showBlend)} className="flex items-center justify-between w-full">
                    <span className="text-xs font-medium text-white/60">混合</span>
                    <svg className={`w-3 h-3 text-white/20 transition-transform ${showBlend ? '' : '-rotate-90'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
                  </button>
                  {showBlend && (
                    <div className="space-y-3 mt-3">
                      <div>
                        <label className="block text-[11px] text-white/30 mb-1">透明度</label>
                        <div className="flex items-center gap-2">
                          <input type="range" min={0} max={100} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} className="flex-1 h-1 rounded-full bg-white/10 appearance-none cursor-pointer" />
                          <input type="number" value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} className="w-12 h-7 rounded bg-white/[0.06] border border-white/[0.08] px-1.5 text-xs text-white/80 text-right focus:outline-none" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] text-white/30 mb-1">混合模式</label>
                        <select className="w-full h-7 rounded bg-white/[0.06] border border-white/[0.08] px-2 text-xs text-white/80 focus:outline-none"><option>正常</option><option>叠加</option><option>滤色</option><option>正片叠底</option></select>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="relative w-full h-1 shrink-0 cursor-row-resize hover:bg-white/20 active:bg-white/30 transition-colors group z-10 flex items-center justify-center" onMouseDown={timelineH.onMouseDown}>
        <GripHorizontal className="w-4 h-4 text-white/10 group-hover:text-white/40 transition-colors" />
      </div>

      {/* 底部时间轴 —— 原版布局，数据用真实 clips */}
      <section className="relative flex flex-col overflow-hidden shrink-0 border-t border-white/[0.04]" aria-label="时间轴" style={{ height: timelineH.size }}>
        <div className="flex h-10 items-center justify-between border-b border-white/[0.04] px-2 py-1 shrink-0">
          <div className="flex items-center gap-1">
            <ToolBtn title="链接"><Link2 className="w-4 h-4" /></ToolBtn>
            <ToolBtn title="分割"><Scissors className="w-4 h-4" /></ToolBtn>
            <ToolBtn title="裁剪"><Crop className="w-4 h-4" /></ToolBtn>
            <ToolBtn title="复制"><Copy className="w-4 h-4" /></ToolBtn>
            <ToolBtn title="删除" onClick={removeSelected}><Trash2 className="w-4 h-4" /></ToolBtn>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setMuted(!muted)} className={`w-7 h-7 rounded-sm flex items-center justify-center transition-colors border ${muted ? 'bg-white/10 text-white/50 border-white/10' : 'text-white/40 hover:text-white hover:bg-white/[0.06] border-transparent'}`} title={muted ? '取消静音' : '静音'}>
              <Volume2 className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => setLooping(!looping)} className={`w-7 h-7 rounded-sm flex items-center justify-center transition-colors ${looping ? 'text-white bg-white/10' : 'text-white/40 hover:text-white hover:bg-white/[0.06]'}`} title="循环">
              <Repeat className="w-4 h-4 scale-110" />
            </button>
            <div className="bg-white/10 mx-1 h-6 w-px" />
            <div className="flex items-center gap-1">
              <ToolBtn title="缩小" onClick={() => setTimelineZoom((z) => Math.max(0.05, z - 0.05))}><Minus className="w-4 h-4" /></ToolBtn>
              <input type="range" min={0.05} max={2} step={0.01} value={timelineZoom} onChange={(e) => setTimelineZoom(Number(e.target.value))} className="w-24 h-1.5 rounded-full bg-white/[0.08] appearance-none cursor-pointer" />
              <ToolBtn title="放大" onClick={() => setTimelineZoom((z) => Math.min(2, z + 0.05))}><Plus className="w-4 h-4" /></ToolBtn>
            </div>
          </div>
        </div>

        <div className="relative flex flex-1 flex-col overflow-hidden min-h-0">
          <div className="flex flex-1 overflow-hidden min-h-0">
            {/* 左轨头：与标尺/轨道行高对齐 */}
            <div className="flex shrink-0 flex-col w-[152px] border-r border-white/[0.06] bg-[#0a0a0a]">
              <div className="h-7 shrink-0 border-b border-white/[0.04]" />
              <div className="flex flex-1 items-center gap-2 px-3 min-h-[56px]">
                <div className="flex flex-1 items-center justify-end gap-2 text-white/35">
                  <Volume2 className="size-3.5" />
                  <span className="text-[11px]">视频轨</span>
                </div>
                <button
                  type="button"
                  className="shrink-0 h-9 w-12 rounded-md border border-dashed border-white/12 text-[11px] text-white/30 hover:text-white/55 hover:border-white/25 transition-colors"
                  title="设置封面"
                >
                  封面
                </button>
              </div>
            </div>

            {/* 标尺 + 轨道 */}
            <div className="relative flex flex-1 flex-col overflow-hidden min-w-0">
              <div className={`size-full overflow-x-auto overflow-y-hidden ${clipScroll}`}>
                <div className="relative min-h-full" style={{ width: trackWidth }}>
                  {/* 标尺 */}
                  <div
                    className="sticky top-0 z-10 h-7 border-b border-white/[0.06] bg-[#0c0c0e] cursor-pointer"
                    onClick={handleRulerClick}
                  >
                    <div className="relative h-full select-none">
                      {majorTicks.map((t, i) =>
                        t.major ? (
                          <span
                            key={`m-${i}`}
                            className="absolute bottom-1.5 -translate-x-1/2 text-[10px] leading-none text-white/35 tabular-nums"
                            style={{ left: t.left }}
                          >
                            {t.label}
                          </span>
                        ) : (
                          <span
                            key={`n-${i}`}
                            className="absolute bottom-0 h-1.5 w-px bg-white/[0.12]"
                            style={{ left: t.left }}
                          />
                        ),
                      )}
                    </div>
                  </div>

                  {/* 播放头 */}
                  <div
                    className="pointer-events-none absolute z-20"
                    style={{ left: playheadLeft, top: 0, bottom: 0, width: 2 }}
                  >
                    <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-white/90" />
                    <button
                      type="button"
                      aria-label="拖拽播放头"
                      className="pointer-events-auto absolute top-1.5 left-1/2 size-3 -translate-x-1/2 cursor-col-resize rounded-full border-2 border-white/70 bg-white shadow-sm"
                      onMouseDown={handlePlayheadDrag}
                    />
                  </div>

                  {/* 片段轨 */}
                  <div className="relative px-0 py-2" style={{ minHeight: 64 }}>
                    {clips.length === 0 ? (
                      <div className="mx-3 flex h-12 items-center justify-center rounded-md border border-dashed border-white/[0.08] bg-white/[0.02]">
                        <span className="text-[11px] text-white/25">
                          从左侧素材悬停点 <span className="text-white/40">+</span> 加入时间轴
                        </span>
                      </div>
                    ) : (
                      <div className="relative h-12">
                        {clips.map((clip) => {
                          const left = clip.startSec * PX_PER_SEC;
                          const width = Math.max(12, clip.durationSec * PX_PER_SEC);
                          const active = activeClip?.id === clip.id;
                          const selected = selectedClipId === clip.id;
                          return (
                            <div
                              key={clip.id}
                              onClick={() => setSelectedClipId(selected ? null : clip.id)}
                              onMouseDown={(e) => {
                                // 防止拖片段时选中文字
                                if (e.button === 0) e.preventDefault();
                              }}
                              className="absolute top-0 h-12 rounded-md px-2.5 flex items-center cursor-pointer border transition-colors overflow-hidden group select-none"
                              style={{
                                left,
                                width,
                                backgroundColor: clip.color + '40',
                                borderColor: active || selected ? clip.color : clip.color + '66',
                                boxShadow: selected ? `0 0 0 1px ${clip.color}` : undefined,
                              }}
                            >
                              <span className="pointer-events-none text-[11px] text-white/90 truncate font-medium">
                                {clip.name}
                              </span>
                              <span className="pointer-events-none ml-auto pl-2 text-[9px] text-white/40 tabular-nums shrink-0">
                                {clip.durationSec.toFixed(1)}s
                              </span>
                              <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-white/0 group-hover:bg-white/15 cursor-col-resize" />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function ToolBtn({ title, onClick, children }: { title: string; onClick?: () => void; children: React.ReactNode }) {
  return (
    <button className="w-7 h-7 rounded-sm flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors" type="button" title={title} onClick={onClick}>{children}</button>
  );
}

type AspectOption = { label: string; group: 'wide' | 'tall' | 'square' };

const aspectOptions: AspectOption[] = [
  { label: '适应', group: 'wide' },
  { label: '16:9', group: 'wide' },
  { label: '4:3', group: 'wide' },
  { label: '2.35:1', group: 'wide' },
  { label: '2:1', group: 'wide' },
  { label: '1.85:1', group: 'wide' },
  { label: '9:16', group: 'tall' },
  { label: '3:4', group: 'tall' },
  { label: '5.8寸', group: 'tall' },
  { label: '1:1', group: 'square' },
];

function AspectMini({ group }: { group: 'wide' | 'tall' | 'square' }) {
  if (group === 'wide') return <div className="w-4 h-2.5 rounded-sm border border-white/15" />;
  if (group === 'tall') return <div className="w-2.5 h-4 rounded-sm border border-white/15" />;
  return <div className="w-3 h-3 rounded-sm border border-white/15" />;
}

function AspectMenu({ current, onSelect }: { current: string; onSelect: (r: string) => void }) {
  return (
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-40 bg-[#1e1e22] border border-white/[0.08] rounded-md shadow-lg py-1 z-50">
      {aspectOptions.map(({ label, group }) => (
        <button
          key={label}
          type="button"
          onClick={() => onSelect(label)}
          className={`flex items-center gap-2 w-full px-3 py-1.5 text-[11px] transition-colors ${current === label ? 'text-blue-400 bg-blue-400/10' : 'text-white/60 hover:bg-white/[0.04] hover:text-white/80'}`}
        >
          <AspectMini group={group} />
          <span>{label}</span>
          {current === label && <span className="ml-auto text-blue-400 text-[10px]">✓</span>}
        </button>
      ))}
    </div>
  );
}
