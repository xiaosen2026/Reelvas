/** 轮询 progress → 展示文案，如 42% / 0.42 → 42% */
export function formatJobProgress(raw: unknown): string {
  if (raw == null || raw === '') return '';
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const n = raw <= 1 && raw >= 0 ? Math.round(raw * 100) : Math.round(raw);
    return `${Math.min(100, Math.max(0, n))}%`;
  }
  const s = String(raw).trim();
  if (!s) return '';
  if (/%\s*$/.test(s)) return s;
  const num = parseFloat(s.replace(/[^\d.-]/g, ''));
  if (!Number.isFinite(num)) return s;
  if (num >= 0 && num <= 1 && !/^\d{1,3}$/.test(s)) {
    return `${Math.round(num * 100)}%`;
  }
  if (num >= 0 && num <= 100) return `${Math.round(num)}%`;
  return s;
}
