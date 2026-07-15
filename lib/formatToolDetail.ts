// tool 结果摘要（时间线展示用）

export function formatToolDetail(name: string, result: unknown): string {
  if (typeof result !== 'object' || !result) return '';
  const r = result as Record<string, unknown>;
  if (name === 'create_nodes' || name === 'create_or_update_nodes') {
    const created = Array.isArray(r.created) ? r.created : [];
    return created.map((c: unknown) => {
      const m = c as Record<string, string>;
      return m.menu_type || m.id || '';
    }).filter(Boolean).join(', ');
  }
  if (name === 'build_workflow') {
    return String(r.pipeline || r.title || '');
  }
  if (name === 'connect_nodes') {
    return '已连线';
  }
  if (name === 'delete_nodes') {
    return `移除 ${r.removed ?? ''} 个`;
  }
  if (name === 'layout_nodes') {
    return `排布 ${r.moved ?? ''} 个`;
  }
  if (name === 'ask_user') {
    if (r.cancelled) return '已取消';
    return String(r.selected_label || r.selected_id || '已选择');
  }
  if (name === 'get_node') {
    const n = typeof r.count === 'number' ? r.count : Array.isArray(r.nodes) ? r.nodes.length : 0;
    return `读取 ${n} 个节点`;
  }
  if (name === 'update_node') {
    return r.updated ? `已更新 ${r.id || ''}` : String(r.error || '更新失败');
  }
  if (name === 'update_nodes') {
    const u = Array.isArray(r.updated) ? r.updated.length : 0;
    return `更新 ${u} 个`;
  }
  if (name === 'submit_nodes') {
    const s = Array.isArray(r.submitted) ? r.submitted.length : 0;
    const q = Array.isArray(r.queued_autoGenerate) ? r.queued_autoGenerate.length : 0;
    return `提交 ${s}` + (q ? ` · 排队 ${q}` : '');
  }
  if (name === 'list_node_fields') {
    const n = Array.isArray(r.types) ? r.types.length : 0;
    return `${n} 种节点字段`;
  }
  if (name === 'summarize_context') {
    return String(r.summary || r.note || '已压缩上下文');
  }
  return String((r as Record<string, unknown>).pipeline || '');
}
