// Copilot 会话持久化 —— localStorage
// 列表 / 读写 / 新建 / 删除；标题取首条用户消息

import type { CopilotMsg } from '../components/editor/useCopilotChat';
import { createLogger } from './logger';

const log = createLogger('copilotSessionStore');
const KEY = 'reelvas_copilot_sessions';
const ACTIVE_KEY = 'reelvas_copilot_active_session';
const MAX = 50;

export interface CopilotSession {
  id: string;
  title: string;
  model: string;
  messages: CopilotMsg[];
  createdAt: number;
  updatedAt: number;
}

function uid(): string {
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function readAll(): CopilotSession[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CopilotSession[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    log.warn('readAll', 'parse failed', { err: String(err) });
    return [];
  }
}

function writeAll(list: CopilotSession[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch (err) {
    log.error('writeAll', 'failed', { err: String(err) });
  }
}

export function listSessions(): CopilotSession[] {
  return readAll().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getSession(id: string): CopilotSession | null {
  return readAll().find((s) => s.id === id) ?? null;
}

export function getActiveSessionId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACTIVE_KEY);
}

export function setActiveSessionId(id: string | null): void {
  if (typeof window === 'undefined') return;
  if (id) localStorage.setItem(ACTIVE_KEY, id);
  else localStorage.removeItem(ACTIVE_KEY);
}

export function titleFromMessages(messages: CopilotMsg[]): string {
  const first = messages.find((m) => m.role === 'user' && m.content.trim());
  if (!first) return '新对话';
  const t = first.content.trim().replace(/\s+/g, ' ');
  return t.length > 28 ? `${t.slice(0, 28)}…` : t;
}

export function createSession(model = 'grok-4.5'): CopilotSession {
  const now = Date.now();
  const s: CopilotSession = {
    id: uid(),
    title: '新对话',
    model,
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
  const list = readAll();
  list.unshift(s);
  writeAll(list);
  setActiveSessionId(s.id);
  log.info('createSession', 'created', { id: s.id });
  return s;
}

/** 有消息则 upsert；空消息的「新对话」仅更新时间戳/模型，不删 */
export function saveSession(
  id: string,
  patch: { messages: CopilotMsg[]; model?: string; title?: string },
): CopilotSession | null {
  const list = readAll();
  const idx = list.findIndex((s) => s.id === id);
  if (idx < 0) {
    log.warn('saveSession', 'missing', { id });
    return null;
  }
  const prev = list[idx];
  const messages = patch.messages;
  const title =
    patch.title ??
    (messages.some((m) => m.role === 'user' && m.content.trim())
      ? titleFromMessages(messages)
      : prev.title || '新对话');
  const next: CopilotSession = {
    ...prev,
    messages,
    model: patch.model ?? prev.model,
    title,
    updatedAt: Date.now(),
  };
  list[idx] = next;
  // 有内容的会话排前面
  list.sort((a, b) => b.updatedAt - a.updatedAt);
  writeAll(list);
  log.debug('saveSession', 'saved', { id, msgCount: messages.length, title });
  return next;
}

export function removeSession(id: string): void {
  writeAll(readAll().filter((s) => s.id !== id));
  if (getActiveSessionId() === id) setActiveSessionId(null);
  log.info('removeSession', 'removed', { id });
}

/** 确保有当前会话：无则新建 */
export function ensureActiveSession(model = 'grok-4.5'): CopilotSession {
  const aid = getActiveSessionId();
  if (aid) {
    const s = getSession(aid);
    if (s) return s;
  }
  const list = listSessions();
  if (list[0]) {
    setActiveSessionId(list[0].id);
    return list[0];
  }
  return createSession(model);
}
