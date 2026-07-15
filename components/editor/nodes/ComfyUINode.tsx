'use client';

// ComfyUI 节点 — 选择已保存的工作流 → 填写变量 → 提交到 ComfyUI → 输出

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Workflow } from 'lucide-react';
import { Handle, Position, useFlow } from '../flow';
import { ComfyUINodePanel } from './ComfyUINodePanel';
import { listComfyWorkflows, type ComfyWorkflowItem } from '@/lib/comfyWorkflowStore';
import { getComfyServerUrl } from '@/lib/settingsStore';

interface NodeProps {
  id: string;
  data: Record<string, any>;
  selected?: boolean;
}

/** 提取 {{变量名}}（兼容旧 $xxx） */
function extractVars(jsonStr: string): string[] {
  const vars = new Set<string>();
  const brace = /\{\{\s*([^}]+?)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = brace.exec(jsonStr))) {
    const name = m[1].trim();
    if (name) vars.add(name);
  }
  // 兼容旧 $xxx
  const dollar = /\$([A-Za-z_]\w*)/g;
  while ((m = dollar.exec(jsonStr))) vars.add(m[1]);
  return [...vars];
}

/** 根据 workflow JSON 节点类型推断输出类型 */
function detectOutputType(jsonStr: string): 'image' | 'text' | 'video' | 'audio' | 'unknown' {
  if (!jsonStr) return 'unknown';
  try {
    const raw = JSON.parse(jsonStr) as Record<string, { class_type: string }>;
    const types = Object.values(raw).map((n) => n.class_type);
    if (types.some((t) => /SaveAudio|VHS_AudioOutput/i.test(t))) return 'audio';
    if (types.some((t) => /VHS_VideoCombine|SaveVideo/i.test(t))) return 'video';
    if (types.some((t) => /ShowText|TextOutputNode|CLIPTextEncode/i.test(t))) return 'text';
    if (types.some((t) => /SaveImage|PreviewImage|VAEDecode/i.test(t))) return 'image';
    return 'unknown';
  } catch { return 'unknown'; }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 替换 "{{变量}}" / {{变量}} / 旧 $var；数字布尔去掉引号 */
function fillVars(jsonStr: string, vars: Record<string, string>): string {
  let s = jsonStr;
  for (const [k, raw] of Object.entries(vars)) {
    if (raw === undefined) continue;
    const v = String(raw);
    const isBare = /^-?\d+(\.\d+)?$/.test(v) || v === 'true' || v === 'false' || v === 'null';
    const ek = escapeRegExp(k);
    const braceQuoted = new RegExp(`"\\{\\{\\s*${ek}\\s*\\}\\}"`, 'g');
    const braceBare = new RegExp(`\\{\\{\\s*${ek}\\s*\\}\\}`, 'g');
    const dollarQuoted = new RegExp(`"\\$${ek}"`, 'g');
    const dollarBare = new RegExp(`\\$${ek}(?=["\\s}\\],])`, 'g');
    if (isBare) {
      s = s.replace(braceQuoted, v).replace(braceBare, v).replace(dollarQuoted, v).replace(dollarBare, v);
    } else {
      const escaped = JSON.stringify(v);
      s = s.replace(braceQuoted, escaped).replace(braceBare, escaped).replace(dollarQuoted, escaped).replace(dollarBare, escaped);
    }
  }
  return s;
}

export function ComfyUINode({ id, data, selected }: NodeProps) {
  const rf = useFlow();
  const label = data.label || 'COMFY';
  const cardRef = useRef<HTMLDivElement>(null);

  const [workflows, setWorkflows] = useState<ComfyWorkflowItem[]>([]);
  const [selectedWfId, setSelectedWfId] = useState(data.selectedWfId || '');
  const serverUrl = useMemo(() => getComfyServerUrl(), []);
  const [varValues, setVarValues] = useState<Record<string, string>>(data.varValues || {});
  const [loading, setLoading] = useState(false);
  const [statusError, setStatusError] = useState('');
  const [resultPreview, setResultPreview] = useState('');

  const selectedWf = workflows.find((w) => w.id === selectedWfId);
  const workflowJson = selectedWf?.json || '';
  const discoveredVars = useMemo(() => extractVars(workflowJson), [workflowJson]);
  const outputType = useMemo(() => detectOutputType(workflowJson), [workflowJson]);

  // 加载列表
  const refresh = useCallback(() => {
    setWorkflows(listComfyWorkflows());
  }, []);

  useEffect(refresh, [refresh]);

  const persist = useCallback((patch: Record<string, unknown>) => {
    rf.setNodes((nds) =>
      nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)),
    );
  }, [rf, id]);

  const onStop = useCallback(() => {
    setLoading(false);
    setStatusError('已取消');
  }, []);

  const onSubmit = useCallback(async () => {
    if (!selectedWf) { setStatusError('请选择工作流'); return; }
    if (!serverUrl.trim()) { setStatusError('请填写 ComfyUI 服务地址'); return; }
    setLoading(true);
    setStatusError('');
    setResultPreview('');

    try {
      const filled = fillVars(workflowJson, varValues);
      const parsed = JSON.parse(filled);

      const res = await fetch(serverUrl.replace(/\/+$/, '') + '/prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: parsed }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`ComfyUI ${res.status}${txt ? ': ' + txt.slice(0, 200) : ''}`);
      }
      const body = await res.json();
      const promptId: string = body.prompt_id;

      const historyUrl = serverUrl.replace(/\/+$/, '') + '/history/' + promptId;
      let output: Record<string, any> | null = null;
      for (let i = 0; i < 300; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        const hRes = await fetch(historyUrl);
        if (!hRes.ok) continue;
        const h = await hRes.json();
        const entry = h[promptId];
        if (entry?.status?.completed) {
          output = entry.outputs || {};
          break;
        }
        if (entry?.status?.failed) throw new Error('ComfyUI 执行失败');
      }
      if (!output) throw new Error('ComfyUI 执行超时');

      const resultUrls: string[] = [];
      for (const nodeOut of Object.values(output) as any[]) {
        if (nodeOut.images) {
          for (const img of nodeOut.images) {
            resultUrls.push(serverUrl.replace(/\/+$/, '') + '/view?filename=' + encodeURIComponent(img.filename) + '&subfolder=' + encodeURIComponent(img.subfolder || '') + '&type=' + encodeURIComponent(img.type || 'output'));
          }
        }
        if (nodeOut.text) {
          resultUrls.push(...(Array.isArray(nodeOut.text) ? nodeOut.text.map(String) : [String(nodeOut.text)]));
        }
        if (nodeOut.gifs || nodeOut.video) {
          const list = nodeOut.gifs || nodeOut.video || [];
          for (const v of Array.isArray(list) ? list : [list]) {
            resultUrls.push(serverUrl.replace(/\/+$/, '') + '/view?filename=' + encodeURIComponent(v.filename || v) + '&type=output');
          }
        }
        if (nodeOut.audio) {
          const list = Array.isArray(nodeOut.audio) ? nodeOut.audio : [nodeOut.audio];
          for (const a of list) {
            resultUrls.push(serverUrl.replace(/\/+$/, '') + '/view?filename=' + encodeURIComponent(a.filename || a) + '&type=output');
          }
        }
      }

      const resultStr = resultUrls.join('\n');
      setResultPreview(resultStr);
      persist({
        selectedWfId,
        varValues,
        outputType,
        value: resultStr,
        resultUrls,
      });
    } catch (e: any) {
      setStatusError(e.message || String(e));
      persist({ selectedWfId, varValues, outputType, value: '', resultUrls: [] });
    } finally {
      setLoading(false);
    }
  }, [selectedWf, workflowJson, serverUrl, varValues, outputType, selectedWfId, persist]);

  const handleSelectWorkflow = useCallback((id: string) => {
    setSelectedWfId(id);
    setVarValues({});
    setResultPreview('');
    setStatusError('');
    persist({ selectedWfId: id, varValues: {}, value: '', resultUrls: [] });
  }, [persist]);

  return (
    <div className="relative group w-full h-full flex flex-col gap-2">
      <div className="absolute left-0 bottom-full pb-1.5 flex items-center gap-1.5">
        <span className="text-[11px] text-muted-foreground font-medium tracking-wider uppercase">{label}</span>
      </div>

      <div className="relative w-full flex-1 min-h-40" ref={cardRef}>
        <div className={`bg-card border rounded-2xl w-full h-full overflow-hidden flex items-center justify-center transition-[box-shadow,border-color] duration-200 cursor-move ${selected ? 'ring-2 ring-zinc-500' : 'border-border/80'}`}>
          {loading ? (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <span className="text-xs animate-pulse">ComfyUI 执行中…</span>
            </div>
          ) : resultPreview ? (
            <div className="w-full h-full overflow-auto p-2 flex flex-wrap gap-2 items-start justify-center">
              {resultPreview.split('\n').filter(Boolean).map((url, i) => {
                if (/\.(png|jpg|jpeg|webp|gif)(\?|$)/i.test(url)) {
                  return <img key={i} src={url} className="max-w-full max-h-full rounded-lg object-contain" alt="" />;
                }
                if (/\.(mp4|webm|mov)(\?|$)/i.test(url)) {
                  return <video key={i} src={url} className="max-w-full max-h-full rounded-lg" controls />;
                }
                if (/\.(mp3|wav|ogg)(\?|$)/i.test(url)) {
                  return <audio key={i} src={url} className="w-full" controls />;
                }
                return <p key={i} className="text-xs text-foreground/80 line-clamp-3">{url}</p>;
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1.5 px-3 text-center">
              <div className="flex items-center justify-center size-16 rounded-2xl bg-muted/50">
                <Workflow className="size-8 text-muted-foreground" />
              </div>
              {selectedWf ? (
                <span className="text-[10px] text-muted-foreground">{selectedWf.name}</span>
              ) : (
                <span className="text-[10px] text-muted-foreground">选择工作流开始</span>
              )}
            </div>
          )}
        </div>
        <Handle type="target" position={Position.Left} style={{ left: -6, top: '50%', transform: 'translateY(-50%)' }} />
        <Handle type="source" position={Position.Right} style={{ right: -6, top: '50%', transform: 'translateY(-50%)' }} />
      </div>

      <ComfyUINodePanel
        cardRef={cardRef}
        selected={selected}
        loading={loading}
        onStop={onStop}
        onSubmit={onSubmit}
        selectedWfId={selectedWfId}
        workflows={workflows}
        onSelectWorkflow={handleSelectWorkflow}
        discoveredVars={discoveredVars}
        varValues={varValues}
        onVarValueChange={(key, val) => {
          const next = { ...varValues, [key]: val };
          setVarValues(next);
          persist({ varValues: next });
        }}
        outputType={outputType}
        statusError={statusError}
      />
    </div>
  );
}
