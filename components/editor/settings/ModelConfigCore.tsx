'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { ModelItem } from '../../../lib/settingsData';
import type { ApiChannel, ChannelKind } from '../../../lib/settingsStore';
import { loadChannels, saveChannels } from '../../../lib/settingsStore';
import { listModels } from '../../../lib/llm/openaiChat';
import { createLogger } from '../../../lib/logger';
import { resolveVideoProtocol } from '../../../lib/llm/videoProtocolResolve';
import { ChannelBlock, groupName } from './ChannelBlock';
import { ModelPickerDialog } from './ModelPickerDialog';

const log = createLogger('ModelConfigCore');

const IPlus = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M12 5v14" />
  </svg>
);

type Channel = ApiChannel;

interface Props {
  label: string;
  protocols: string[];
  defaultApi: string;
  models: ModelItem[];
  channelKind?: ChannelKind;
  seedLocalDebug?: boolean;
}

export function ModelConfigCore({ label, protocols, defaultApi, models: allModels, channelKind, seedLocalDebug }: Props) {
  const [channels, setChannels] = useState<Channel[]>(() =>
    channelKind
      ? loadChannels(channelKind, { protocol: protocols[0], apiAddr: defaultApi, seedLocalDebug })
      : [{ id: 1, apiKey: '', protocol: protocols[0], apiAddr: defaultApi, models: [] }],
  );
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [searchId, setSearchId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [pickerId, setPickerId] = useState<number | null>(null);
  const [candidates, setCandidates] = useState<ModelItem[]>([]);
  /** 已完成从 localStorage 同步，之后才允许写回，避免空占位覆盖 seed */
  const readyRef = useRef(false);

  // 挂载时从盘上拉取一次（含空配置 → 本地 seed 替换）；勿依赖 protocols 数组引用
  useEffect(() => {
    if (!channelKind) {
      readyRef.current = true;
      return;
    }
    const loaded = loadChannels(channelKind, {
      protocol: protocols[0],
      apiAddr: defaultApi,
      seedLocalDebug,
    });
    setChannels(loaded);
    if (seedLocalDebug) {
      saveChannels(channelKind, loaded);
    }
    readyRef.current = true;
    log.info('hydrate', 'channels from store', {
      kind: channelKind,
      count: loaded.length,
      addr: loaded[0]?.apiAddr,
      models: loaded[0]?.models?.length ?? 0,
    });
    // 仅挂载 / channelKind 变化时 hydrate
    // eslint-disable-next-line react-hooks/exhaustive-deps -- protocols/defaultApi 由 tab 固定
  }, [channelKind]);

  useEffect(() => {
    if (!channelKind || !readyRef.current) return;
    saveChannels(channelKind, channels);
  }, [channels, channelKind]);

  const addChannel = useCallback(() => {
    const maxId = channels.reduce((m, c) => Math.max(m, c.id), 0);
    setChannels((prev) => [...prev, { id: maxId + 1, apiKey: '', protocol: protocols[0], apiAddr: defaultApi, models: [] }]);
  }, [channels, protocols, defaultApi]);

  const removeChannel = useCallback((id: number) => {
    setChannels((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const updateChannel = useCallback((id: number, patch: Partial<Channel>) => {
    setChannels((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }, []);

  const fetchModels = useCallback(async (id: number) => {
    const ch = channels.find((c) => c.id === id);
    if (!ch?.apiKey.trim() || !ch.apiAddr.trim()) return;
    setLoadingId(id);
    setFetchError(null);
    log.info('fetchModels', 'start', { id, addr: ch.apiAddr });
    try {
      const ids = await listModels(ch.apiAddr, ch.apiKey);
      const local =
        /localhost|127\.0\.0\.1/i.test(ch.apiAddr) ||
        (() => {
          try {
            const h = new URL(ch.apiAddr).hostname;
            return h === 'localhost' || h === '127.0.0.1' || h === '::1';
          } catch {
            return false;
          }
        })();
      const models: ModelItem[] =
        ids.length > 0
          ? ids.map((name) => {
              const known = allModels.find((m) => m.name === name || m.name.toLowerCase() === name.toLowerCase());
              return {
                name,
                icon: known?.icon || '🌀',
                desc: known?.desc || (local ? '本地 · OpenAI 兼容' : ''),
              };
            })
          : allModels;
      // 不直接写入渠道，先打开选择弹窗让用户勾选
      setCandidates(models);
      setPickerId(id);
      log.info('fetchModels', 'candidates ready', { count: models.length });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.warn('fetchModels', 'fallback static models', { msg });
      setFetchError(msg);
      setCandidates(allModels);
      setPickerId(id);
    } finally {
      setLoadingId(null);
    }
  }, [channels, allModels, updateChannel]);

  const confirmPick = useCallback((picked: ModelItem[]) => {
    if (pickerId == null) return;
    const id = pickerId;
    setChannels((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const byName = new Map<string, ModelItem>();
        for (const m of c.models) byName.set(m.name, m);
        for (const m of picked) byName.set(m.name, m);
        return { ...c, models: Array.from(byName.values()) };
      }),
    );
    setExpanded(new Set([groupName(picked[0]?.name ?? '')]));
    log.info('confirmPick', 'merged', { id, added: picked.length });
    setPickerId(null);
    setCandidates([]);
  }, [pickerId]);

  const closePicker = useCallback(() => {
    setPickerId(null);
    setCandidates([]);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="size-12 rounded-2xl bg-indigo-500 text-white flex items-center justify-center shadow-sm"><IPlus /></span>
          <div>
            <p className="text-xl font-bold text-foreground">渠道管理</p>
            <p className="text-sm text-muted-foreground mt-1">管理您的 API 渠道和模型配置{label ? ` · ${label}` : ''}</p>
          </div>
        </div>
        <button type="button" onClick={addChannel} className="h-10 px-4 rounded-xl bg-indigo-600 text-white text-sm font-medium flex items-center gap-1.5 hover:bg-indigo-700 transition-colors">
          <IPlus /> 添加渠道
        </button>
      </div>

      {channelKind === 'video' && (() => {
        const primary = channels[0];
        const kind = resolveVideoProtocol(primary?.protocol);
        const isOfficial =
          kind === 'volcengine-direct' || kind === 'aliyun-direct';
        if (isOfficial) {
          return (
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-3 text-xs text-emerald-900 leading-relaxed">
              <span className="font-semibold">官方直连：</span>
              {kind === 'volcengine-direct'
                ? '当前走火山引擎官方 API（Ark/LAS）。请用官方 Key；模型名用 doubao-seedance-* 一类官方 id。参考图仍建议先走图床变公网 URL。'
                : '当前走阿里云通义万相官方 API（DashScope）。请用百炼 Key；模型名用 wan2.7-* 一类官方 id。参考图仍建议先走图床变公网 URL。'}
            </div>
          );
        }
        return (
          <div className="rounded-2xl border border-sky-100 bg-sky-50 px-5 py-3 text-xs text-sky-800 leading-relaxed">
            <span className="font-semibold">提示：</span>
            NewAPI 网关字段因站/模型而异，踩坑成本高。参考图的 data URL 也会撑爆 JSON，请开启
            <strong className="font-medium">「图生图 · 公网图床」</strong>
            。更稳请直接选
            <strong className="font-medium"> 火山引擎 / 阿里云 官方直连</strong>
            （切换协议会自动改 API 地址）。
          </div>
        );
      })()}

      {fetchError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          获取模型失败（已回退参考列表）：{fetchError}
        </div>
      )}

      {channels.map((ch, idx) => (
        <ChannelBlock
          key={ch.id}
          index={idx}
          channel={ch}
          protocols={protocols}
          channelKind={channelKind}
          loading={loadingId === ch.id}
          searchOpen={searchId === ch.id}
          search={search}
          expanded={expanded}
          onSearch={(v) => setSearch(v)}
          onSearchOpen={(v) => setSearchId(v ? ch.id : null)}
          onUpdate={(p) => updateChannel(ch.id, p)}
          onRemove={() => removeChannel(ch.id)}
          onFetch={() => fetchModels(ch.id)}
          onToggleGroup={(g) => setExpanded((prev) => {
            const n = new Set(prev);
            if (n.has(g)) n.delete(g);
            else n.add(g);
            return n;
          })}
          onRemoveModel={(name) => updateChannel(ch.id, { models: ch.models.filter((m) => m.name !== name) })}
        />
      ))}

      {pickerId != null && (
        <ModelPickerDialog
          candidates={candidates}
          initialSelected={channels.find((c) => c.id === pickerId)?.models.map((m) => m.name) ?? []}
          onConfirm={confirmPick}
          onClose={closePicker}
        />
      )}
    </div>
  );
}