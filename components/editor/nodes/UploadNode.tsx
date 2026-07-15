'use client';

// 上传节点：本地图片 / 视频 / 音频加载与预览（FileReader dataURL）

import { useCallback, useEffect, useRef, useState } from 'react';
import { Film, Image as ImageIcon, Music, Replace, Upload } from 'lucide-react';
import { Handle, Position, useFlow } from '../flow';
import { createLogger } from '@/lib/logger';
import {
  UPLOAD_ACCEPT,
  inferMediaType,
  kindFromStored,
  mediaKindLabel,
  type MediaKind,
} from './uploadMedia';
import { mapNodeMediaSize } from './fitMediaNodeSize';
import { putAsset } from '../../../lib/assetStore';

const log = createLogger('UploadNode');

interface NodeProps {
  id: string;
  data: {
    label?: string;
    fileUrl?: string;
    fileType?: string;
    fileName?: string;
    mediaKind?: string;
    value?: string;
    videoUrl?: string;
    audioUrl?: string;
  };
  selected?: boolean;
}

export function UploadNode({ id, data, selected }: NodeProps) {
  const rf = useFlow();
  const [url, setUrl] = useState(data.fileUrl || '');
  const [type, setType] = useState(data.fileType || '');
  const [name, setName] = useState(data.fileName || '');
  const [kind, setKind] = useState<MediaKind>(() =>
    kindFromStored(data.fileType || '', data.mediaKind, data.fileUrl),
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const label = data.label || '上传';

  useEffect(() => {
    if (!data.fileUrl) return;
    if (data.fileUrl === url && (data.fileType || '') === type) return;
    setUrl(data.fileUrl);
    setType(data.fileType || '');
    setName(data.fileName || '');
    setKind(kindFromStored(data.fileType || '', data.mediaKind, data.fileUrl));
  }, [data.fileUrl, data.fileType, data.fileName, data.mediaKind, url, type]);

  const persist = useCallback(
    (next: { fileUrl: string; fileType: string; fileName: string; mediaKind: MediaKind }) => {
      rf.setNodes((nds) =>
        nds.map((n) =>
          n.id === id
            ? {
                ...n,
                data: {
                  ...n.data,
                  fileUrl: next.fileUrl,
                  fileType: next.fileType,
                  fileName: next.fileName,
                  mediaKind: next.mediaKind,
                  value: next.fileUrl,
                  imageUrl: next.mediaKind === 'image' ? next.fileUrl : undefined,
                  videoUrl: next.mediaKind === 'video' ? next.fileUrl : undefined,
                  audioUrl: next.mediaKind === 'audio' ? next.fileUrl : undefined,
                },
              }
            : n,
        ),
      );
      log.info('persist', 'ok', {
        id,
        mediaKind: next.mediaKind,
        fileType: next.fileType,
        name: next.fileName,
        urlLen: next.fileUrl.length,
      });
    },
    [rf, id],
  );

  const loadFile = useCallback(
    (file: File) => {
      const inferred = inferMediaType(file.name, file.type);
      if (inferred.mediaKind === 'file') {
        setErr('仅支持图片、视频、音频文件');
        log.warn('loadFile', 'unsupported', { name: file.name, type: file.type });
        return;
      }
      if (file.size > 80 * 1024 * 1024) {
        setErr('文件过大（建议 < 80MB），请压缩后再上传');
        log.warn('loadFile', 'too-large', { name: file.name, size: file.size });
        return;
      }

      setBusy(true);
      setErr('');
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = String(reader.result || '');
        // 存到 IndexedDB 资产库（asset://{id}），重开不丢
        let assetRef = '';
        try {
          assetRef = await putAsset(file, {
            name: file.name,
            folder: `/${inferred.mediaKind}`,
            kind: inferred.mediaKind,
          });
        } catch (err) {
          log.warn('loadFile', 'asset store fail, fallback dataURL', { msg: String(err) });
        }
        const payload = {
          fileUrl: dataUrl,
          fileType: inferred.fileType,
          fileName: file.name,
          mediaKind: inferred.mediaKind,
          // asset:// 引用持久化，dataUrl 仅用于本次会话
          ...(assetRef ? { assetRef, value: assetRef } : {}),
        };
        setUrl(dataUrl);
        setType(inferred.fileType);
        setName(file.name);
        setKind(inferred.mediaKind);
        setBusy(false);
        persist(payload);
        log.info('loadFile', 'stored', {
          name: file.name,
          kind: inferred.mediaKind,
          size: file.size,
          asset: Boolean(assetRef),
        });
      };
      reader.onerror = () => {
        setBusy(false);
        setErr('读取文件失败');
        log.error('loadFile', 'reader-error', { name: file.name });
      };
      reader.readAsDataURL(file);
    },
    [persist],
  );

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) loadFile(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file) loadFile(file);
  };

  const openPicker = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    inputRef.current?.click();
  };

  const KindIcon = kind === 'video' ? Film : kind === 'audio' ? Music : ImageIcon;

  return (
    <div className="relative group w-full h-full">
      <div className="absolute left-0 bottom-full pb-1.5 flex items-center gap-1.5">
        <Upload className="size-3 text-muted-foreground" />
        <span className="text-[11px] text-muted-foreground font-medium tracking-wide">{label}</span>
        {url ? (
          <span className="text-[10px] px-1.5 py-0.5 rounded-md border border-border text-muted-foreground">
            {mediaKindLabel(kind)}
          </span>
        ) : null}
      </div>

      <div
        className={`relative flex h-full w-full items-center justify-center overflow-hidden rounded-2xl border transition-[box-shadow,border-color] duration-200 cursor-move ${
          selected ? 'ring-2 ring-zinc-500' : 'border-border/80'
        } ${url && kind === 'image' ? 'border-0 bg-black' : 'bg-card'}`}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onDrop={onDrop}
      >
        {busy ? (
          <span className="text-xs text-muted-foreground">读取中…</span>
        ) : url ? (
          <>
            {kind === 'image' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={url}
                alt={name}
                draggable={false}
                className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover"
                onLoad={(e) => {
                  const img = e.currentTarget;
                  rf.setNodes((nds) =>
                    mapNodeMediaSize(nds, id, img.naturalWidth, img.naturalHeight),
                  );
                }}
              />
            ) : kind === 'video' ? (
              <video
                src={url}
                controls
                playsInline
                preload="metadata"
                className="nodrag nowheel h-full w-full object-cover bg-black"
                onPointerDown={(e) => e.stopPropagation()}
                onLoadedMetadata={(e) => {
                  const v = e.currentTarget;
                  rf.setNodes((nds) =>
                    mapNodeMediaSize(nds, id, v.videoWidth, v.videoHeight),
                  );
                }}
              />
            ) : kind === 'audio' ? (
              <div className="nodrag flex w-full flex-col items-center gap-3 px-4 py-3">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-muted/50">
                  <Music className="size-6 text-muted-foreground" />
                </div>
                <p className="max-w-full truncate text-xs text-muted-foreground" title={name}>
                  {name || '音频'}
                </p>
                <audio
                  src={url}
                  controls
                  preload="metadata"
                  className="w-full"
                  onPointerDown={(e) => e.stopPropagation()}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 px-4 text-center">
                <KindIcon className="size-6 text-muted-foreground" />
                <span className="text-xs text-muted-foreground break-all">{name || '已加载'}</span>
              </div>
            )}

            <button
              type="button"
              className="nodrag absolute top-2 right-2 z-10 flex items-center gap-1 rounded-full border border-border bg-background/85 px-2.5 py-1 text-xs text-muted-foreground shadow-sm backdrop-blur-sm hover:text-foreground"
              onClick={openPicker}
              title="替换文件"
            >
              <Replace className="size-3.5" />
              替换
            </button>
            {name ? (
              <div className="pointer-events-none absolute bottom-2 left-2 right-2 truncate rounded-md bg-foreground/65 px-2 py-1 text-[10px] text-background">
                {name}
              </div>
            ) : null}
          </>
        ) : (
          <button
            type="button"
            onClick={openPicker}
            className="nodrag flex flex-col items-center justify-center gap-2 px-4 text-muted-foreground transition-colors hover:text-foreground"
          >
            <Upload className="size-8" strokeWidth={1.5} />
            <span className="text-xs">点击或拖入 图片 / 视频 / 音频</span>
            <span className="text-[10px] text-muted-foreground/80">png · mp4 · mp3 等</span>
          </button>
        )}

        {err ? (
          <div className="pointer-events-none absolute inset-x-2 bottom-10 rounded-md bg-red-500/90 px-2 py-1 text-center text-[10px] text-white">
            {err}
          </div>
        ) : null}

        <input ref={inputRef} type="file" accept={UPLOAD_ACCEPT} onChange={onPick} className="hidden" />
      </div>

      <Handle type="target" position={Position.Left} style={{ left: -6, top: '50%', transform: 'translateY(-50%)' }} />
      <Handle type="source" position={Position.Right} style={{ right: -6, top: '50%', transform: 'translateY(-50%)' }} />
    </div>
  );
}
