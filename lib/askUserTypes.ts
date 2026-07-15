// ask_user 弹窗请求/回答

export type AskUserOption = { id: string; label: string };

export type AskUserRequest = {
  question: string;
  options: AskUserOption[];
  allowFreeText?: boolean;
};

export type AskUserAnswer = {
  selected_id: string;
  selected_label: string;
  free_text?: string;
  cancelled?: boolean;
};

export function parseAskUserArgs(argsRaw: string): AskUserRequest {
  let args: Record<string, unknown> = {};
  try {
    args = argsRaw.trim() ? (JSON.parse(argsRaw) as Record<string, unknown>) : {};
  } catch {
    args = {};
  }
  const question = String(args.question || '请选择下一步').trim() || '请选择下一步';
  const rawOpts = Array.isArray(args.options) ? args.options : [];
  const options: AskUserOption[] = rawOpts
    .map((o, i) => {
      const rec = (o && typeof o === 'object' ? o : {}) as Record<string, unknown>;
      const id = String(rec.id || `opt_${i + 1}`).trim() || `opt_${i + 1}`;
      const label = String(rec.label || rec.id || `选项 ${i + 1}`).trim() || `选项 ${i + 1}`;
      return { id, label };
    })
    .filter((o) => o.id && o.label)
    .slice(0, 6);
  return {
    question,
    options:
      options.length >= 2
        ? options
        : [
            { id: 'continue', label: '继续' },
            { id: 'cancel', label: '取消' },
          ],
    allowFreeText: Boolean(args.allow_free_text),
  };
}
