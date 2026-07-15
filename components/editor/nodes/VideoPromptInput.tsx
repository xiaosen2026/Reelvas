'use client';

// contenteditable @ 编辑器（对齐参考代码）
// DOM 是唯一数据源，插入 chip 用 Range，不回调写覆盖 DOM

import { memo, useEffect, useRef } from 'react';
import type { MentionImage } from './VideoMentionDropdown';

type Props = {
  /** 携带 chip HTML 的初始内容，用于取消/选回时恢复 */
  initialHtml?: string;
  images: MentionImage[];
  placeholder?: string;
  onChange: (plain: string, html?: string) => void;
  onMention: (filter: string | null, plain: string, cursor: number) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  className?: string;
};

export function replaceAtCursor(text: string, cursor: number, name: string): { plain: string; cursor: number } {
  const before = text.slice(0, cursor);
  const after = text.slice(cursor);
  const m = before.match(/@([^\s@]*)$/);
  if (m) {
    const at = before.length - m[0].length;
    const token = `@${name} `;
    return { plain: before.slice(0, at) + token + after, cursor: at + token.length };
  }
  const end = text.match(/@([^\s@]*)$/);
  if (end) {
    const at = text.length - end[0].length;
    const token = `@${name} `;
    return { plain: text.slice(0, at) + token + after, cursor: at + token.length };
  }
  const sep = text && !/\s$/.test(text) ? ' ' : '';
  const token = ` @${name} `;
  return { plain: text + token, cursor: text.length + token.length };
}

function htmlToPlain(root: HTMLElement): string {
  let out = '';
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) { out += node.textContent || ''; return; }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    if (el.getAttribute('data-mention')) { out += `@${el.getAttribute('data-mention')}`; return; }
    if (el.tagName === 'BR') { out += '\n'; return; }
    for (const c of Array.from(el.childNodes)) walk(c);
    if (['DIV', 'P'].includes(el.tagName) && el.nextSibling) out += '\n';
  };
  for (const c of Array.from(root.childNodes)) walk(c);
  return out.replace(/ /g, ' ');
}

function makeChip(img: MentionImage): HTMLSpanElement {
  const chip = document.createElement('span');
  chip.contentEditable = 'false';
  chip.setAttribute('data-mention', img.name);
  chip.draggable = true;
  chip.className = 'mention-keyword inline-flex items-center align-middle rounded-md bg-sky-50 dark:bg-sky-500/15 px-1 py-0.5 mx-0.5 text-sky-700 dark:text-sky-300 text-xs font-medium border border-sky-200/80 dark:border-sky-500/30 select-none';
  if (img.src) {
    const im = document.createElement('img');
    im.src = img.src;
    im.className = 'mention-inline-thumb inline-block size-4 rounded object-cover align-middle mr-0.5';
    im.draggable = false;
    chip.appendChild(im);
  }
  const lab = document.createElement('span');
  lab.textContent = `@${img.name}`;
  chip.appendChild(lab);
  return chip;
}

export const VideoPromptInput = memo(function VideoPromptInput({
  initialHtml,
  images,
  placeholder,
  onChange,
  onMention,
  onKeyDown,
  className = '',
}: Props) {
  const elRef = useRef<HTMLDivElement>(null);
  const composingRef = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onMentionRef = useRef(onMention);
  onMentionRef.current = onMention;
  // 首次挂载：用 initialHtml（带 chip HTML）恢复
  useEffect(() => {
    const el = elRef.current;
    if (!el || !initialHtml) return;
    if (el.innerHTML.trim()) return;
    el.innerHTML = initialHtml;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 曝光插入函数给父组件（通过 window，与参考代码一致）
  useEffect(() => {
    (window as any).__insertMention = (img: MentionImage) => {
      const el = elRef.current;
      if (!el) return null;
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount) return null;
      const range = sel.getRangeAt(0);
      let node = range.startContainer;
      // 若在 chip 内，跳到 chip 后
      if (node.nodeType === Node.ELEMENT_NODE) {
        const chip = (node as HTMLElement).closest?.('[data-mention]');
        if (chip) { range.setStartAfter(chip); range.collapse(true); node = range.startContainer; }
      }
      if (node.nodeType !== Node.TEXT_NODE) return null;
      const text = node.textContent || '';
      const pos = range.startOffset;
      const m = text.slice(0, pos).match(/@([^\s@]*)$/);
      if (!m) return null;
      // 删除 @filter
      range.setStart(node, pos - m[0].length);
      range.deleteContents();
      // 插入 chip（参考代码方式）
      const chip = makeChip(img);
      range.insertNode(chip);
      // 光标放 chip 后
      const after = document.createRange();
      after.setStartAfter(chip);
      after.collapse(true);
      sel.removeAllRanges();
      sel.addRange(after);
      // 通知父组件（DOM 已更新，直接读）
      const plain = htmlToPlain(el);
      onChangeRef.current(plain, el.innerHTML);
      onMentionRef.current(null, plain, 0);
      return plain;
    };
    (window as any).__htmlToPlain = () => elRef.current ? htmlToPlain(elRef.current) : '';
    return () => {
      delete (window as any).__insertMention;
      delete (window as any).__htmlToPlain;
    };
  }, []);

  const emitMention = (text: string, cursor: number) => {
    const before = text.slice(0, cursor);
    const m = before.match(/@([^\s@]*)$/);
    if (m) onMentionRef.current(m[1] || '', text, cursor);
    else onMentionRef.current(null, text, cursor);
  };

  const syncFromDom = () => {
    if (composingRef.current) return;
    const el = elRef.current;
    if (!el) return;
    const plain = htmlToPlain(el);
    onChangeRef.current(plain, el.innerHTML);
    // 检测 @
    const sel = window.getSelection();
    if (sel?.rangeCount) {
      const r = sel.getRangeAt(0);
      const node = r.startContainer;
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || '';
        const pos = r.startOffset;
        const m = text.slice(0, pos).match(/@([^\s@]*)$/);
        if (m) onMentionRef.current(m[1] || '', plain, pos);
        else onMentionRef.current(null, plain, 0);
        return;
      }
    }
    onMentionRef.current(null, plain, 0);
  };

  return (
    <div
      ref={elRef}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline
      data-placeholder={placeholder || ''}
      className={`w-full min-h-[2.75rem] max-h-28 overflow-y-auto outline-none text-sm leading-relaxed px-1 whitespace-pre-wrap break-words empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground nowheel nodrag ${className}`}
      onCompositionStart={() => { composingRef.current = true; }}
      onCompositionEnd={() => { composingRef.current = false; syncFromDom(); }}
      onInput={syncFromDom}
      onKeyUp={() => { if (!composingRef.current) syncFromDom(); }}
      onClick={syncFromDom}
      onKeyDown={onKeyDown}
      onPaste={(e) => { e.preventDefault(); document.execCommand('insertText', false, e.clipboardData.getData('text/plain')); }}
    />
  );
});
