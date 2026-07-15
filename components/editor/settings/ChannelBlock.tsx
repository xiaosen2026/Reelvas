'use client';

import { useMemo, useState } from 'react';
import type { ModelItem } from '../../../lib/settingsData';
import type { ApiChannel } from '../../../lib/settingsStore';
import {
  defaultApiForVideoProtocol,
  resolveVideoProtocol,
} from '../../../lib/llm/videoProtocolResolve';
import { ModelIcon } from './ModelIcon';

const IRefresh = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>;
const ISearch = () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>;
const IPlus = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5v14"/></svg>;
const ITrash = () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>;
const IChevron = () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>;
const IStar = () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
const IEye = () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>;
const IGlobe = () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>;
const IGear = () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/30"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/></svg>;
const IKey = () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-orange-400"><path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>;
const ITarget = () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/30"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>;
const IMinus = () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/></svg>;

// 按模型名的品牌关键词分类，兼容真实 API 返回名（gpt-4o-mini / claude-3-5-sonnet / gemini-2.0-flash 等）
const GROUP_RULES: Array<[RegExp, string]> = [
  [/deepseek/i, 'DeepSeek'],
  [/gemini/i, 'Gemini'],
  [/gpt|openai|o\d|dall[-\s]?e/i, 'OpenAI'],
  [/claude/i, 'Claude'],
  [/grok/i, 'Grok'],
  [/midjourney|\bmj\b/i, 'Midjourney'],
  [/qwen|通义/i, 'Qwen'],
  [/kling|可灵/i, 'Kling'],
  [/vidu/i, 'Vidu'],
  [/hailuo|海螺/i, 'Hailuo'],
  [/minimax/i, 'MiniMax'],
  [/banana/i, 'Nano Banana'],
  [/seedream|seedance/i, 'ByteDance'],
  [/doubao|豆包/i, 'Doubao'],
  [/\bwan\b|wanx/i, 'Wan'],
  [/flux/i, 'Flux'],
  [/bria|rmbg/i, 'Bria'],
  [/topaz/i, 'Topaz'],
  [/llama/i, 'Llama'],
  [/mistral|mixtral/i, 'Mistral'],
  [/glm|chatglm|智谱|zhipu|z-ai/i, '智谱'],
  [/moonshot|kimi/i, 'Kimi'],
  [/step/i, 'Step'],
  [/hunyuan|混元/i, 'Hunyuan'],
];

export function groupName(name: string): string {
  for (const [re, label] of GROUP_RULES) {
    if (re.test(name)) return label;
  }
  return '其他';
}

