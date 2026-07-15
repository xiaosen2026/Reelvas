'use client';

// 资产库（IndexedDB）：分两层
//   1. 全局资产（workflowId=null）—— 用户手动导入，所有工作流共享
//   2. 工作流资产（workflowId=xxx）—— 节点生成的结果，跟工作流绑定
// 节点 data 中只存 asset://{id} 引用，不塞 dataURL。
// 工作流文件（.json 落盘）只含引用 ID。

import { createLogger } from './logger';
const log = createLogger('assetStore');

const DB_NAME = 'reelvas-assets';
const DB_VERSION = 2;
const STORE = 'assets';

export type AssetKind = 'image' | 'video' | 'audio' | 'file';

export type AssetMeta = {
  id: string;
  kind: AssetKind;
  name: string;
  mime: string;
  size: number;
  /** sha256 前缀，用于去重 */
  hash: string;
  /** 文件夹路径，如 /上传、/生成 */
  folder: string;
  /** null=全局资产（所有工作流共享）；字符串=所属工作流名 */
  workflowId: string | null;
  createdAt: number;
  refCount: number;
};

export const ASSET_PREFIX = 'asset://';

export function isAssetRef(v: unknown): v is string {
  return typeof v === 'string' && v.startsWith(ASSET_PREFIX);
}

export function assetIdFromRef(ref: string): string {
  return ref.startsWith(ASSET_PREFIX) ? ref.slice(ASSET_PREFIX.length) : ref;
}

export function buildAssetRef(id: string): string {
  return ASSET_PREFIX + id;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('indexedDB not available'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const s = db.createObjectStore(STORE, { keyPath: 'id' });
        s.createIndex('kind', 'kind', { unique: false });
        s.createIndex('folder', 'folder', { unique: false });
        s.createIndex('hash', 'hash', { unique: false });
        s.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    req.onsuccess = () => { dbPromise = null; resolve(req.result); };
    req.onerror = () => { dbPromise = null; reject(req.error); };
  });
  return dbPromise;
}

async function sha256(buf: ArrayBuffer): Promise<string> {
  if (typeof crypto?.subtle?.digest === 'function') {
    const h = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 24);
  }
  return `${buf.byteLength}_${Date.now().toString(36)}`;
}

function generateId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function kindFromMime(mime: string, name?: string): AssetKind {
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('image/')) return 'image';
  const ext = (name || '').toLowerCase().split('.').pop();
  if (ext?.match(/png|jpe?g|webp|gif|bmp|svg/)) return 'image';
  if (ext?.match(/mp4|webm|mov|mkv|avi/)) return 'video';
  if (ext?.match(/mp3|wav|ogg|m4a|aac|flac/)) return 'audio';
  return 'file';
}

