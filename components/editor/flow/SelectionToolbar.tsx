'use client';

import { useState } from 'react';

interface SelectionToolbarProps {
  position: { x: number; y: number };
  onGroup: () => void;
  onLayout: (type: 'grid' | 'horizontal' | 'vertical') => void;
  onCreateAsset: () => void;
  onBatchDownload: () => void;
  /** 多图图层合并（≥2 张有图节点） */
  onMergeLayers?: () => void;
  mergeDisabled?: boolean;
  isGroup?: boolean;
  onUngroup?: () => void;
  onRunGroup?: () => void;
  onCreateWorkflow?: () => void;
}

export function SelectionToolbar({
  position, onGroup, onLayout, onCreateAsset, onBatchDownload,
  onMergeLayers, mergeDisabled,
  isGroup, onUngroup, onRunGroup, onCreateWorkflow,
}: SelectionToolbarProps) {
  const [layoutOpen, setLayoutOpen] = useState(false);

  return (
    <div className="absolute z-50 nodrag select-none" style={{ left: position.x, top: position.y }} onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-0.5 rounded-xl border border-border/40 bg-card/95 backdrop-blur-sm px-1.5 py-1 shadow-md pointer-events-auto">
        {isGroup && onUngroup && onRunGroup && onCreateWorkflow ? (
          <>
            {/* 打组后工具栏 */}
            <div className="relative">
              <TbBtn onClick={() => setLayoutOpen((v) => !v)}>
                <IStack /> <span className="text-[11px] ml-1">布局</span> <IChevron />
              </TbBtn>
              {layoutOpen && <LayoutMenu onSelect={(t) => { onLayout(t); setLayoutOpen(false); }} onClose={() => setLayoutOpen(false)} />}
            </div>
            <Div />
            <TbBtn onClick={onRunGroup} highlight><IGreenPlay /><span className="text-[11px] ml-1 text-emerald-400">整组执行</span></TbBtn>
            <Div />
            <TbBtn onClick={onCreateWorkflow}><IFile /><span className="text-[11px] ml-1">创建工作流</span></TbBtn>
            <Div />
            <TbBtn onClick={onUngroup}><IStack /><span className="text-[11px] ml-1">解组</span></TbBtn>
          </>
        ) : (
          <>
            {/* 普通选中工具栏 */}
            <TbBtn onClick={onCreateAsset}><IStack /><span className="text-[11px] ml-1">创建资产</span></TbBtn>
            <Div />
            {onMergeLayers ? (
              <>
                <TbBtn onClick={onMergeLayers} disabled={mergeDisabled}>
                  <IMerge /><span className="text-[11px] ml-1">图层合并</span>
                </TbBtn>
                <Div />
              </>
            ) : null}
            <TbBtn onClick={onGroup}><IFolder /><span className="text-[11px] ml-1">打组</span></TbBtn>
            <Div />
            <TbBtn onClick={onBatchDownload}><IDownload /><span className="text-[11px] ml-1">批量下载</span></TbBtn>
            <Div />
            <div className="relative">
              <TbBtn onClick={() => setLayoutOpen((v) => !v)}>
                <IGrid /><span className="text-[11px] ml-1">布局</span> <IChevron />
              </TbBtn>
              {layoutOpen && <LayoutMenu onSelect={(t) => { onLayout(t); setLayoutOpen(false); }} onClose={() => setLayoutOpen(false)} />}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function LayoutMenu({ onSelect, onClose }: { onSelect: (t: 'grid' | 'horizontal' | 'vertical') => void; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute top-full left-0 mt-1 w-36 rounded-lg bg-popover border border-border shadow-md py-1 z-50">
        <button onClick={() => onSelect('grid')} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-muted/30 transition-colors"><IGrid />宫格布局</button>
        <button onClick={() => onSelect('horizontal')} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-muted/30 transition-colors"><IHorizontal />水平布局</button>
        <button onClick={() => onSelect('vertical')} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-muted/30 transition-colors"><IVertical />垂直布局</button>
      </div>
    </>
  );
}

function TbBtn({ onClick, children, highlight, disabled }: { onClick: () => void; children: React.ReactNode; highlight?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex items-center h-8 px-2 rounded-lg hover:bg-muted/30 transition-colors text-foreground disabled:opacity-35 disabled:pointer-events-none ${highlight ? 'text-emerald-400' : ''}`}
    >
      {children}
    </button>
  );
}
function Div() { return <div className="w-px h-5 bg-border/30" />; }

const IStack = () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2h8l4 4v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6Z"/><path d="M12 18v-6"/><path d="M9 15h6"/></svg>;
const IFolder = () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19V7a2 2 0 0 0-2-2H11l-2-3H4a2 2 0 0 0-2 2v12"/></svg>;
const IDownload = () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>;
const IGrid = () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>;
const IHorizontal = () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="5" rx="1"/><rect x="3" y="11" width="18" height="5" rx="1"/><rect x="3" y="18" width="18" height="2" rx="1"/></svg>;
const IVertical = () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="3" width="5" height="18" rx="1"/><rect x="11" y="3" width="5" height="18" rx="1"/><rect x="18" y="3" width="2" height="18" rx="1"/></svg>;
const IChevron = () => <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>;
const IGreenPlay = () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-emerald-400"><polygon points="5 3 19 12 5 21 5 3"/></svg>;
const IFile = () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/></svg>;
const IMerge = () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><path d="M17 13v4h4"/><path d="m13 21 4-4 4 4"/></svg>;
