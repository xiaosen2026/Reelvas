'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { GeneralTab } from './settings/GeneralTab';
import { NetworkTab } from './settings/NetworkTab';
import { AgentTab } from './settings/AgentTab';
import { SkillsTab } from './settings/SkillsTab';
import { SessionAssistantTab } from './settings/SessionAssistantTab';
import { NodeManagementTab } from './settings/NodeManagementTab';
import { ImageModelTab } from './settings/ImageModelTab';
import { VideoModelTab } from './settings/VideoModelTab';
import { AudioModelTab } from './settings/AudioModelTab';
import { TtsModelTab } from './settings/TtsModelTab';
import { TextModelTab } from './settings/TextModelTab';

const IX = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
);
const ISettings = () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>;

const tabList = ['通用', '调用统计', '图像模型', '视频模型', '音频模型', 'TTS 模型', '文本模型', '会话助手', 'Agent', 'Skills', '节点管理'] as const;
type Tab = (typeof tabList)[number];

const navIcons: Record<Tab, ReactNode> = {
  通用: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 21v-7"/><path d="M4 10V3"/><path d="M12 21v-9"/><path d="M12 8V3"/><path d="M20 21v-5"/><path d="M20 12V3"/><path d="M2 14h4"/><path d="M10 8h4"/><path d="M18 16h4"/></svg>,
  调用统计: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>,
  图像模型: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>,
  视频模型: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m22 8-6 4 6 4V8Z"/><rect x="2" y="6" width="14" height="12" rx="2"/></svg>,
  音频模型: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>,
  'TTS 模型': <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>,
  文本模型: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h5"/></svg>,
  会话助手: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 10h8"/><path d="M8 14h5"/></svg>,
  Agent: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="8" width="16" height="12" rx="2"/><path d="M12 4v4"/><path d="M8 14h.01"/><path d="M16 14h.01"/><path d="M9 18h6"/></svg>,
  Skills: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"/><path d="m17 5-5-3-5 3"/><path d="m17 19-5 3-5-3"/><path d="m20 12 2-5-5-2"/><path d="m20 12 2 5-5 2"/><path d="M4 12 2 7l5-2"/><path d="M4 12 2 17l5 2"/></svg>,
  节点管理: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
};

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('通用');

  return (
    <div
      className="fixed inset-0 z-[10030] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-[92vw] max-w-[1220px] h-[86vh] rounded-2xl bg-white border border-border/60 shadow-sm flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-8 pt-7 pb-4 shrink-0">
          <h2 className="text-xl font-bold text-foreground flex items-center gap-3"><span className="size-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center"><ISettings /></span>设置</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
            <IX />
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          <div className="w-48 shrink-0 px-6 py-2 flex flex-col gap-2 border-r border-border/40">
            {tabList.map((name) => (
              <button
                key={name}
                onClick={() => setTab(name)}
                className={`text-left px-3 py-2.5 rounded-xl text-sm transition-colors flex items-center gap-3 ${
                  tab === name
                    ? 'text-emerald-700 font-medium bg-emerald-50'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
                }`}
              >
                <span className="shrink-0">{navIcons[name]}</span>
                {name}
              </button>
            ))}
          </div>

          <div className="flex-1 min-w-0 overflow-y-auto px-10 py-4 bg-white">
            {tab === '通用' && <GeneralTab />}
            {tab === '调用统计' && <NetworkTab />}
            {tab === '图像模型' && <ImageModelTab />}
            {tab === '视频模型' && <VideoModelTab />}
            {tab === 'TTS 模型' && <TtsModelTab />}
            {tab === '音频模型' && <AudioModelTab />}
            {tab === '会话助手' && <SessionAssistantTab />}
            {tab === '文本模型' && <TextModelTab />}
            {tab === 'Agent' && <AgentTab />}
            {tab === 'Skills' && <SkillsTab />}
            {tab === '节点管理' && <NodeManagementTab />}
          </div>
        </div>

      </div>
    </div>
  );
}
