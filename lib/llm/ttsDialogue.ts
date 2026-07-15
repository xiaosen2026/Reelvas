// TTS 多人配音：@角色[内容] 解析 + 角色音色

import { createLogger } from '../logger';
import { defaultSpeechVoice, listSpeechVoices } from './openaiSpeech';

const log = createLogger('ttsDialogue');

export type TtsMode = 'normal' | 'advanced';
export type TtsCastMember = { name: string; voice: string };
export type TtsDialogueLine = { speaker: string; text: string; voice: string };
export type AtTokenRange = {
  start: number;
  end: number;
  speaker: string;
  body: string;
  raw: string;
};
export type AtHighlightSeg =
  | { kind: 'text'; text: string }
  | { kind: 'at'; text: string; speaker: string; known: boolean };

const LEGACY_LINE_RE =
  /^(?:【\s*([^】]+?)\s*】|\[\s*([^\]]+?)\s*\]|([^:：\n@]{1,24})\s*[:：])\s*(.+)$/;

function normalizeBrackets(s: string): string {
  return String(s || '').replace(/［/g, '[').replace(/］/g, ']');
}

function isSpeakerChar(ch: string): boolean {
  return Boolean(ch) && !/\s|@|\[|\]/.test(ch);
}

/** 括号平衡扫描 @角色[内容]（避免非贪婪正则嵌套错乱） */
export function listAtTokenRanges(script: string): AtTokenRange[] {
  const s = normalizeBrackets(script);
  const out: AtTokenRange[] = [];
  let i = 0;
  while (i < s.length) {
    if (s[i] !== '@') { i += 1; continue; }
    let j = i + 1;
    while (j < s.length && isSpeakerChar(s[j]) && j - (i + 1) < 32) j += 1;
    if (j === i + 1 || s[j] !== '[') { i += 1; continue; }
    const speaker = s.slice(i + 1, j);
    let k = j + 1;
    let depth = 1;
    while (k < s.length && depth > 0) {
      if (s[k] === '[') depth += 1;
      else if (s[k] === ']') depth -= 1;
      k += 1;
    }
    if (depth !== 0) { i += 1; continue; }
    out.push({
      start: i,
      end: k,
      speaker,
      body: s.slice(j + 1, k - 1),
      raw: s.slice(i, k),
    });
    i = k;
  }
  return out;
}

/** 反复剥离 @角色[...]，保留换行 */
export function stripAtMarkup(text: string): string {
  let s = normalizeBrackets(text);
  let prev = '';
  let guard = 0;
  while (prev !== s && guard++ < 24) {
    prev = s;
    const tokens = listAtTokenRanges(s);
    if (!tokens.length) break;
    for (let t = tokens.length - 1; t >= 0; t -= 1) {
      const tok = tokens[t];
      s = s.slice(0, tok.start) + tok.body + s.slice(tok.end);
    }
  }
  s = s.replace(/@([^\s@\[\]]{1,32})\[/g, '');
  return s.replace(/[ \t]{2,}/g, ' ').replace(/[ \t]+\n/g, '\n').trim();
}

export function formatAtLine(speaker: string, text: string): string {
  const name = String(speaker || '旁白').trim().replace(/[@\[\]]/g, '') || '旁白';
  const plain = stripAtMarkup(text).replace(/\]/g, '］');
  return `@${name}[${plain || '…'}]`;
}

function expandRangeOverTokens(
  full: string,
  start: number,
  end: number,
): { a: number; b: number } {
  const s = normalizeBrackets(full);
  let a = Math.max(0, Math.min(start, end));
  let b = Math.max(0, Math.max(start, end));
  const tokens = listAtTokenRanges(s);
  if (a === b) {
    const hit = tokens.find((t) => a >= t.start && a < t.end);
    if (hit) return { a: hit.start, b: hit.end };
  }
  let changed = true;
  let guard = 0;
  while (changed && guard++ < 16) {
    changed = false;
    for (const t of tokens) {
      if (t.start < b && t.end > a && (t.start < a || t.end > b)) {
        a = Math.min(a, t.start);
        b = Math.max(b, t.end);
        changed = true;
      }
    }
  }
  return { a, b };
}

/** 选中后 @：改派角色（已标记则替换，禁止套娃） */
export function wrapSelectionWithAt(params: {
  full: string;
  start: number;
  end: number;
  speaker: string;
}): { next: string; cursor: number } {
  const full = normalizeBrackets(params.full);
  const { a, b } = expandRangeOverTokens(full, params.start, params.end);
  const plain = stripAtMarkup(full.slice(a, b));
  if (!plain) return { next: full, cursor: b };
  const token = formatAtLine(params.speaker, plain);
  const next = full.slice(0, a) + token + full.slice(b);
  return { next, cursor: a + token.length };
}

/** 取消 @ 标记，还原纯文本 */
export function unwrapSelectionAt(params: {
  full: string;
  start: number;
  end: number;
}): { next: string; cursor: number } {
  const full = normalizeBrackets(params.full);
  const { a, b } = expandRangeOverTokens(full, params.start, params.end);
  const raw = full.slice(a, b);
  const plain = stripAtMarkup(raw);
  if (!plain || plain === raw) return { next: full, cursor: b };
  const next = full.slice(0, a) + plain + full.slice(b);
  return { next, cursor: a + plain.length };
}

