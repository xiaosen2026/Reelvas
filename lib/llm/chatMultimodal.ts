// OpenAI 多模态消息辅助（vision image_url）

import type { ChatMessage, ChatContentPart } from './openaiChat';

export type { ChatContentPart };

/** 统计消息体量（日志用，避免 dataURL 刷屏） */
export function summarizeMessages(messages: ChatMessage[]) {
  let images = 0;
  let textChars = 0;
  for (const m of messages) {
    if (typeof m.content === 'string') {
      textChars += m.content.length;
      continue;
    }
    if (!m.content) continue;
    for (const p of m.content) {
      if (p.type === 'text') textChars += p.text.length;
      else if (p.type === 'image_url') images += 1;
    }
  }
  return { images, textChars, msgCount: messages.length };
}

/** 把最后一条 user 消息升级为「文本 + 图片」多模态 */
export function attachImagesToUserMessage(
  messages: ChatMessage[],
  imageSrcs: string[],
): ChatMessage[] {
  const urls = imageSrcs.map((u) => u.trim()).filter(Boolean);
  if (!urls.length) return messages;
  const next = messages.map((m) =>
    typeof m.content === 'string' || !m.content
      ? m
      : { ...m, content: [...m.content] },
  );
  for (let i = next.length - 1; i >= 0; i--) {
    if (next[i].role !== 'user') continue;
    const raw = next[i].content;
    const text =
      typeof raw === 'string'
        ? raw
        : Array.isArray(raw)
          ? raw
              .filter((p) => p.type === 'text')
              .map((p) => (p as { text: string }).text)
              .join('\n')
          : '';
    next[i] = {
      role: 'user',
      content: [
        { type: 'text', text: text || '请结合附图作答。' },
        ...urls.map((url) => ({ type: 'image_url' as const, image_url: { url } })),
      ],
    };
    break;
  }
  return next;
}