export function ChannelBlock({
  index, channel, protocols, loading, searchOpen, search, expanded,
  onSearch, onSearchOpen, onUpdate, onRemove, onFetch, onToggleGroup, onRemoveModel,
  channelKind,
}: {
  index: number; channel: ApiChannel; protocols: string[]; loading: boolean;
  searchOpen: boolean; search: string; expanded: Set<string>;
  onSearch: (v: string) => void; onSearchOpen: (v: boolean) => void;
  onUpdate: (p: Partial<ApiChannel>) => void; onRemove: () => void;
  onFetch: () => void; onToggleGroup: (g: string) => void;
  onRemoveModel: (name: string) => void;
  channelKind?: string;
}) {
  const groups = useMemo(() => {
    const map = new Map<string, ModelItem[]>();
    for (const m of channel.models) {
      const g = groupName(m.name);
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(m);
    }
    return Array.from(map.entries());
  }, [channel.models]);

  const filtered = search
    ? groups.map(([g, items]) => [g, items.filter((m) => m.name.toLowerCase().includes(search.toLowerCase()))] as const).filter(([, items]) => items.length > 0)
    : groups;

  // 协议相关顶部提示：官方直连 vs NewAPI 文案不同
  const protocolKind = resolveVideoProtocol(channel.protocol);
  const isOfficial =
    protocolKind === 'volcengine-direct' || protocolKind === 'aliyun-direct';
  const keyPlaceholder =
    protocolKind === 'volcengine-direct'
      ? '火山引擎 Ark / LAS API Key'
      : protocolKind === 'aliyun-direct'
        ? '阿里云百炼 DashScope API Key'
        : '输入 API Key';
  const isVideoChannel = channelKind === "video";
  const protocolHint = isVideoChannel
    ? isOfficial
      ? protocolKind === 'volcengine-direct'
        ? '官方直连：API 地址已填方舟 Ark。Seedance 1.x 可改 operator.las.cn-beijing.volces.com'
        : '官方直连：API 地址已填 dashscope.aliyuncs.com。请使用百炼 Key'
      : 'NewAPI 自行适配，每个站不一样，每个模型还要补字段，作者已疯。建议选官方直连协议。'
    : '';
  const apiAddrHint = isVideoChannel
    ? isOfficial
      ? protocolKind === 'volcengine-direct'
        ? '默认 Ark /api/v3；1.x 用 https://operator.las.cn-beijing.volces.com'
        : '默认北京地域；新加坡需改成对应 Workspace 域名'
      : '切换协议会自动填入官方/网关默认地址，仍可手动改。'
    : '';

  return (
    <div className="rounded-2xl border border-border/50 bg-white overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-6 h-16 bg-white border-b border-border/40">
        <div className="flex items-center gap-3">
          <span className="size-8 rounded-full bg-indigo-600 text-white text-sm font-bold flex items-center justify-center">{index + 1}</span>
          <span className="text-lg font-semibold text-foreground">渠道 {index + 1}</span>
        </div>
        <button type="button" onClick={onRemove} className="size-9 rounded-full bg-red-50 flex items-center justify-center text-red-500 hover:bg-red-100 transition-colors" title="删除渠道"><ITrash /></button>
      </div>

      <div className="p-6 space-y-5">
        <div className="grid grid-cols-[minmax(0,1fr)_180px] gap-4 items-start">
          <div className="min-w-0">
            <label className="block text-sm font-semibold text-foreground mb-2">API Key <span className="text-[10px] rounded bg-indigo-50 text-indigo-600 px-1.5 py-0.5 ml-1">必填</span></label>
            <input type="password" value={channel.apiKey} onChange={(e) => onUpdate({ apiKey: e.target.value })} placeholder={keyPlaceholder} className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors" />
            <p className="text-[10px] text-muted-foreground mt-1 opacity-50">
              {isOfficial ? '官方 Key，勿填 NewAPI 网关 Key' : '多个密钥使用逗号分隔'}
            </p>
          </div>
          <div className="min-w-0">
            <label className="block text-sm font-semibold text-foreground mb-2">协议 <span className="text-[10px] rounded bg-indigo-50 text-indigo-600 px-1.5 py-0.5 ml-1">必选</span></label>
            <ProtocolSelect
              value={channel.protocol}
              options={protocols}
              onChange={(v) => {
                // !!! 切换协议时同步改 API 地址，避免用户手填错 endpoint !!!
                // 视频协议表见 VIDEO_PROTOCOL_DEFAULT_API；非视频协议返回 fallback 原址
                const nextApi = defaultApiForVideoProtocol(v, channel.apiAddr || '');
                onUpdate({ protocol: v, apiAddr: nextApi });
              }}
            />
            <p
              className={`text-[10px] mt-1 leading-relaxed ${
                isOfficial ? 'text-emerald-700/90' : 'text-amber-600/80'
              }`}
            >
              {protocolHint}
            </p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-foreground mb-2">API 地址 <span className="text-[10px] rounded bg-indigo-50 text-indigo-600 px-1.5 py-0.5 ml-1">必填</span></label>
          <input type="text" value={channel.apiAddr} onChange={(e) => onUpdate({ apiAddr: e.target.value })} className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground font-mono placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors" />
          <p className="text-[10px] text-muted-foreground mt-1">{apiAddrHint}</p>
        </div>

        <div className="pt-1">
          <div className="flex items-start gap-1.5 p-2 rounded-md bg-amber-50/50 border border-amber-200/50">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500 shrink-0 mt-0.5"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <p className="text-[10px] text-amber-700 leading-relaxed">默认仅连接您配置的 API 地址。请勿误填云端计费端点；本地调试可用 localhost。统计为本地估算。</p>
          </div>
        </div>

        <div className="rounded-2xl border border-border/50 bg-white p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-foreground">模型</span>
              <span className="text-[10px] text-muted-foreground">{channel.models.length}</span>
              {channel.models.length > 0 && (
                <button type="button" className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-foreground" title="搜索" onClick={() => onSearchOpen(!searchOpen)}><ISearch /></button>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={onFetch} disabled={!channel.apiKey.trim() || loading} className="h-7 px-2.5 rounded-md border border-border bg-background text-[11px] text-foreground flex items-center gap-1 hover:bg-muted/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                {loading ? <span className="inline-block w-3 h-3 animate-spin rounded-full border-2 border-primary/30 border-t-primary" /> : <IRefresh />}
                获取模型
              </button>
              <button type="button" className="h-7 w-7 rounded-md border border-border bg-background flex items-center justify-center hover:bg-muted/30 transition-colors" title="添加"><IPlus /></button>
            </div>
          </div>

          {searchOpen && (
            <div className="mb-2 flex items-center gap-2 px-2 h-8 rounded-md border border-border bg-muted/10">
              <ISearch />
              <input value={search} onChange={(e) => onSearch(e.target.value)} placeholder="搜索模型..." className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none" autoFocus />
              {search && <button type="button" onClick={() => onSearch('')} className="text-muted-foreground hover:text-foreground"><IMinus /></button>}
            </div>
          )}

          {channel.models.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-1 border border-dashed border-border/30 rounded-md">
              <div className="size-8 rounded-full bg-muted/20 flex items-center justify-center opacity-40 mb-1"><ISearch /></div>
              <p className="text-xs font-medium">暂无模型</p>
              <p className="text-[10px] opacity-50">填写 API Key 后点击&quot;获取模型&quot;</p>
            </div>
          ) : (
            <div className="rounded-md border border-border/30 overflow-hidden">
              {filtered.map(([group, items]) => (
                <div key={group} className="border-b border-border/20 last:border-b-0">
                  <button type="button" onClick={() => onToggleGroup(group)} className="w-full flex items-center gap-2 px-3 h-8 hover:bg-muted/10 transition-colors">
                    <span className={`transition-transform text-[10px] ${expanded.has(group) ? 'rotate-90' : ''}`}><IChevron /></span>
                    <span className="text-xs text-foreground font-medium">{group}</span>
                    <span className="text-[10px] text-muted-foreground ml-auto">{items.length}</span>
                  </button>
                  {expanded.has(group) && (
                    <div>
                      {items.map((m) => (
                        <ModelRow key={m.name} model={m} onRemove={() => onRemoveModel(m.name)} />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProtocolSelect({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  // 历史落盘值不在当前列表时仍展示，避免下拉空白；选中后写回列表项
  const items = options.includes(value) ? options : value ? [value, ...options] : options;
  return (
    <div className="relative">
      {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}
      <button type="button" onClick={() => setOpen((v) => !v)} className="w-full h-9 px-2.5 rounded-lg border border-border bg-background text-xs text-foreground flex items-center justify-between hover:border-primary/50 transition-colors">
        <span className="truncate">{value}</span>
        <IChevron />
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-md bg-popover border border-border shadow-sm py-1 max-h-48 overflow-y-auto">
          {items.map((o) => (
            <button type="button" key={o} onClick={() => { onChange(o); setOpen(false); }} className={`w-full text-left px-3 py-1.5 text-xs hover:bg-muted/30 transition-colors ${o === value ? 'text-primary font-medium' : 'text-foreground'}`}>{o}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function ModelRow({ model, onRemove }: { model: ModelItem; onRemove: () => void }) {
  return (
    <div className="border-t border-border/10 hover:bg-muted/5 transition-colors">
      <div className="flex items-center gap-2 px-3 h-9">
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <ModelIcon name={model.name} size={14} fallback={model.icon} />
          <span className="text-xs text-foreground truncate">{model.name}</span>
          {model.desc ? (
            <span className="text-[10px] text-muted-foreground truncate max-w-40">{model.desc}</span>
          ) : null}
        </div>
        <div className="flex items-center gap-0.5">
          <button type="button" className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-amber-400 transition-colors" title="收藏"><IStar /></button>
          <button type="button" className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-emerald-400 transition-colors" title="预览"><IEye /></button>
          <button type="button" className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-blue-400 transition-colors" title="公开"><IGlobe /></button>
          <button type="button" className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-white/60 transition-colors" title="设置"><IGear /></button>
          <button type="button" className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-orange-400 transition-colors" title="密钥"><IKey /></button>
          <button type="button" className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-white/60 transition-colors" title="参数"><ITarget /></button>
          <button type="button" onClick={onRemove} className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-red-400 transition-colors ml-0.5" title="移除"><IMinus /></button>
        </div>
      </div>
    </div>
  );
}