export function normalizeAtScript(script: string): string {
  const s0 = normalizeBrackets(script);
  const tokens = listAtTokenRanges(s0);
  if (!tokens.length) return s0;
  let out = '';
  let last = 0;
  for (const t of tokens) {
    out += s0.slice(last, t.start) + formatAtLine(t.speaker, t.body);
    last = t.end;
  }
  return out + s0.slice(last);
}

export function parseAtTokens(
  script: string,
): { speaker: string; text: string }[] {
  return listAtTokenRanges(script)
    .map((t) => ({ speaker: t.speaker.trim(), text: stripAtMarkup(t.body) }))
    .filter((x) => x.speaker && x.text);
}

export function segmentAtHighlights(
  script: string,
  castNames?: string[],
): AtHighlightSeg[] {
  const s = normalizeBrackets(script);
  if (!s) return [{ kind: 'text', text: '' }];
  const known = new Set((castNames || []).map((n) => n.trim()).filter(Boolean));
  const segs: AtHighlightSeg[] = [];
  let last = 0;
  for (const t of listAtTokenRanges(s)) {
    if (t.start > last) segs.push({ kind: 'text', text: s.slice(last, t.start) });
    segs.push({
      kind: 'at',
      text: s.slice(t.start, t.end),
      speaker: t.speaker,
      known: !known.size || known.has(t.speaker),
    });
    last = t.end;
  }
  if (last < s.length) segs.push({ kind: 'text', text: s.slice(last) });
  return segs.length ? segs : [{ kind: 'text', text: s }];
}

function parseLegacyLine(raw: string): { speaker: string; text: string } | null {
  const line = String(raw || '').trim();
  if (!line) return null;
  if (line.startsWith('@') && line.includes('[')) return null;
  const m = line.match(LEGACY_LINE_RE);
  if (m) {
    const speaker = String(m[1] || m[2] || m[3] || '').trim();
    const text = String(m[4] || '').trim();
    if (speaker && text) return { speaker, text };
  }
  return { speaker: '', text: line };
}

export function parseDialogueScript(
  script: string,
): { speaker: string; text: string }[] {
  const at = parseAtTokens(script);
  if (at.length) return at;
  return String(script || '')
    .split(/\r?\n/)
    .map((l) => parseLegacyLine(l))
    .filter((x): x is { speaker: string; text: string } => Boolean(x && x.text));
}

export function resolveDialogueLines(params: {
  script: string;
  cast: TtsCastMember[];
  model: string;
  defaultVoice?: string;
}): TtsDialogueLine[] {
  const fallback = params.defaultVoice?.trim() || defaultSpeechVoice(params.model);
  const map = new Map<string, string>();
  for (const c of params.cast || []) {
    const n = String(c.name || '').trim();
    if (!n) continue;
    const v = String(c.voice || fallback).trim() || fallback;
    map.set(n, v);
    map.set(n.toLowerCase(), v);
  }
  const lines = parseDialogueScript(params.script).map((p) => {
    const key = p.speaker.trim();
    const voice = (key && (map.get(key) || map.get(key.toLowerCase()))) || fallback;
    return { speaker: key || '旁白', text: p.text, voice };
  });
  log.info('resolveDialogueLines', 'parsed', {
    count: lines.length,
    speakers: [...new Set(lines.map((l) => l.speaker))],
    style: parseAtTokens(params.script).length ? 'at' : 'legacy',
  });
  return lines;
}

export function defaultCast(model: string): TtsCastMember[] {
  const pool = listSpeechVoices(model).map((v) => v.value);
  const d = defaultSpeechVoice(model);
  return [
    { name: '旁白', voice: d },
    { name: '角色A', voice: pool[1] || d },
    { name: '角色B', voice: pool[2] || pool[0] || d },
  ];
}

export function syncCastFromScript(
  script: string,
  cast: TtsCastMember[],
  model: string,
): TtsCastMember[] {
  const pool = listSpeechVoices(model).map((v) => v.value);
  const existing = new Map(
    (cast || []).filter((c) => c.name?.trim()).map((c) => [c.name.trim(), c.voice] as const),
  );
  const names: string[] = [];
  for (const p of parseDialogueScript(script)) {
    const n = p.speaker.trim();
    if (n && !names.includes(n)) names.push(n);
  }
  if (!names.length) return cast?.length ? cast : defaultCast(model);
  return names.map((name, i) => ({
    name,
    voice: existing.get(name) || pool[i % Math.max(pool.length, 1)] || defaultSpeechVoice(model),
  }));
}

export function sampleAdvancedScript(): string {
  return [
    formatAtLine('旁白', '夜色渐深，咖啡馆只剩最后一桌客人。'),
    formatAtLine('角色A', '你真的要走了吗？'),
    formatAtLine('角色B', '嗯。天亮之前，我得把这件事说清楚。'),
    formatAtLine('角色A', '……那就再说一遍你的名字吧。'),
    formatAtLine('角色B', '我叫阿宁。记住就好。'),
  ].join('\n');
}
