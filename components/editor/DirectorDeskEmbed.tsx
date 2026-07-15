'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { createLogger } from '@/lib/logger';

const log = createLogger('DirectorDeskEmbed');

/** 开源导演台 hostBridge 消息类型（vendor 原样，不在此改逻辑） */
const MSG_READY = 'storyai:director-desk-ready';
const MSG_CLOSE = 'storyai:director-desk-close';
const MSG_CAPTURES = 'storyai:director-desk-captures-sent';
const MSG_SESSION = 'storyai:director-desk-session';

export interface DirectorDeskCapture {
  dataUrl: string;
  fileName: string;
}

interface Props {
  open: boolean;
  /** 按节点隔离 OSS 场景 localStorage scope */
  instanceId: string;
  theme?: 'light' | 'dark';
  onClose: () => void;
  onCaptures?: (captures: DirectorDeskCapture[]) => void;
}

function deskSrc(theme: 'light' | 'dark') {
  const base = process.env.NEXT_PUBLIC_DIRECTOR_DESK_URL?.replace(/\/$/, '');
  if (base) {
    return `${base}/?theme=${theme}`;
  }
  // 与主站同域静态资源：public/director-desk
  return `/director-desk/index.html?theme=${theme}`;
}

/**
 * 全屏 iframe 嵌入 vendor 开源 3D 导演台。
 * 必须 portal 到 document.body：节点在画布 transform 内，fixed 会被困在节点坐标系。
 */
export function DirectorDeskEmbed({
  open,
  instanceId,
  theme = 'dark',
  onClose,
  onCaptures,
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const readyRef = useRef(false);
  const src = useMemo(() => deskSrc(theme), [theme]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      readyRef.current = false;
      return;
    }

    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const type = event.data?.type;
      if (type === MSG_READY) {
        readyRef.current = true;
        const win = iframeRef.current?.contentWindow;
        win?.postMessage(
          {
            type: MSG_SESSION,
            payload: { instanceId, theme },
          },
          window.location.origin,
        );
        log.info('onMessage', 'director-desk ready + session', { instanceId, theme });
        return;
      }
      if (type === MSG_CLOSE) {
        log.info('onMessage', 'director-desk close');
        onClose();
        return;
      }
      if (type === MSG_CAPTURES) {
        const raw = event.data?.payload?.captures;
        if (!Array.isArray(raw) || !onCaptures) return;
        const captures: DirectorDeskCapture[] = raw
          .map((c: { dataUrl?: unknown; fileName?: unknown }) => ({
            dataUrl: typeof c?.dataUrl === 'string' ? c.dataUrl : '',
            fileName: typeof c?.fileName === 'string' ? c.fileName : 'capture.png',
          }))
          .filter((c: DirectorDeskCapture) => Boolean(c.dataUrl));
        if (captures.length) {
          onCaptures(captures);
          log.info('onMessage', 'captures', { n: captures.length });
        }
      }
    }

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [open, instanceId, theme, onClose, onCaptures]);

  // Esc 关闭全屏编辑区
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-300 flex flex-col bg-background"
      role="dialog"
      aria-modal="true"
      aria-label="3D 导演台编辑区"
    >
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-3">
        <span className="text-sm font-medium text-foreground">3D 导演台</span>
        <button
          type="button"
          className="rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={onClose}
        >
          关闭
        </button>
      </div>
      <iframe
        ref={iframeRef}
        title="3D 导演台"
        src={src}
        className="min-h-0 w-full flex-1 border-0"
        allow="fullscreen"
      />
    </div>,
    document.body,
  );
}
