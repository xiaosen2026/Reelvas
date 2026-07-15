'use client';

// 文本节点结果区：Markdown 展示 / 双击编辑 / 美化滚动

import { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type Props = {
  text: string;
  loading?: boolean;
  editing: boolean;
  /** 供顶部格式栏读取/恢复选区 */
  editorRef?: React.RefObject<HTMLTextAreaElement | null>;
  onStartEdit: () => void;
  onChange: (value: string) => void;
  onEndEdit: () => void;
};

const mdComponents = {
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="text-base font-semibold text-foreground mt-2 mb-1 first:mt-0">{children}</h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="text-sm font-semibold text-foreground mt-2 mb-1 first:mt-0">{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="text-sm font-medium text-foreground mt-1.5 mb-0.5 first:mt-0">{children}</h3>
  ),
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="text-sm text-foreground leading-relaxed my-1.5 first:mt-0 last:mb-0">{children}</p>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="text-sm text-foreground list-disc pl-5 my-1.5 space-y-0.5">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="text-sm text-foreground list-decimal pl-5 my-1.5 space-y-0.5">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="leading-relaxed">{children}</li>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }: { children?: React.ReactNode }) => (
    <em className="italic text-foreground/90">{children}</em>
  ),
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline underline-offset-2 hover:opacity-80"
    >
      {children}
    </a>
  ),
  code: ({ className, children }: { className?: string; children?: React.ReactNode }) => {
    const inline = !className;
    if (inline) {
      return (
        <code className="px-1 py-0.5 rounded-md bg-muted text-[12px] font-mono text-foreground">
          {children}
        </code>
      );
    }
    return (
      <code className={`block text-[12px] font-mono leading-relaxed text-foreground ${className || ''}`}>
        {children}
      </code>
    );
  },
  pre: ({ children }: { children?: React.ReactNode }) => (
    <pre className="my-2 p-2.5 rounded-lg bg-muted/60 border border-border/40 overflow-x-auto text-[12px]">
      {children}
    </pre>
  ),
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="my-1.5 pl-3 border-l-2 border-border text-muted-foreground text-sm">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-2 border-border/60" />,
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full text-xs border-collapse">{children}</table>
    </div>
  ),
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="border border-border/50 bg-muted/40 px-2 py-1 text-left font-medium">{children}</th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td className="border border-border/40 px-2 py-1 align-top">{children}</td>
  ),
};

export function TextResultView({
  text,
  loading,
  editing,
  editorRef,
  onStartEdit,
  onChange,
  onEndEdit,
}: Props) {
  const localRef = useRef<HTMLTextAreaElement>(null);
  const setTaRef = (el: HTMLTextAreaElement | null) => {
    localRef.current = el;
    if (editorRef) {
      (editorRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
    }
  };

  useEffect(() => {
    if (!editing) return;
    const el = localRef.current;
    if (!el) return;
    el.focus();
    // 仅在进入编辑且尚无选区时落到末尾，避免覆盖格式栏恢复的选区
    if (el.selectionStart === el.selectionEnd && el.selectionStart === 0 && el.value) {
      const len = el.value.length;
      el.setSelectionRange(len, len);
    }
  }, [editing]);

  if (editing) {
    return (
      <textarea
        ref={setTaRef}
        value={text}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onEndEdit}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
        className="w-full h-full min-h-0 resize-none bg-transparent outline-none p-3 text-sm leading-relaxed text-foreground nodrag nowheel nice-scroll"
      />
    );
  }

  return (
    <div
      className="flex-1 min-h-0 h-full overflow-y-auto overflow-x-hidden nowheel nice-scroll p-3 cursor-text"
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (!loading) onStartEdit();
      }}
      title={loading ? undefined : '双击编辑结果'}
    >
      <div className="text-sm text-foreground wrap-anywhere">
        {/* 原生 <u> 无 rehype-raw 时不解析，拆段渲染下划线 */}
        {splitUnderline(text).map((seg, i) =>
          seg.u ? (
            <span key={i} className="underline underline-offset-2">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                {seg.value}
              </ReactMarkdown>
            </span>
          ) : (
            <ReactMarkdown key={i} remarkPlugins={[remarkGfm]} components={mdComponents}>
              {seg.value}
            </ReactMarkdown>
          ),
        )}
        {loading ? (
          <span className="inline-block w-1.5 h-3.5 ml-0.5 align-middle bg-primary/70 animate-pulse" />
        ) : null}
      </div>
    </div>
  );
}

function splitUnderline(src: string): { u: boolean; value: string }[] {
  const out: { u: boolean; value: string }[] = [];
  const re = /<u>([\s\S]*?)<\/u>/gi;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    if (m.index > last) out.push({ u: false, value: src.slice(last, m.index) });
    out.push({ u: true, value: m[1] });
    last = m.index + m[0].length;
  }
  if (last < src.length) out.push({ u: false, value: src.slice(last) });
  return out.length ? out : [{ u: false, value: src }];
}
