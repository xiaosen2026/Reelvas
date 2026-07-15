'use client';

// 剪辑器左侧：画布素材列表（真实 URL）

import { Film, Image as ImageIcon, Music, Plus } from 'lucide-react';
import type { ClipMediaItem, ClipMediaKind } from './clipTypes';

type Filter = '全部' | '图片' | '视频' | '音频';

const FILTER_KIND: Record<Filter, ClipMediaKind | null> = {
  全部: null,
  图片: 'image',
  视频: 'video',
  音频: 'audio',
};

type Props = {
  items: ClipMediaItem[];
  filter: Filter;
  onFilter: (f: Filter) => void;
  onAddToTimeline: (item: ClipMediaItem) => void;
  emptyHint?: string;
};

function Thumb({ item }: { item: ClipMediaItem }) {
  if (item.kind === 'image') {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={item.url} alt="" className="absolute inset-0 size-full object-cover" />
    );
  }
  if (item.kind === 'video') {
    return (
      <video
        src={item.url}
        muted
        playsInline
        preload="metadata"
        className="absolute inset-0 size-full object-cover"
      />
    );
  }
  return (
    <div className="absolute inset-0 flex items-center justify-center text-white/20">
      <Music className="w-6 h-6" />
    </div>
  );
}

function KindIcon({ kind }: { kind: ClipMediaKind }) {
  if (kind === 'video') return <Film className="w-3 h-3" />;
  if (kind === 'audio') return <Music className="w-3 h-3" />;
  return <ImageIcon className="w-3 h-3" />;
}

export function ClipMediaLibrary({
  items,
  filter,
  onFilter,
  onAddToTimeline,
  emptyHint = '画布上暂无可用媒体。请先在画布生成/上传视频或图片。',
}: Props) {
  const kind = FILTER_KIND[filter];
  const list = kind ? items.filter((i) => i.kind === kind) : items;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex gap-1 px-2 py-1.5 shrink-0">
        {(Object.keys(FILTER_KIND) as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => onFilter(f)}
            className={`rounded px-2.5 py-0.5 text-[11px] transition-colors ${
              filter === f
                ? 'bg-white/15 text-white'
                : 'text-white/30 hover:text-white/60 hover:bg-white/5'
            }`}
          >
            {f}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto px-2">
        {list.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-3 text-center">
            <ImageIcon className="w-8 h-8 text-white/10 mb-2" />
            <p className="text-[11px] text-white/25 leading-relaxed">{emptyHint}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-1.5 pb-4">
            {list.map((item) => (
              <div key={item.id} className="group relative w-full">
                <div className="relative flex flex-col gap-0.5 pb-1">
                  <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                    <div className="absolute inset-0 bg-white/[0.04] rounded overflow-hidden border border-white/[0.04] group-hover:border-white/10">
                      <Thumb item={item} />
                      <div className="absolute top-1 left-1 flex items-center gap-0.5 rounded bg-black/50 px-1 py-0.5 text-[9px] text-white/70">
                        <KindIcon kind={item.kind} />
                        {item.durationSec > 0 ? `${item.durationSec.toFixed(1)}s` : ''}
                      </div>
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button
                          type="button"
                          title="添加到时间轴"
                          onClick={() => onAddToTimeline(item)}
                          className="w-8 h-8 rounded-full bg-emerald-600/90 flex items-center justify-center text-white hover:bg-emerald-500"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                  <span className="text-white/40 text-[10px] truncate px-0.5" title={item.name}>
                    {item.name}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
