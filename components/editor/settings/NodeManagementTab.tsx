'use client';

import { useMemo, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { RECIPES } from '../../../lib/settingsData';
import type { RecipeItem } from '../../../lib/settingsData';
import { NODE_NAME_TO_ENHANCE_KIND } from '../../../lib/enhancePromptStore';
import { EnhancePromptSection } from './EnhancePromptSection';
import { CameraPresetSection } from './CameraPresetSection';

type NodeCategory = '普通节点' | '高级节点';

interface NodeDef {
  name: string;
  category: NodeCategory;
  desc: string;
  enabled: boolean;
  port: string;
}

const nodes: NodeDef[] = [
  { name: '文本节点', category: '普通节点', desc: '文本生成、文本改写、提示词整理与结构化输出。', enabled: true, port: 'textGeneration' },
  { name: '视频节点', category: '普通节点', desc: '文生视频、图生视频、首尾帧生成与视频增强。', enabled: true, port: 'videoGeneration' },
  { name: '图片节点', category: '普通节点', desc: '文生图、图像编辑、参考图生成和素材出图。', enabled: true, port: 'imageGeneration' },
  { name: '画板节点', category: '普通节点', desc: '承载视觉素材与画布排版的基础节点。', enabled: true, port: 'canvasBoard' },
  { name: '音频节点', category: '普通节点', desc: 'Suno 等音乐/歌曲生成（与 TTS 分离）。', enabled: true, port: 'audioGeneration' },
  { name: 'TTS节点', category: '普通节点', desc: 'OpenAI 兼容语音合成 /v1/audio/speech。', enabled: true, port: 'ttsGeneration' },
  { name: '便利贴节点', category: '普通节点', desc: '用于记录提示、备注、TODO 与上下文信息。', enabled: true, port: 'stickyNote' },
  { name: '创建脚本', category: '普通节点', desc: '一键生成四栏故事板提示词（创意大纲+分镜合并）。', enabled: true, port: 'script' },
  { name: '表格节点', category: '普通节点', desc: '表格化管理角色、镜头、素材清单与参数矩阵。', enabled: true, port: 'table' },
  { name: '3D导演台', category: '普通节点', desc: '三维空间镜头调度、虚拟机位和角色站位控制。', enabled: true, port: 'director3d' },
  { name: '全景节点', category: '普通节点', desc: '全景图、空间参考、环境设定和场景视图生成。', enabled: true, port: 'panorama' },
  { name: '增强节点', category: '普通节点', desc: '图像放大增强：网络 API 放大与本地模型放大双模式。', enabled: true, port: 'imageUpscale' },
  { name: '扩图节点', category: '普通节点', desc: '绿幕扩图画布 + 图生图填充边缘，向外延展场景。', enabled: true, port: 'imageOutpaint' },
  { name: '分镜格子', category: '普通节点', desc: '多格拼接图片：连线入图、邻格交换、合成发送一张图。', enabled: true, port: 'storyboard' },
  { name: '上传节点', category: '普通节点', desc: '上传本地图片、视频、音频和其他工程素材。', enabled: true, port: 'upload' },
  { name: 'comfyui', category: '高级节点', desc: '接入 ComfyUI 工作流，支持自定义图像/视频 pipeline。', enabled: true, port: 'comfyui' },
  { name: 'http请求节点', category: '高级节点', desc: '发送 HTTP 请求，接入外部 API、Webhook 与内部服务。', enabled: false, port: 'httpRequest' },
];

const INode = () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M10 6.5h4"/><path d="M6.5 10v4"/><path d="M17.5 10v4"/></svg>;
const IAdvanced = () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"/><path d="M2 12h20"/><path d="m17 7-5-5-5 5"/><path d="m17 17-5 5-5-5"/></svg>;
const IPlus = () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5v14"/></svg>;
const IEdit = () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>;
const ITrash = () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>;
const IRecipe = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5Z"/></svg>;
const IX = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>;

const blankRecipe = (type: string): RecipeItem => ({
  id: '',
  version: '',
  type,
  title: '',
  operationTypes: [],
  systemPrompt: '',
  requiredElements: [],
  plannerHint: '',
});

// Recipe type → 节点名称反向映射
const TYPE_TO_NODE: Record<string, string> = {
  '文本': '文本节点',
  '图片': '图片节点',
  '视频': '视频节点',
};
const NODE_TO_TYPE: Record<string, string> = Object.fromEntries(Object.entries(TYPE_TO_NODE).map(([k, v]) => [v, k]));

export function NodeManagementTab() {
  const [active, setActive] = useState(nodes[0].name);
  // 节点启用状态（可切换）
  const [nodeEnabled, setNodeEnabled] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    nodes.forEach((n) => { map[n.name] = n.enabled; });
    return map;
  });
  const selected = useMemo(() => nodes.find((n) => n.name === active) ?? nodes[0], [active]);
  const normal = nodes.filter((n) => n.category === '普通节点');
  const advanced = nodes.filter((n) => n.category === '高级节点');

  // 每个节点的 recipe 列表（使用 state 支持增删改）
  const [recipes, setRecipes] = useState<RecipeItem[]>(() => [...RECIPES]);
  // 每条 recipe 启用状态
  const [recipeEnabled, setRecipeEnabled] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    RECIPES.forEach((r) => { map[r.id] = true; });
    return map;
  });

  const nodeType = NODE_TO_TYPE[active];
  const enhanceKind = NODE_NAME_TO_ENHANCE_KIND[active];
  const assignedRecipes = useMemo(() => recipes.filter((r) => TYPE_TO_NODE[r.type] === active), [recipes, active]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<RecipeItem | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const startAdd = useCallback(() => {
    if (!nodeType) return;
    setShowAdd(true);
    setEditForm(blankRecipe(nodeType));
  }, [nodeType]);

  const startEdit = useCallback((r: RecipeItem) => {
    setEditingId(r.id);
    setEditForm({ ...r });
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setShowAdd(false);
    setEditForm(null);
  }, []);

  const saveRecipe = useCallback(() => {
    if (!editForm) return;
    if (showAdd) {
      const newRecipe = { ...editForm, id: editForm.id || `${editForm.type}-custom-${Date.now()}` };
      if (!editForm.id) return;
      setRecipes((prev) => [...prev, newRecipe]);
    } else if (editingId) {
      setRecipes((prev) => prev.map((r) => (r.id === editingId ? editForm : r)));
    }
    cancelEdit();
  }, [editForm, showAdd, editingId, cancelEdit]);

  const deleteRecipe = useCallback((id: string) => {
    setRecipes((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const updateEditField = useCallback((field: keyof RecipeItem, value: unknown) => {
    setEditForm((prev) => (prev ? { ...prev, [field]: value } : null));
  }, []);

  const toggleNode = useCallback((name: string) => {
    setNodeEnabled((prev) => ({ ...prev, [name]: !prev[name] }));
  }, []);

  const toggleRecipe = useCallback((id: string) => {
    setRecipeEnabled((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  return (
    <div className="grid grid-cols-[240px_minmax(0,1fr)] gap-6 min-h-full">
      <div className="rounded-2xl border border-border/50 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-border/40">
          <p className="text-sm font-semibold text-foreground">节点管理</p>
          <p className="text-xs text-muted-foreground mt-1">按节点类型管理功能与默认配置</p>
        </div>
        <NodeGroup title="普通节点" items={normal} active={active} onSelect={setActive} enabled={nodeEnabled} onToggle={toggleNode} icon={<INode />} />
        <NodeGroup title="高级节点" items={advanced} active={active} onSelect={setActive} enabled={nodeEnabled} onToggle={toggleNode} icon={<IAdvanced />} />
      </div>

      <div className="space-y-6">
        <div className="rounded-2xl border border-border/50 bg-white p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <span className="size-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><INode /></span>
              <div>
                <p className="text-xl font-bold text-foreground">{selected.name}</p>
                <p className="text-sm text-muted-foreground mt-1">{selected.desc}</p>
              </div>
            </div>
            <button onClick={() => toggleNode(selected.name)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${nodeEnabled[selected.name] ? 'bg-emerald-500' : 'bg-muted'}`}>
              <span className={`block h-5 w-5 rounded-full bg-white shadow transition-transform ${nodeEnabled[selected.name] ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-border/50 bg-white p-6">
          <p className="text-sm font-semibold text-foreground mb-4">节点默认配置</p>
          <div className="grid grid-cols-2 gap-4">
            <Field label="节点类型" value={selected.name} />
            <Field label="节点分组" value={selected.category} />
            <Field label="端口标识" value={selected.port} mono />
            <Field label="默认状态" value={nodeEnabled[selected.name] ? '启用' : '关闭'} />
          </div>
        </div>
{enhanceKind ? <EnhancePromptSection key={enhanceKind} kind={enhanceKind} /> : null}
        {active === '图片节点' ? <CameraPresetSection /> : null}

        <div className="rounded-2xl border border-border/50 bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-blue-500"><IRecipe /></span>
              <div>
                <p className="text-sm font-semibold text-foreground">提示词策略 (Recipes)</p>
                <p className="text-xs text-muted-foreground mt-1">控制生成节点的提示词策略</p>
              </div>
            </div>
            {nodeType && (
              <button onClick={startAdd} className="h-8 px-3 rounded-lg border border-border bg-background text-xs text-foreground flex items-center gap-1.5 hover:bg-muted/30 transition-colors"><IPlus />添加策略</button>
            )}
          </div>

          {/* 添加/编辑弹窗 */}
          {editForm && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm" onClick={cancelEdit}>
              <div className="w-full max-w-lg rounded-2xl bg-white border border-border/60 shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-border/40">
                  <p className="text-base font-semibold text-foreground">{showAdd ? `新增策略 (${nodeType})` : '编辑策略'}</p>
                  <button onClick={cancelEdit} className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"><IX /></button>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5">策略 ID</label>
                    <input value={editForm.id} onChange={(e) => updateEditField('id', e.target.value)} placeholder="英文字母+短划线" className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5">标题</label>
                    <input value={editForm.title} onChange={(e) => updateEditField('title', e.target.value)} placeholder="策略标题" className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5">规划器提示 (plannerHint)</label>
                    <textarea value={editForm.plannerHint} onChange={(e) => updateEditField('plannerHint', e.target.value)} placeholder="规划器提示" rows={2} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 resize-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5">系统提示词 (systemPrompt)</label>
                    <textarea value={editForm.systemPrompt} onChange={(e) => updateEditField('systemPrompt', e.target.value)} placeholder="系统提示词" rows={4} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 resize-none" />
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border/40">
                  <button onClick={cancelEdit} className="h-10 px-4 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted/30 transition-colors">取消</button>
                  <button onClick={saveRecipe} disabled={!editForm.id.trim() || !editForm.title.trim()} className="h-10 px-6 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">保存</button>
                </div>
              </div>
            </div>
          )}

          {assignedRecipes.length === 0 && !editForm && (
            <div className="rounded-xl border border-dashed border-border/50 py-8 text-center">
              <p className="text-sm text-muted-foreground">暂无分配到此节点的策略</p>
              <p className="text-xs text-muted-foreground mt-1">点击"添加策略"创建新策略</p>
            </div>
          )}

          <div className="space-y-2 mt-2">
            {assignedRecipes.map((r) => (
              editingId === r.id ? null : (
                <div key={r.id} className="rounded-xl border border-border/40 bg-muted/10 px-4 py-3 flex items-start gap-4">
                  <div className="shrink-0 mt-0.5">
                    <span className={`inline-flex items-center rounded-full border text-[10px] px-1.5 py-0 font-medium ${r.type === '文本' ? 'bg-amber-50 text-amber-600 border-amber-200' : r.type === '图片' ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-purple-50 text-purple-600 border-purple-200'}`}>{r.type}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{r.title}</p>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.plannerHint}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[10px] text-muted-foreground font-mono">{r.id}</span>
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-1">
                    <button onClick={() => toggleRecipe(r.id)} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${recipeEnabled[r.id] ? 'bg-emerald-500' : 'bg-muted'}`}>
                      <span className={`block h-4 w-4 rounded-full bg-white shadow transition-transform ${recipeEnabled[r.id] ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                    </button>
                    <button onClick={() => startEdit(r)} className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"><IEdit /></button>
                    <button onClick={() => deleteRecipe(r.id)} className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors"><ITrash /></button>
                  </div>
                </div>
              )
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function NodeGroup({ title, items, active, onSelect, enabled, onToggle, icon }: { title: string; items: NodeDef[]; active: string; onSelect: (name: string) => void; enabled: Record<string, boolean>; onToggle: (name: string) => void; icon: ReactNode }) {
  return (
    <div className="p-3 border-b border-border/40 last:border-b-0">
      <div className="flex items-center gap-2 px-2 py-2 text-xs font-medium text-muted-foreground">{icon}{title}</div>
      <div className="space-y-1">
        {items.map((n) => (
          <button key={n.name} onClick={() => onSelect(n.name)} className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-sm transition-colors ${active === n.name ? 'bg-emerald-50 text-emerald-700 font-medium' : 'text-muted-foreground hover:bg-muted/30 hover:text-foreground'}`}>
            <span>{n.name}</span>
            <span onClick={(e) => { e.stopPropagation(); onToggle(n.name); }} className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors cursor-pointer ${enabled[n.name] ? 'bg-emerald-500' : 'bg-muted'}`}>
              <span className={`block h-3 w-3 rounded-full bg-white shadow transition-transform ${enabled[n.name] ? 'translate-x-[18px]' : 'translate-x-0'}`} />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1.5">{label}</p>
      <div className={`h-10 rounded-xl border border-border bg-background px-3 flex items-center text-sm text-foreground ${mono ? 'font-mono' : ''}`}>{value}</div>
    </div>
  );
}

function RecipeForm({ form, nodeType, onChange, onSave, onCancel }: { form: RecipeItem; nodeType: string; onChange: (f: keyof RecipeItem, v: unknown) => void; onSave: () => void; onCancel: () => void }) {
  return (
    <div className="rounded-xl border border-primary/30 bg-muted/5 p-4 mb-3 space-y-3">
      <p className="text-xs font-medium text-primary">新增策略 ({nodeType})</p>
      <input
        value={form.id}
        onChange={(e) => onChange('id', e.target.value)}
        placeholder="策略 ID（英文字母+短划线）"
        className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
      />
      <input
        value={form.title}
        onChange={(e) => onChange('title', e.target.value)}
        placeholder="策略标题"
        className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
      />
      <textarea
        value={form.plannerHint}
        onChange={(e) => onChange('plannerHint', e.target.value)}
        placeholder="plannerHint — 规划器提示"
        rows={2}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 resize-none"
      />
      <textarea
        value={form.systemPrompt}
        onChange={(e) => onChange('systemPrompt', e.target.value)}
        placeholder="systemPrompt — 系统提示词"
        rows={3}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 resize-none"
      />
      <div className="flex items-center gap-2 justify-end">
        <button onClick={onCancel} className="h-8 px-3 rounded-lg border border-border text-xs text-muted-foreground hover:bg-muted/30 transition-colors">取消</button>
        <button onClick={onSave} disabled={!form.id.trim() || !form.title.trim()} className="h-8 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">保存</button>
      </div>
    </div>
  );
}
