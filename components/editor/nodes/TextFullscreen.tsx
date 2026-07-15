'use client';

// 文本结果全屏：预览 / 编辑 + 格式工具栏 / 关闭

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { TextResultView } from './TextResultView';
import { TextFormatBar } from './TextFormatBar';
import { createLogger } from '../../../lib/logger';

const log = createLogger('TextFullscreen');

type Props = {
  open: boolean;
  title?: string;
  text: string;
  onChange: (value: string) => void;
  onClose: () => void;
};

export function TextFullscreen({ open, title = '文本', text, onChange, onClose }: Props) {
  const [editing, setEditing] = useState(false);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const hasResult = !!text;

  useEffect(() => {
    if (!open) {
      setEditing(false);
      return;
    }
    // 全屏打开后直接可编辑，并露出格式栏
    setEditing(true);
    log.info('open', 'text fullscreen', { len: text.length });
  }, [open, text.length]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (editing) setEditing(false);
        else onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, editing, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-300 flex flex-col bg-background text-foreground"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-b border-border shrink-0">
        <span className="text-sm text-muted-foreground truncate min-w-0">
          {title} · {text.length} 字
        </span>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <TextFormatBar
            nodeId="fullscreen"
            text={text}
            hasResult={hasResult}
            editing={editing}
            editorRef={editorRef}
            onStartEdit={() => setEditing(true)}
            onTextChange={onChange}
            showFullscreen={false}
          />
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="px-2.5 py-1 rounded-lg text-xs border border-border hover:bg-accent"
          >
            {editing ? '预览' : '编辑'}
          </button>
          <span className="hidden sm:inline text-xs text-muted-foreground">Esc 关闭</span>
          <button type="button" title="关闭" onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent">
            <X className="size-4" />
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0 flex flex-col">
        <TextResultView
          text={text}
          editing={editing}
          editorRef={editorRef}
          onStartEdit={() => setEditing(true)}
          onChange={onChange}
          onEndEdit={() => setEditing(false)}
        />
      </div>
    </div>,
    document.body,
  );
}
