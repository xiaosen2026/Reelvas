'use client';

// 视频 @ 下拉：已连接节点 + 个人素材库文件夹（对齐产品截图）

import { useMemo, useState } from 'react';
import { ChevronRight, Folder, Search } from 'lucide-react';

export type MentionImage = {
  index: number;
  id?: string | number;
  name: string;
  src: string;
  source?: 'connected' | 'asset';
  category?: string;
};

type Props = {
  images: MentionImage[];
  assets?: MentionImage[];
  filter: string;
  onSelect: (img: MentionImage) => void;
};

const FOLDERS = ['人物', '场景', '物品', '风格', '其他'] as const;

export function VideoMentionDropdown({ images, assets = [], filter, onSelect }: Props) {
  const f = filter.toLowerCase();
  const [folder, setFolder] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const connected = useMemo(() => {
    if (!f) return images;
    return images.filter((img) => img.name.toLowerCase().includes(f));
  }, [images, f]);

  const assetInFolder = useMemo(() => {
    if (!folder) return [];
    let list = assets.filter((a) => (a.category || '其他') === folder);
    const s = (search || f).toLowerCase();
    if (s) list = list.filter((a) => a.name.toLowerCase().includes(s));
    return list;
  }, [assets, folder, search, f]);

  const totalExtra = assets.length;

  return (
    <div
      className="absolute left-0 bottom-full mb-1 z-40 w-[240px] max-h-[360px] flex flex-col rounded-xl border border-border bg-card shadow-sm overflow-hidden nowheel nodrag"
      onPointerDown={(e) => {
        e.stopPropagation();
      }}
    >
      {/* 已连接节点 */}
      <div className="shrink-0 py-1.5">
        <div className="px-3 pb-1 text-[11px] text-muted-foreground">已连接节点</div>
        {connected.length === 0 ? (
          <p className="px-3 py-1.5 text-[11px] text-muted-foreground/50">无连接图片</p>
        ) : (
          connected.map((img) => (
            <button
              key={`c-${img.index}-${img.name}`}
              type="button"
              className="flex items-center gap-2.5 w-full px-3 py-2 text-left text-sm hover:bg-muted/60 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(img);
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.src}
                alt={img.name}
                className="size-7 rounded-md object-cover shrink-0 border border-border/50"
              />
              <span className="text-foreground truncate">{img.name}</span>
            </button>
          ))
        )}
      </div>

      <div className="mx-2 border-t border-border/40 shrink-0" />

      {/* 个人素材库 */}
      <div className="flex flex-col min-h-0 flex-1 overflow-hidden py-1.5">
        <div className="px-3 pb-1 text-[11px] text-muted-foreground shrink-0">个人素材库</div>

        {!folder ? (
          <div className="overflow-y-auto">
            {FOLDERS.map((name) => {
              const count = assets.filter((a) => (a.category || '其他') === name).length;
              return (
                <button
                  key={name}
                  type="button"
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-left text-sm hover:bg-muted/60 transition-colors"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setFolder(name);
                  }}
                >
                  <span className="flex items-center justify-center size-7 rounded-md bg-muted/50 text-muted-foreground shrink-0">
                    <Folder className="size-3.5" />
                  </span>
                  <span className="flex-1 text-foreground">{name}</span>
                  {count > 0 && (
                    <span className="text-[10px] text-muted-foreground tabular-nums">{count}</span>
                  )}
                  <ChevronRight className="size-3.5 text-muted-foreground/60 shrink-0" />
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
            <div className="flex items-center gap-1 px-2 pb-1.5 shrink-0">
              <button
                type="button"
                className="text-[11px] text-muted-foreground hover:text-foreground px-1"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setFolder(null);
                  setSearch('');
                }}
              >
                ← 返回
              </button>
              <span className="text-[11px] font-medium text-foreground">{folder}</span>
            </div>
            <div className="px-2 pb-1.5 shrink-0">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="搜索…"
                  className="w-full h-7 rounded-md border border-border/60 bg-muted/20 pl-7 pr-2 text-xs outline-none focus:border-foreground/25"
                  onPointerDown={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                />
              </div>
            </div>
            <div className="overflow-y-auto flex-1 min-h-0">
              {assetInFolder.length === 0 ? (
                <p className="px-3 py-2 text-[11px] text-muted-foreground/50">暂无素材</p>
              ) : (
                assetInFolder.map((a) => (
                  <button
                    key={`a-${a.id ?? a.name}`}
                    type="button"
                    className="flex items-center gap-2.5 w-full px-3 py-2 text-left text-sm hover:bg-muted/60 transition-colors"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onSelect({ ...a, source: 'asset' });
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={a.src}
                      alt={a.name}
                      className="size-7 rounded-md object-cover shrink-0 border border-border/50"
                    />
                    <span className="flex-1 truncate text-foreground">{a.name}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {totalExtra > 0 && !folder && (
        <div className="shrink-0 border-t border-border/40 px-3 py-1.5 text-[11px] text-muted-foreground">
          还有 {totalExtra} 个结果
        </div>
      )}
    </div>
  );
}
