'use client';

import type { CopilotSession } from '../../lib/copilotSessionStore';

function formatTime(ts: number): string {
  try {
    return new Date(ts).toLocaleString('zh-CN', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export function CopilotSessionList({
  sessions,
  activeId,
  query,
  onQuery,
  onSelect,
  onDelete,
}: {
  sessions: CopilotSession[];
  activeId: string | null;
  query: string;
  onQuery: (q: string) => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const q = query.trim().toLowerCase();
  const filtered = q
    ? sessions.filter((s) => s.title.toLowerCase().includes(q) || s.model.toLowerCase().includes(q))
    : sessions;

  return (
    <div className="w-60 border-l border-border/50 flex flex-col shrink-0">
      <div className="p-3 border-b border-border/50">
        <div className="relative">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none"><path d="m21 21-4.34-4.34" /><circle cx="11" cy="11" r="8" /></svg>
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="搜索会话..."
            className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm pl-8 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {filtered.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            {sessions.length === 0 ? '暂无会话，发送消息或点 + 新建' : '无匹配会话'}
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {filtered.map((s) => {
              const active = s.id === activeId;
              return (
                <li key={s.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => onSelect(s.id)}
                    className={`w-full rounded-md px-2.5 py-2 text-left transition-colors ${
                      active ? 'bg-muted text-foreground' : 'hover:bg-muted/60 text-foreground'
                    }`}
                  >
                    <p className="text-xs font-medium truncate pr-5">{s.title || '新对话'}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground truncate">
                      {formatTime(s.updatedAt)} · {s.messages.length} 条
                    </p>
                  </button>
                  <button
                    type="button"
                    title="删除会话"
                    aria-label="删除会话"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(s.id);
                    }}
                    className="absolute right-1.5 top-1.5 hidden group-hover:flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-background/80 text-xs"
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
