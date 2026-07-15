'use client';

// 资产面板 —— 从 IndexedDB 读取真实资产，支持文件夹归类、删除、上传

import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Search, Trash2, Upload, FolderOpen, Grid, List } from 'lucide-react';
import {
  listAssets,
  listFolders,
  getAssetBlob,
  deleteAsset,
  getAssetStoreStats,
  type AssetMeta,
  type AssetKind,
} from '../../lib/assetStore';
import { putAsset } from '../../lib/assetStore';
import { createLogger } from '../../lib/logger';

const log = createLogger('AssetPanel');

interface AssetPanelProps {
  onClose: () => void;
}

type ViewMode = 'grid' | 'list';

function KindIcon({ kind }: { kind: AssetKind }) {
  const label =
    kind === 'video' ? '🎬' : kind === 'audio' ? '🎵' : kind === 'image' ? '🖼' : '📄';
  return <span className="text-[10px]">{label}</span>;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1048576).toFixed(1)}MB`;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const KIND_FILTERS = [
  { label: '全部', value: '' as AssetKind | '' },
  { label: '图片', value: 'image' as AssetKind },
  { label: '视频', value: 'video' as AssetKind },
  { label: '音频', value: 'audio' as AssetKind },
  { label: '文件', value: 'file' as AssetKind },
];

export function AssetPanel({ onClose }: AssetPanelProps) {
  const [assets, setAssets] = useState<AssetMeta[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [activeFolder, setActiveFolder] = useState<string>('全部');
  const [activeKind, setActiveKind] = useState<AssetKind | ''>('');
  const [view, setView] = useState<ViewMode>('grid');
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState({ count: 0, totalMB: 0 });
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [previewUrl, setPreviewUrl] = useState<{ id: string; url: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const importFolder = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const kind = activeKind || undefined;
    const folder =
      activeFolder && activeFolder !== '全部'
        ? activeFolder.startsWith('/')
          ? activeFolder
          : `/${activeFolder}`
        : undefined;
    const all = await listAssets({ folder, kind });
    setAssets(all);
    setFolders(await listFolders());
    setStats(await getAssetStoreStats());
  }, [activeFolder, activeKind]);

  useEffect(() => { void refresh(); }, [refresh]);

  const filtered = search
    ? assets.filter(
        (m) =>
          m.name.toLowerCase().includes(search.toLowerCase()) ||
          m.folder.includes(search),
      )
    : assets;

  const onFilePick = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files?.length) return;
      setPreviewLoading(true);
      let imported = 0;
      for (const f of Array.from(files)) {
        try {
          await putAsset(f, {
            name: f.name,
            folder: activeFolder === '全部' ? '/导入' : activeFolder,
          });
          imported += 1;
        } catch (err) {
          log.warn('onFilePick', 'fail', { name: f.name, msg: String(err) });
        }
      }
      setPreviewLoading(false);
      log.info('onFilePick', 'ok', { n: imported });
      void refresh();
      if (fileRef.current) fileRef.current.value = '';
    },
    [activeFolder, refresh],
  );

  const onDelete = useCallback(
    async (id: string) => {
      await deleteAsset(id);
      setPreviewUrl(null);
      void refresh();
    },
    [refresh],
  );

  const onBulkDelete = useCallback(async () => {
    for (const id of selected) await deleteAsset(id);
    setSelected(new Set());
    void refresh();
  }, [selected, refresh]);

  const onPreview = useCallback(async (meta: AssetMeta) => {
    if (previewUrl?.id === meta.id) return;
    setPreviewLoading(true);
    try {
      const blob = await getAssetBlob(meta.id);
      if (blob) {
        const url = URL.createObjectURL(blob);
        setPreviewUrl({ id: meta.id, url });
      }
    } catch {
      setPreviewUrl(null);
    }
    setPreviewLoading(false);
  }, [previewUrl?.id]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <>
      <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-[110] flex items-center justify-center pointer-events-none">
        <div className="pointer-events-auto w-[80vw] max-w-6xl h-[80vh] rounded-xl bg-card border border-border shadow-2xl flex flex-col overflow-hidden">
          {/* 顶栏 */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
            <span className="text-sm font-medium text-foreground">资产</span>
            <span className="text-[11px] text-muted-foreground">
              {stats.count} 项 · {stats.totalMB} MB
            </span>
            <div className="flex-1" />
            {/* 导入 */}
            <input ref={fileRef} type="file" multiple accept="image/*,video/*,audio/*" onChange={onFilePick} className="hidden" />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="h-8 px-3 rounded-md border border-border text-xs hover:bg-muted/30 flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" /> 导入
            </button>
            {selected.size > 0 && (
              <button
                type="button"
                onClick={onBulkDelete}
                className="h-8 px-3 rounded-md border border-red-200 text-xs text-red-600 hover:bg-red-50 flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" /> 删除 {selected.size}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 筛选栏 */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border/50 shrink-0">
            {/* kind */}
            <div className="flex items-center gap-1">
              {KIND_FILTERS.map((f) => (
                <button
                  key={f.label}
                  type="button"
                  onClick={() => setActiveKind(f.value)}
                  className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
                    activeKind === f.value
                      ? 'bg-primary/15 text-primary border border-primary/30'
                      : 'text-muted-foreground hover:text-foreground border border-transparent'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="w-px h-5 bg-border mx-1" />
            {/* 文件夹 */}
            <div className="flex items-center gap-1 flex-wrap">
              <button
                type="button"
                onClick={() => setActiveFolder('全部')}
                className={`px-2 py-1 text-xs rounded-md transition-colors ${
                  activeFolder === '全部'
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
                }`}
              >
                全部
              </button>
              {folders.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setActiveFolder(f)}
                  className={`px-2 py-1 text-xs rounded-md transition-colors flex items-center gap-1 ${
                    activeFolder === f
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
                  }`}
                >
                  <FolderOpen className="w-3 h-3" />
                  {f.replace(/^\//, '')}
                </button>
              ))}
            </div>
            <div className="flex-1" />
            <div className="relative w-44">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                ref={inputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索资产"
                className="w-full h-8 rounded-md bg-muted/50 border border-border pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring transition-colors"
              />
            </div>
            <button
              type="button"
              onClick={() => setView(view === 'grid' ? 'list' : 'grid')}
              className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/30"
            >
              {view === 'grid' ? <List className="w-4 h-4" /> : <Grid className="w-4 h-4" />}
            </button>
          </div>

          {/* 主体 */}
          <div className="flex-1 flex min-h-0 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center min-h-[240px] text-muted-foreground">
                  <FolderOpen className="w-12 h-12 opacity-20 mb-3" strokeWidth={1} />
                  <p className="text-sm">暂无资产</p>
                  <p className="text-xs opacity-50 mt-1">
                    {search ? '无匹配结果' : '点「导入」上传文件，或从画布节点上传/生成后自动入库'}
                  </p>
                </div>
              ) : view === 'grid' ? (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
                  {filtered.map((meta) => (
                    <AssetCard
                      key={meta.id}
                      meta={meta}
                      selected={selected.has(meta.id)}
                      onSelect={() => toggleSelect(meta.id)}
                      onPreview={() => onPreview(meta)}
                      onDelete={() => onDelete(meta.id)}
                      previewUrl={previewUrl?.id === meta.id ? previewUrl.url : undefined}
                    />
                  ))}
                </div>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/50 text-muted-foreground">
                      <th className="w-8 py-2 px-1" />
                      <th className="text-left py-2 px-2 font-medium">名称</th>
                      <th className="text-left py-2 px-2 font-medium">类型</th>
                      <th className="text-left py-2 px-2 font-medium">文件夹</th>
                      <th className="text-right py-2 px-2 font-medium">大小</th>
                      <th className="text-right py-2 px-2 font-medium">时间</th>
                      <th className="w-12 py-2 px-1" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((meta) => (
                      <tr
                        key={meta.id}
                        className={`border-b border-border/20 hover:bg-muted/20 ${
                          selected.has(meta.id) ? 'bg-primary/5' : ''
                        }`}
                      >
                        <td className="py-1.5 px-1">
                          <input
                            type="checkbox"
                            checked={selected.has(meta.id)}
                            onChange={() => toggleSelect(meta.id)}
                            className="accent-primary"
                          />
                        </td>
                        <td className="py-1.5 px-2 truncate max-w-[200px]">
                          <KindIcon kind={meta.kind} /> {meta.name}
                        </td>
                        <td className="py-1.5 px-2 text-muted-foreground">{meta.mime}</td>
                        <td className="py-1.5 px-2 text-muted-foreground">{meta.folder}</td>
                        <td className="py-1.5 px-2 text-right text-muted-foreground">{formatSize(meta.size)}</td>
                        <td className="py-1.5 px-2 text-right text-muted-foreground">{formatTime(meta.createdAt)}</td>
                        <td className="py-1.5 px-1">
                          <button
                            type="button"
                            onClick={() => onDelete(meta.id)}
                            className="text-muted-foreground hover:text-red-500 p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* 预览侧栏 */}
            {previewUrl && (() => {
              const meta = assets.find((m) => m.id === previewUrl.id);
              if (!meta) return null;
              return (
                <div className="w-64 shrink-0 border-l border-border/50 flex flex-col">
                  <div className="flex items-center justify-between px-4 py-2 border-b border-border/30">
                    <span className="text-xs font-medium truncate">{meta.name}</span>
                    <button
                      type="button"
                      onClick={() => setPreviewUrl(null)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div
                    className="flex-1 flex items-center justify-center p-2 bg-black/5 overflow-hidden"
                    style={{ minHeight: 0 }}
                  >
                    {previewLoading ? (
                      <span className="text-xs text-muted-foreground">加载中…</span>
                    ) : meta.kind === 'image' ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={previewUrl.url}
                        alt={meta.name}
                        className="max-w-full max-h-full object-contain rounded"
                      />
                    ) : meta.kind === 'video' ? (
                      <video
                        src={previewUrl.url}
                        controls
                        className="max-w-full max-h-full rounded"
                      />
                    ) : meta.kind === 'audio' ? (
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <span className="text-sm">{meta.name}</span>
                        <audio src={previewUrl.url} controls className="w-full" />
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {meta.mime} · {formatSize(meta.size)}
                      </span>
                    )}
                  </div>
                  <div className="px-4 py-2 border-t border-border/30 space-y-1 text-[11px] text-muted-foreground">
                    <p>文件夹: {meta.folder}</p>
                    <p>大小: {formatSize(meta.size)}</p>
                    <p>类型: {meta.mime}</p>
                    <p>ID: {meta.id.slice(0, 16)}…</p>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </>
  );
}

function AssetCard({
  meta, selected, onSelect, onPreview, onDelete, previewUrl,
}: {
  meta: AssetMeta;
  selected: boolean;
  onSelect: () => void;
  onPreview: () => void;
  onDelete: () => void;
  previewUrl?: string;
}) {
  return (
    <div
      className={`group relative rounded-xl border overflow-hidden hover:border-primary/40 transition-colors ${
        selected ? 'border-primary/60 bg-primary/5' : 'border-border/60'
      }`}
    >
      <div
        className="relative aspect-video bg-muted/30 overflow-hidden cursor-pointer"
        onClick={onPreview}
      >
        {previewUrl && meta.kind === 'image' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="" className="absolute inset-0 size-full object-cover" />
        ) : previewUrl && meta.kind === 'video' ? (
          <video
            src={previewUrl}
            muted
            playsInline
            className="absolute inset-0 size-full object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground/30">
            <KindIcon kind={meta.kind} />
          </div>
        )}
        <div className="absolute top-1 left-1">
          <input
            type="checkbox"
            checked={selected}
            onChange={onSelect}
            className="accent-primary size-3.5 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="size-6 rounded-full bg-black/50 flex items-center justify-center text-white/70 hover:text-white hover:bg-red-500"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
        <div className="absolute bottom-1 left-1 rounded bg-black/50 px-1 py-0.5 text-[9px] text-white/80">
          {formatSize(meta.size)}
        </div>
      </div>
      <div className="px-2 py-1.5">
        <p className="text-xs truncate font-medium">{meta.name}</p>
        <p className="text-[10px] text-muted-foreground">{meta.folder}</p>
      </div>
    </div>
  );
}
