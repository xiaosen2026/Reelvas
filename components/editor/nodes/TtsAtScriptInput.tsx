'use client';

// 高级模式：选中 + @ → @角色[内容]；可改派 / 取消，禁止套娃

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  segmentAtHighlights,
  stripAtMarkup,
  unwrapSelectionAt,
  wrapSelectionWithAt,
  type TtsCastMember,
} from '../../../lib/llm/ttsDialogue';
import { createLogger } from '../../../lib/logger';

const log = createLogger('TtsAtScriptInput');

type Props = {
  value: string;
  cast: TtsCastMember[];
  disabled?: boolean;
  rows?: number;
  placeholder?: string;
  onChange: (next: string) => void;
  onEnsureCast?: (name: string) => void;
};

type MenuState = {
  top: number;
  left: number;
  start: number;
  end: number;
  selected: string;
  canUnwrap: boolean;
};

type MenuItem = {
  id: string;
  label: string;
  action: 'unwrap' | 'assign';
  name?: string;
};

// 高亮不得改变字距/行高，否则与透明 textarea 选区错位，芯片后文本点选失败
const AT_CHIP =
  'inline rounded-sm box-decoration-clone border-0 font-inherit align-baseline';

const AT_PALETTE = [
  `${AT_CHIP} bg-sky-200/90 text-sky-800 dark:bg-sky-500/30 dark:text-sky-100`,
  `${AT_CHIP} bg-violet-200/90 text-violet-800 dark:bg-violet-500/30 dark:text-violet-100`,
  `${AT_CHIP} bg-emerald-200/90 text-emerald-800 dark:bg-emerald-500/30 dark:text-emerald-100`,
  `${AT_CHIP} bg-rose-200/90 text-rose-800 dark:bg-rose-500/30 dark:text-rose-100`,
  `${AT_CHIP} bg-orange-200/90 text-orange-800 dark:bg-orange-500/30 dark:text-orange-100`,
];

function atBgClass(speaker: string, known: boolean): string {
  if (!known) {
    return `${AT_CHIP} bg-amber-200/90 text-amber-900 dark:bg-amber-500/30 dark:text-amber-50`;
  }
  let h = 0;
  for (let i = 0; i < speaker.length; i++) h = (h + speaker.charCodeAt(i) * (i + 1)) % 997;
  return AT_PALETTE[h % AT_PALETTE.length];
}

