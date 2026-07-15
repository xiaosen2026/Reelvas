/** 文本结果 Markdown 轻量格式化（选区包裹 / 标题 / 自动排版） */

export type TextSel = { start: number; end: number };

export function wrapSelection(
  text: string,
  sel: TextSel,
  before: string,
  after: string,
  placeholder = '文本',
): { text: string; sel: TextSel } {
  const start = Math.max(0, Math.min(sel.start, text.length));
  const end = Math.max(start, Math.min(sel.end, text.length));
  const picked = text.slice(start, end);
  const inner = picked || placeholder;
  const next = text.slice(0, start) + before + inner + after + text.slice(end);
  if (picked) {
    return {
      text: next,
      sel: { start: start + before.length, end: start + before.length + inner.length },
    };
  }
  return {
    text: next,
    sel: {
      start: start + before.length,
      end: start + before.length + inner.length,
    },
  };
}

/** 当前行（或选区各行）加/换标题前缀 */
export function applyHeading(
  text: string,
  sel: TextSel,
  level: 1 | 2 | 3,
): { text: string; sel: TextSel } {
  const prefix = `${'#'.repeat(level)} `;
  const start = Math.max(0, Math.min(sel.start, text.length));
  const end = Math.max(start, Math.min(sel.end, text.length));
  const lineStart = text.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
  let lineEnd = text.indexOf('\n', end > start ? end - 1 : start);
  if (lineEnd < 0) lineEnd = text.length;

  const block = text.slice(lineStart, lineEnd);
  const lines = block.split('\n');
  const nextLines = lines.map((line) => {
    const bare = line.replace(/^#{1,6}\s+/, '');
    return prefix + bare;
  });
  const replaced = nextLines.join('\n');
  const next = text.slice(0, lineStart) + replaced + text.slice(lineEnd);
  return {
    text: next,
    sel: { start: lineStart, end: lineStart + replaced.length },
  };
}

/** 自动排版：换行统一、空行收敛、行尾空白、常见列表空格 */
export function autoFormatMarkdown(raw: string): string {
  let t = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  t = t.replace(/[ \t]+\n/g, '\n');
  t = t.replace(/\n{3,}/g, '\n\n');
  t = t
    .split('\n')
    .map((line) => {
      const m = line.match(/^(\s*)([-*+]|\d+\.)\s*(.*)$/);
      if (m) return `${m[1]}${m[2]} ${m[3].trimStart()}`;
      const h = line.match(/^(#{1,6})([^#\s].*)$/);
      if (h) return `${h[1]} ${h[2]}`;
      return line.replace(/[ \t]+$/g, '');
    })
    .join('\n');
  return t.replace(/^\n+/, '').replace(/\n+$/, '') + (raw.endsWith('\n') ? '\n' : '');
}

export function readTextareaSel(el: HTMLTextAreaElement | null, fallbackLen: number): TextSel {
  if (!el) return { start: fallbackLen, end: fallbackLen };
  return {
    start: el.selectionStart ?? fallbackLen,
    end: el.selectionEnd ?? fallbackLen,
  };
}

export function applyTextareaSel(el: HTMLTextAreaElement | null, sel: TextSel) {
  if (!el) return;
  el.focus();
  el.setSelectionRange(sel.start, sel.end);
}
