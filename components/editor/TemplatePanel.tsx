'use client';

import { useState } from 'react';

// 模板市场弹窗 —— 严格对照原版 57400 截图复刻
// 三标签页 + 搜索/分类/排序 + 分类筛选 + 三列卡片画廊
const IX = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
);
const ISearch = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"><path d="m21 21-4.34-4.34" /><circle cx="11" cy="11" r="8" /></svg>
);
const IChevron = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 text-muted-foreground"><path d="m6 9 6 6 6-6" /></svg>
);
const ISort = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 text-muted-foreground"><path d="m3 16 4 4 4-4" /><path d="M7 20V4" /><path d="m21 8-4-4-4 4" /><path d="M17 4v16" /></svg>
);
const IEye = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" /><circle cx="12" cy="12" r="3" /></svg>
);
const IDownload = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M12 15V3" /><path d="m8 11 4 4 4-4" /><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /></svg>
);

const TABS = ['全部模板', '我的发布', '我的购买'];
const CATS = ['全部', '电商', '详情页', '设计', '广告', '抖音产品广告', '其他', '火影', '剧场', '短剧', '漫改'];

// 卡片数据（对照原版可见内容；预览图用占位块）
const cards = [
  { title: '长短剧模版，可更改集数、时间、可…', desc: '长短剧模版，可更改集数、时间、可达网上百分之95的效果', tags: ['短剧'], price: '฿5', dl: 8, free: false },
  { title: '角色板及分镜故事板seedance直出', desc: '角色板和分镜故事板提示词可以自行调整，如果要人物和场景最一致，还需要视频端口输入…', tags: ['短剧'], price: '免费', dl: 166, free: true },
  { title: '真人剧场版', desc: '模版没有通用性，只可以学习其生成形式，需要注意IP形象问题', tags: ['其他', '火影', '剧场'], price: '฿1', dl: 11, free: false },
  { title: '电商产品分屏详情页', desc: '产品图输入后自动生成分屏文案与全案视觉，逐屏出图', tags: ['电商', '详情页'], price: '免费', dl: 89, free: true },
  { title: '饮品广告快闪', desc: '品牌调性分析→创意大纲→分镜脚本→成片，适合社媒短视频', tags: ['广告'], price: '฿3', dl: 24, free: false },
  { title: '实景商业空间展示', desc: '产品图生成多场景实景展示图，适合家居、门店类目', tags: ['电商', '设计'], price: '免费', dl: 47, free: true },
];

export function TemplatePanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState('全部模板');
  const [cat, setCat] = useState('全部');
  const [query, setQuery] = useState('');

  // 交互过滤：标签页(仅"全部模板"有数据) + 分类 + 搜索关键词
  const q = query['trim']();
  const filtered = tab === '全部模板'
    ? cards['filter']((c) => {
        const catOk = cat === '全部' || c['tags']['includes'](cat);
        const qOk = !q || c['title']['includes'](q) || c['desc']['includes'](q);
        return catOk && qOk;
      })
    : [];

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center pt-[8vh] px-4 bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-4xl max-h-[84vh] rounded-2xl bg-card border border-border/50 shadow-xl flex flex-col overflow-hidden" onClick={(e) => e['stopPropagation']()}>
        {/* 标题 + 关闭 */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 shrink-0">
          <h3 className="text-lg font-semibold text-foreground">模板</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"><IX /></button>
        </div>

        {/* 标签页 */}
        <div className="flex items-center gap-1 px-6 shrink-0">
          {TABS['map']((t) => (
            <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${tab === t ? 'bg-muted text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'}`}>{t}</button>
          ))}
        </div>

        {/* 搜索 + 分类下拉 + 排序 */}
        <div className="flex items-center gap-3 px-6 pt-4 pb-3 shrink-0">
          <div className="relative flex-1">
            <ISearch />
            <input value={query} onChange={(ev) => setQuery(ev['currentTarget']['value'])} placeholder="搜索模板..." className="w-full h-10 pl-9 pr-3 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 transition-shadow" />
          </div>
          <button className="flex items-center gap-1.5 h-10 px-3 rounded-lg border border-border text-sm text-foreground hover:bg-muted/50 transition-colors shrink-0">
            <span>全部分类</span><IChevron />
          </button>
          <button className="flex items-center gap-1.5 h-10 px-3 rounded-lg border border-border text-sm text-foreground hover:bg-muted/50 transition-colors shrink-0">
            <ISort /><span>最新</span>
          </button>
        </div>

        {/* 分类筛选标签 */}
        <div className="flex items-center gap-2 flex-wrap px-6 pb-4 shrink-0">
          {CATS['map']((c) => (
            <button key={c} onClick={() => setCat(c)} className={`px-3 py-1 rounded-full text-xs transition-colors ${cat === c ? 'bg-primary text-primary-foreground' : 'bg-muted/60 text-muted-foreground hover:bg-muted'}`}>{c}</button>
          ))}
        </div>

        {/* 卡片网格 */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
          {filtered['length'] === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-sm font-medium text-muted-foreground">
                {tab === '全部模板' ? '没有匹配的模板' : `${tab}暂无内容`}
              </p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                {tab === '全部模板' ? '试试其它分类或搜索关键词' : '你还没有相关模板'}
              </p>
            </div>
          ) : (
          <div className="grid grid-cols-3 gap-4">
            {filtered['map']((card) => (
              <div key={card['title']} className="rounded-xl border border-border overflow-hidden flex flex-col bg-background">
                {/* 预览图占位 */}
                <div className="aspect-[4/3] bg-neutral-900 flex items-center justify-center">
                  <span className="text-white/20 text-xs">预览图</span>
                </div>
                {/* 信息区 */}
                <div className="p-3 flex flex-col gap-2 flex-1">
                  <p className="text-sm font-medium text-foreground line-clamp-1">{card['title']}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2rem]">{card['desc']}</p>
                  <div className="flex items-center gap-1 flex-wrap">
                    {card['tags']['map']((tg) => (
                      <span key={tg} className="inline-flex items-center rounded border border-border text-[10px] px-1.5 py-0 text-muted-foreground">{tg}</span>
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className={card['free'] ? 'text-foreground' : ''}>{card['price']}</span>
                    <span className="flex items-center gap-1"><IDownload /> {card['dl']}</span>
                  </div>
                  {/* 预览 + 获取 */}
                  <div className="flex items-center gap-2 pt-1">
                    <button className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg border border-border text-xs text-foreground hover:bg-muted/50 transition-colors">
                      <IEye /><span>预览</span>
                    </button>
                    <button className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity">
                      <IDownload /><span>{card['free'] ? '免费获取' : '获取'}</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
