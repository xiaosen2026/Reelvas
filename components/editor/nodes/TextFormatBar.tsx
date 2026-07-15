'use client';

// 文本 Markdown 格式操作条（节点顶栏 / 全屏共用）

import { useCallback, useState } from 'react';
import { Check, Copy, Maximize2, Pilcrow } from 'lucide-react';
import { Div, IconBtn } from './ImageNodeToolbarUi';
import {
  applyHeading,
  applyTextareaSel,
  autoFormatMarkdown,
  readTextareaSel,
  wrapSelection,
  type TextSel,
} from './textMarkdownFormat';
import { createLogger } from '../../../lib/logger';

const log = createLogger('TextFormatBar');

export type TextFormatBarProps = {
  nodeId?: string;
  text: string;
  hasResult: boolean;
  editing: boolean;
  editorRef: React.RefObject<HTMLTextAreaElement | null>;
  onStartEdit: () => void;
  onTextChange: (value: string) => void;
  onFullscreen?: () => void;
  showFullscreen?: boolean;
  className?: string;
};

function FmtBtn({
  title,
  disabled,
  onClick,
  style,
  children,
}: {
  title: string;
  disabled?: boolean;
  onClick: () => void;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      style={style}
      className="flex items-center justify-center min-w-8 h-8 px-1.5 rounded-full text-[13px] text-foreground hover:bg-muted/40 disabled:opacity-35 disabled:pointer-events-none transition-colors"
    >
      {children}
    </button>
  );
}

export function TextFormatBar({
  nodeId = 'fs',
  text,
  hasResult,
  editing,
  editorRef,
  onStartEdit,
  onTextChange,
  onFullscreen,
  showFullscreen = true,
  className = '',
}: TextFormatBarProps) {
  const [copied, setCopied] = useState(false);

  const commit = useCallback(
    (next: string, sel: TextSel) => {
      onTextChange(next);
      requestAnimationFrame(() => applyTextareaSel(editorRef.current, sel));
      log.debug('commit', 'format', { nodeId, len: next.length });
    },
    [onTextChange, editorRef, nodeId],
  );

  const withEdit = useCallback(
    (run: (src: string, sel: TextSel) => { text: string; sel: TextSel }) => {
      if (!hasResult && !text) return;
      const ensure = !editing;
      if (ensure) onStartEdit();
      const apply = () => {
        const el = editorRef.current;
        const src = el?.value ?? text;
        const sel = readTextareaSel(el, src.length);
        const out = run(src, sel);
        commit(out.text, out.sel);
      };
      if (ensure) requestAnimationFrame(() => requestAnimationFrame(apply));
      else apply();
    },
    [hasResult, text, editing, onStartEdit, editorRef, commit],
  );

  const onBold = useCallback(
    () => withEdit((src, sel) => wrapSelection(src, sel, '**', '**', '粗体')),
    [withEdit],
  );
  const onItalic = useCallback(
    () => withEdit((src, sel) => wrapSelection(src, sel, '*', '*', '斜体')),
    [withEdit],
  );
  const onUnderline = useCallback(
    () => withEdit((src, sel) => wrapSelection(src, sel, '<u>', '</u>', '下划线')),
    [withEdit],
  );
  const onH = useCallback(
    (level: 1 | 2 | 3) => withEdit((src, sel) => applyHeading(src, sel, level)),
    [withEdit],
  );

  const onAutoFormat = useCallback(() => {
    if (!text) return;
    const next = autoFormatMarkdown(text);
    if (next === text) return;
    onTextChange(next);
    if (!editing) onStartEdit();
    log.info('onAutoFormat', 'ok', { nodeId, before: text.length, after: next.length });
  }, [text, onTextChange, editing, onStartEdit, nodeId]);

  const onCopy = useCallback(async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
      log.info('onCopy', 'ok', { nodeId, len: text.length });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error('onCopy', 'failed', { nodeId, err: msg });
    }
  }, [text, nodeId]);

  return (
    <div
      className={`flex items-center gap-0.5 rounded-full border border-border/50 bg-card/95 backdrop-blur-sm px-1.5 py-1 shadow-sm w-max max-w-full ${className}`}
      onMouseDown={(e) => e.preventDefault()}
    >
      <FmtBtn title="粗体" disabled={!hasResult} onClick={onBold} style={{ fontWeight: 'bold' }}>
        B
      </FmtBtn>
      <FmtBtn title="斜体" disabled={!hasResult} onClick={onItalic} style={{ fontStyle: 'italic' }}>
        I
      </FmtBtn>
      <FmtBtn title="下划线" disabled={!hasResult} onClick={onUnderline} style={{ textDecoration: 'underline' }}>
        U
      </FmtBtn>
      <Div />
      <FmtBtn title="标题1" disabled={!hasResult} onClick={() => onH(1)}>
        H₁
      </FmtBtn>
      <FmtBtn title="标题2" disabled={!hasResult} onClick={() => onH(2)}>
        H₂
      </FmtBtn>
      <FmtBtn title="标题3" disabled={!hasResult} onClick={() => onH(3)}>
        H₃
      </FmtBtn>
      <Div />
      <IconBtn onClick={onAutoFormat} disabled={!hasResult} title="自动排版">
        <Pilcrow className="size-3.5" />
      </IconBtn>
      <IconBtn onClick={() => void onCopy()} disabled={!hasResult} title="复制">
        {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
      </IconBtn>
      {showFullscreen && onFullscreen ? (
        <IconBtn onClick={onFullscreen} disabled={!hasResult} title="全屏">
          <Maximize2 className="size-3.5" />
        </IconBtn>
      ) : null}
    </div>
  );
}
