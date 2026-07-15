'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  applySkillMention,
  filterSkillsByQuery,
  getActiveMentionQuery,
  segmentSkillHighlights,
} from '../../lib/copilotSkillMention';
import type { SkillItem } from '../../lib/settingsData';

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onStop?: () => void;
  loading?: boolean;
  placeholder?: string;
  disabled?: boolean;
}

export function CopilotMentionInput({
  value,
  onChange,
  onSubmit,
  onStop,
  loading,
  placeholder = '输入消息... 用 @ 引用 Skill（Enter 发送）',
  disabled,
}: Props) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const [caret, setCaret] = useState(0);
  const [menuIndex, setMenuIndex] = useState(0);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

  const active = useMemo(() => getActiveMentionQuery(value, caret), [value, caret]);
  const suggestions = useMemo(
    () => (active ? filterSkillsByQuery(active.query) : []),
    [active],
  );
  const showMenu = !!active && suggestions.length > 0;
  const segs = useMemo(() => segmentSkillHighlights(value), [value]);

  const syncCaret = useCallback(() => {
    const el = taRef.current;
    if (!el) return;
    setCaret(el.selectionStart ?? 0);
  }, []);

  const syncScroll = useCallback(() => {
    const ta = taRef.current;
    const mirror = mirrorRef.current;
    if (!ta || !mirror) return;
    mirror.scrollTop = ta.scrollTop;
    mirror.scrollLeft = ta.scrollLeft;
  }, []);

  const updateMenuPos = useCallback(() => {
    const el = taRef.current;
    if (!el || !active) {
      setMenuPos(null);
      return;
    }
    const rect = el.getBoundingClientRect();
    setMenuPos({
      top: Math.max(8, rect.top - 8),
      left: rect.left + 8,
    });
  }, [active]);

  useEffect(() => {
    if (!showMenu) {
      setMenuPos(null);
      return;
    }
    setMenuIndex(0);
    updateMenuPos();
  }, [showMenu, active?.query, updateMenuPos]);

  useEffect(() => {
    if (!showMenu) return;
    const onScroll = () => updateMenuPos();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [showMenu, updateMenuPos]);

  const pickSkill = useCallback(
    (skill: SkillItem) => {
      if (!active) return;
      const { text, caret: nextCaret } = applySkillMention(value, active.start, caret, skill.id);
      onChange(text);
      requestAnimationFrame(() => {
        const el = taRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(nextCaret, nextCaret);
        setCaret(nextCaret);
      });
    },
    [active, caret, onChange, value],
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape' && loading) {
      e.preventDefault();
      onStop?.();
      return;
    }

    if (showMenu) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMenuIndex((i) => (i + 1) % suggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMenuIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const skill = suggestions[menuIndex] ?? suggestions[0];
        if (skill) pickSkill(skill);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (loading) onStop?.();
      else onSubmit();
    }
  };

  const menu =
    showMenu && menuPos && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="fixed z-[10020] w-72 max-h-56 overflow-y-auto rounded-xl border border-border/60 bg-white shadow-sm p-1"
            style={{
              top: menuPos.top,
              left: menuPos.left,
              transform: 'translateY(-100%)',
            }}
            onMouseDown={(e) => e.preventDefault()}
          >
            <p className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
              Skills · @ 引用
            </p>
            {suggestions.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => pickSkill(s)}
                className={`w-full text-left rounded-lg px-2 py-2 transition-colors ${
                  i === menuIndex ? 'bg-emerald-50' : 'hover:bg-muted/40'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-medium text-emerald-700">@{s.id}</span>
                  <span className="text-[10px] text-muted-foreground">{s.category}</span>
                </div>
                <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5 leading-snug">
                  {s.desc}
                </p>
              </button>
            ))}
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="relative">
      <div
        ref={mirrorRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words text-sm leading-normal"
        style={{ minHeight: 35 }}
      >
        {value ? (
          segs.map((seg, i) => {
            if (seg.kind === 'skill') {
              return (
                <mark key={i} className="rounded-sm bg-emerald-100">
                  <span className="text-emerald-800">{seg.text}</span>
                </mark>
              );
            }
            if (seg.kind === 'skill-unknown') {
              return (
                <mark key={i} className="rounded-sm bg-amber-50">
                  <span className="text-amber-800">{seg.text}</span>
                </mark>
              );
            }
            return (
              <span key={i} className="text-foreground">
                {seg.text}
              </span>
            );
          })
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
        {value.endsWith('\n') ? <br /> : null}
      </div>
      <textarea
        ref={taRef}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          onChange(e.target.value);
          setCaret(e.target.selectionStart ?? e.target.value.length);
        }}
        onScroll={syncScroll}
        onKeyUp={syncCaret}
        onClick={syncCaret}
        onSelect={syncCaret}
        onKeyDown={onKeyDown}
        rows={1}
        placeholder=""
        spellCheck={false}
        className="relative w-full bg-transparent text-sm leading-normal caret-foreground focus:outline-none resize-none"
        style={{
          minHeight: 35,
          color: 'transparent',
          WebkitTextFillColor: 'transparent',
        }}
      />
      {menu}
    </div>
  );
}