async function storeBlob(blob: Blob, opts?: {
  name?: string; folder?: string; kind?: AssetKind; skipDedup?: boolean;
  /** 全局资产=null（默认）；工作流资产=当前工作流名 */
  workflowId?: string | null;
}): Promise<{ meta: AssetMeta; deduped: boolean }> {
  const buf = await blob.arrayBuffer();
  const hash = await sha256(buf);
  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  const store = tx.objectStore(STORE);

  if (!opts?.skipDedup) {
    const dup = await new Promise<AssetMeta | null>((resolve, reject) => {
      const req = store.index('hash').get(hash);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
    if (dup && dup.size === blob.size) {
      tx.abort();
      log.info('storeBlob', 'dedup', { id: dup.id, name: dup.name, hash: hash.slice(0, 16) });
      return { meta: dup, deduped: true };
    }
  }

  const name = opts?.name || `asset-${Date.now()}`;
  const id = generateId();
  const kind = opts?.kind || kindFromMime(blob.type, name);
  const meta: AssetMeta = {
    id, kind, name, mime: blob.type || 'application/octet-stream',
    size: blob.size, hash,
    folder: opts?.folder || '/上传',
    workflowId: opts?.workflowId ?? null,
    createdAt: Date.now(), refCount: 1,
  };

  await new Promise<void>((resolve, reject) => {
    store.put({ ...meta, blob: buf });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  log.info('storeBlob', 'stored', { id, kind, name, size: blob.size });
  return { meta, deduped: false };
}

/**
 * 存入 asset：接收 File/Blob/dataURL/http URL → 返回 asset://{id}
 * workflowId=null → 全局资产；workflowId=工作流名 → 工作流资产
 */
export async function putAsset(
  input: Blob | File | string,
  opts?: {
    name?: string; folder?: string; kind?: AssetKind; skipDedup?: boolean;
    workflowId?: string | null;
  },
): Promise<string> {
  let blob: Blob;
  let name = opts?.name;

  if (typeof input === 'string') {
    if (input.startsWith('data:') || input.startsWith('blob:')) {
      const res = await fetch(input);
      blob = await res.blob();
    } else if (/^https?:\/\//i.test(input)) {
      const res = await fetch(input);
      blob = await res.blob();
      name = name || input.split('/').pop()?.split('?')[0] || 'remote';
    } else {
      throw new Error('putAsset: 不支持的 URL');
    }
  } else {
    blob = input;
    name = name || (input instanceof File ? input.name : undefined);
  }

  const { meta } = await storeBlob(blob, { ...opts, name });
  return buildAssetRef(meta.id);
}

/** 按 id 取资产 Blob */
export async function getAssetBlob(id: string): Promise<Blob | null> {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readonly');
  const store = tx.objectStore(STORE);
  const record = await new Promise<{ blob?: ArrayBuffer; mime: string } | null>((resolve, reject) => {
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
  if (!record?.blob) return null;
  return new Blob([record.blob], { type: record.mime });
}

/** 按 id 取 dataURL（渲染用） */
export async function getAssetDataUrl(id: string): Promise<string | null> {
  const blob = await getAssetBlob(id);
  if (!blob) return null;
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/** 取元数据（不含 blob） */
export async function getAssetMeta(id: string): Promise<AssetMeta | null> {
  const db = await openDb();
  const store = db.transaction(STORE, 'readonly').objectStore(STORE);
  return new Promise((resolve) => {
    const req = store.get(id);
    req.onsuccess = () => {
      const r = req.result as (AssetMeta & { blob?: unknown }) | undefined;
      if (!r) { resolve(null); return; }
      const { blob: _, ...m } = r;
      resolve(m as AssetMeta);
    };
    req.onerror = () => resolve(null);
  });
}

/** 列出资产（按类型/文件夹/工作流筛选） */
export async function listAssets(opts?: {
  folder?: string; kind?: AssetKind; limit?: number;
  /** null=全局资产；字符串=工作流名；不传=全部 */
  workflowId?: string | null;
}): Promise<AssetMeta[]> {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readonly');
  const store = tx.objectStore(STORE);
  const all = await new Promise<AssetMeta[]>((resolve, reject) => {
    let req: IDBRequest;
    if (opts?.folder) req = store.index('folder').getAll(opts.folder);
    else if (opts?.kind) req = store.index('kind').getAll(opts.kind);
    else req = store.getAll();
    req.onsuccess = () => {
      const list = (req.result || []) as (AssetMeta & { blob?: unknown })[];
      resolve(list.map(({ blob, ...m }) => m as AssetMeta));
    };
    req.onerror = () => reject(req.error);
  });
  let filtered = all;
  if (opts?.kind && !opts?.folder) filtered = filtered.filter((m) => m.kind === opts.kind);
  if ('workflowId' in (opts || {})) {
    filtered = filtered.filter((m) => m.workflowId === opts!.workflowId);
  }
  const sorted = filtered.sort((a, b) => b.createdAt - a.createdAt);
  return opts?.limit ? sorted.slice(0, opts.limit) : sorted;
}

/** 获取所有文件夹 */
export async function listFolders(): Promise<string[]> {
  const all = await listAssets();
  const set = new Set(all.map((m) => m.folder));
  return [...set].sort();
}

/** 删除资产 */
export async function deleteAsset(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  const store = tx.objectStore(STORE);
  await new Promise<void>((resolve, reject) => {
    store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  log.info('deleteAsset', 'deleted', { id });
}

/** 按节点 data 字段提取所有 asset:// 引用 */
export function collectAssetRefs(data: Record<string, unknown>): string[] {
  const refs: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === 'string' && v.startsWith(ASSET_PREFIX)) {
      if (!refs.includes(v)) refs.push(v);
    } else if (Array.isArray(v)) {
      v.forEach(walk);
    } else if (v && typeof v === 'object') {
      Object.values(v).forEach(walk);
    }
  };
  walk(data);
  return refs;
}

/** 统计 */
export async function getAssetStoreStats(): Promise<{ count: number; totalMB: number }> {
  const all = await listAssets();
  return { count: all.length, totalMB: Math.round((all.reduce((s, m) => s + m.size, 0) / 1048576) * 100) / 100 };
}