export function TtsAtScriptInput({
  value, cast, disabled, rows = 6, placeholder, onChange, onEnsureCast,
}: Props) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [filter, setFilter] = useState('');
  const [hi, setHi] = useState(0);

  const castNames = useMemo(
    () => (cast || []).map((c) => c.name.trim()).filter(Boolean),
    [cast],
  );
  const segs = useMemo(() => segmentAtHighlights(value, castNames), [value, castNames]);

  const options = useMemo(() => {
    const names = castNames.length ? castNames : ['旁白', '角色A', '角色B'];
    const filtered = names.filter((n) =>
      !filter ? true : n.toLowerCase().includes(filter.toLowerCase()),
    );
    const f = filter.trim();
    if (f && !filtered.some((n) => n === f)) return [...filtered, f];
    return filtered.length ? filtered : names;
  }, [castNames, filter]);

  const menuItems = useMemo((): MenuItem[] => {
    if (!menu) return [];
    const list: MenuItem[] = [];
    if (menu.canUnwrap) list.push({ id: 'unwrap', label: '取消标记', action: 'unwrap' });
    for (const n of options) list.push({ id: 'a:' + n, label: '@' + n, action: 'assign', name: n });
    return list;
  }, [menu, options]);

  const syncScroll = useCallback(() => {
    const ta = taRef.current;
    const mirror = mirrorRef.current;
    if (ta && mirror) {
      mirror.scrollTop = ta.scrollTop;
      mirror.scrollLeft = ta.scrollLeft;
    }
  }, []);

  const closeMenu = useCallback(() => {
    setMenu(null);
    setFilter('');
    setHi(0);
  }, []);

  useEffect(() => {
    if (!menu) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (taRef.current?.contains(t)) return;
      if (document.getElementById('tts-at-cast-menu')?.contains(t)) return;
      closeMenu();
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menu, closeMenu]);

  const focusCursor = (cursor: number) => {
    requestAnimationFrame(() => {
      const el = taRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(cursor, cursor);
      syncScroll();
    });
  };

  const openMenu = (start: number, end: number, selected: string) => {
    const el = taRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const plain = stripAtMarkup(selected);
    const norm = selected.replace(/［/g, '[').replace(/］/g, ']').trim();
    const canUnwrap = Boolean(plain && (plain !== norm || /@[^\s@\[\]]{1,32}\[/.test(selected)));
    setMenu({
      top: rect.bottom + 4,
      left: rect.left + 8,
      start,
      end,
      selected: plain || selected,
      canUnwrap,
    });
    setFilter('');
    setHi(0);
    log.info('openMenu', 'at', { start, end, canUnwrap, len: selected.length });
  };

  const applySpeaker = (speaker: string) => {
    if (!menu) return;
    const name = speaker.trim() || '旁白';
    const { next, cursor } = wrapSelectionWithAt({
      full: value, start: menu.start, end: menu.end, speaker: name,
    });
    onChange(next);
    onEnsureCast?.(name);
    closeMenu();
    focusCursor(cursor);
    log.info('applySpeaker', 'wrapped', { speaker: name });
  };

  const applyUnwrap = () => {
    if (!menu) return;
    const { next, cursor } = unwrapSelectionAt({
      full: value, start: menu.start, end: menu.end,
    });
    onChange(next);
    closeMenu();
    focusCursor(cursor);
    log.info('applyUnwrap', 'ok', {});
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (menu) {
      if (e.key === 'Escape') { e.preventDefault(); closeMenu(); return; }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHi((i) => Math.min(i + 1, Math.max(menuItems.length - 1, 0)));
        return;
      }
      if (e.key === 'ArrowUp') { e.preventDefault(); setHi((i) => Math.max(i - 1, 0)); return; }
      if (e.key === 'Enter') {
        e.preventDefault();
        const item = menuItems[hi];
        if (!item) return;
        if (item.action === 'unwrap') applyUnwrap();
        else if (item.name) applySpeaker(item.name);
        return;
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setFilter((f) => f + e.key);
        setHi(0);
        return;
      }
      if (e.key === 'Backspace') {
        e.preventDefault();
        setFilter((f) => f.slice(0, -1));
        setHi(0);
        return;
      }
    }
    if (e.key === '@') {
      const el = e.currentTarget;
      const start = el.selectionStart ?? 0;
      const end = el.selectionEnd ?? 0;
      if (end > start) {
        e.preventDefault();
        openMenu(start, end, value.slice(start, end));
      }
    }
  };

  // 与 textarea 完全一致的排版 class，避免换行点不一致导致选区偏移
  // pr-8：右侧增强按钮不挡末尾字符点选
  const typeClass =
    'w-full whitespace-pre-wrap break-words text-sm leading-relaxed pl-1 pr-8 font-mono';

  return (
    <div className="relative">
      <div
        ref={mirrorRef}
        aria-hidden
        className={'pointer-events-none absolute inset-0 overflow-auto ' + typeClass}
      >
        {value ? segs.map((seg, i) => (
          seg.kind === 'at' ? (
            <mark key={i} className={atBgClass(seg.speaker, seg.known)}>
              {seg.text}
            </mark>
          ) : (
            <span key={i} className="text-foreground">{seg.text}</span>
          )
        )) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
        {value.endsWith('\n') ? <br /> : null}
      </div>
      <textarea
        ref={taRef}
        value={value}
        disabled={disabled}
        rows={rows}
        placeholder=""
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        onScroll={syncScroll}
        onKeyDown={onKeyDown}
        className={
          'relative resize-none bg-transparent outline-none caret-foreground selection:bg-violet-300/50 ' +
          typeClass
        }
        style={{ color: 'transparent', WebkitTextFillColor: 'transparent' }}
      />
      {menu ? (
        <div
          id="tts-at-cast-menu"
          className="fixed z-80 min-w-40 max-w-56 rounded-lg border border-border bg-card shadow-sm py-1"
          style={{ top: menu.top, left: menu.left }}
        >
          <div className="px-2 py-1 text-[10px] text-muted-foreground border-b border-border">
            选角色 / 改派 · Esc 关闭
            {filter ? <span className="ml-1 text-foreground">筛选: {filter}</span> : null}
          </div>
          <ul className="max-h-40 overflow-auto py-0.5">
            {menuItems.map((item, i) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={
                    'w-full text-left px-2.5 py-1.5 text-xs ' +
                    (i === hi
                      ? 'bg-accent text-foreground'
                      : item.action === 'unwrap'
                        ? 'text-red-600 hover:bg-red-50'
                        : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground')
                  }
                  onMouseEnter={() => setHi(i)}
                  onClick={() => {
                    if (item.action === 'unwrap') applyUnwrap();
                    else if (item.name) applySpeaker(item.name);
                  }}
                >
                  {item.label}
                  {item.action === 'assign' && menu.selected ? (
                    <span className="block text-[10px] opacity-70 truncate">
                      [{menu.selected.slice(0, 24)}{menu.selected.length > 24 ? '…' : ''}]
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
