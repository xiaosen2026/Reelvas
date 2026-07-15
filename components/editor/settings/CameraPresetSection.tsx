'use client';

// 节点管理 · 图片节点：机身 / 镜头 / 胶片 增删改

import { useCallback, useEffect, useState } from 'react';
import type { CameraOption } from '../nodes/cameraPresets';
import {
  cameraKindLabel,
  getCameraLists,
  removeCameraOption,
  resetCameraLists,
  subscribeCameraPresets,
  upsertCameraOption,
  type CameraListKind,
  type CameraLists,
} from '../../../lib/cameraPresetStore';
import { createLogger } from '../../../lib/logger';

const log = createLogger('CameraPresetSection');

const KINDS: CameraListKind[] = ['body', 'lens', 'film'];

type EditState = {
  kind: CameraListKind;
  mode: 'add' | 'edit';
  prevId?: string;
  form: CameraOption;
};

const blank = (): CameraOption => ({ id: '', label: '', prompt: '', desc: '' });

export function CameraPresetSection() {
  const [lists, setLists] = useState<CameraLists>(() => getCameraLists());
  const [tab, setTab] = useState<CameraListKind>('body');
  const [edit, setEdit] = useState<EditState | null>(null);
  const [hint, setHint] = useState('');

  useEffect(() => {
    setLists(getCameraLists());
    return subscribeCameraPresets(setLists);
  }, []);

  const flash = useCallback((msg: string) => {
    setHint(msg);
    window.setTimeout(() => setHint(''), 1200);
  }, []);

  const openAdd = () => {
    setEdit({ kind: tab, mode: 'add', form: blank() });
  };

  const openEdit = (kind: CameraListKind, opt: CameraOption) => {
    if (opt.id === 'none') return;
    setEdit({ kind, mode: 'edit', prevId: opt.id, form: { ...opt, desc: opt.desc || '' } });
  };

  const onSave = () => {
    if (!edit) return;
    const id = edit.form.id.trim();
    const label = edit.form.label.trim();
    if (!id || !label) return;
    if (id === 'none') return;
    upsertCameraOption(edit.kind, { ...edit.form, id, label }, edit.prevId);
    log.info('onSave', edit.mode, { kind: edit.kind, id });
    setEdit(null);
    flash('已保存');
  };

  const onDelete = (kind: CameraListKind, id: string) => {
    if (id === 'none') return;
    removeCameraOption(kind, id);
    flash('已删除');
  };

  const onReset = () => {
    resetCameraLists();
    flash('已恢复默认');
  };

  const rows = lists[tab].filter((o) => o.id !== 'none');

  return (
    <div className="rounded-2xl border border-border/50 bg-white p-6">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-sm font-semibold text-foreground">摄影机参数</p>
          <p className="text-xs text-muted-foreground mt-1">
            机身 / 镜头 / 胶片：图片节点滚轮选项，提交时追加到提示词尾巴
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {hint ? <span className="text-[11px] text-emerald-600">{hint}</span> : null}
          <button
            type="button"
            onClick={onReset}
            className="h-8 px-2.5 rounded-lg border border-border text-xs text-muted-foreground hover:bg-muted/30 transition-colors"
          >
            恢复默认
          </button>
          <button
            type="button"
            onClick={openAdd}
            className="h-8 px-3 rounded-lg border border-border bg-background text-xs text-foreground hover:bg-muted/30 transition-colors"
          >
            添加
          </button>
        </div>
      </div>

      <div className="flex gap-1 mb-3">
        {KINDS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`h-8 px-3 rounded-lg text-xs transition-colors ${
              tab === k
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:bg-muted/30'
            }`}
          >
            {cameraKindLabel(k)}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border/40 divide-y divide-border/40">
        {rows.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">暂无自定义项，点添加</p>
        ) : (
          rows.map((o) => (
            <div key={o.id} className="flex items-center gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-foreground truncate">{o.label}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {o.prompt || o.id}
                  {o.desc ? ` · ${o.desc}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => openEdit(tab, o)}
                className="h-7 px-2 rounded-md text-[11px] text-muted-foreground hover:bg-muted/40 transition-colors"
              >
                编辑
              </button>
              <button
                type="button"
                onClick={() => onDelete(tab, o.id)}
                className="h-7 px-2 rounded-md text-[11px] text-red-500 hover:bg-red-50 transition-colors"
              >
                删除
              </button>
            </div>
          ))
        )}
      </div>

      {edit ? (
        <div
          className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/30"
          onClick={() => setEdit(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white border border-border/50 shadow-sm overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3.5 border-b border-border/40">
              <p className="text-sm font-semibold text-foreground">
                {edit.mode === 'add' ? '添加' : '编辑'}
                {cameraKindLabel(edit.kind)}
              </p>
            </div>
            <div className="p-5 space-y-3">
              <Field
                label="ID"
                value={edit.form.id}
                placeholder="英文 id，如 arri-alexa-35"
                onChange={(v) => setEdit({ ...edit, form: { ...edit.form, id: v } })}
              />
              <Field
                label="显示名称"
                value={edit.form.label}
                placeholder="ARRI Alexa 35"
                onChange={(v) => setEdit({ ...edit, form: { ...edit.form, label: v } })}
              />
              <Field
                label="提示词片段"
                value={edit.form.prompt}
                placeholder="shot on ARRI Alexa 35 cinema camera"
                onChange={(v) => setEdit({ ...edit, form: { ...edit.form, prompt: v } })}
                multiline
              />
              <Field
                label="备注（可选）"
                value={edit.form.desc || ''}
                placeholder="电影感、宽动态"
                onChange={(v) => setEdit({ ...edit, form: { ...edit.form, desc: v } })}
              />
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-border/40">
              <button
                type="button"
                onClick={() => setEdit(null)}
                className="h-9 px-3 rounded-lg border border-border text-xs text-muted-foreground hover:bg-muted/30 transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={onSave}
                disabled={!edit.form.id.trim() || !edit.form.label.trim()}
                className="h-9 px-4 rounded-lg bg-foreground text-background text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-foreground mb-1.5">{label}</label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 resize-none"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
        />
      )}
    </div>
  );
}
