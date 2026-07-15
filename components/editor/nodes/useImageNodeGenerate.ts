import { useCallback, useEffect, useRef, useState } from 'react';
import { getPrimaryImageChannel } from '../../../lib/settingsStore';
import {
  resolveImageCount,
  resolveImageQuality,
  resolveImageSizeFromSpec,
} from '../../../lib/llm/openaiImages';
import { recordImageCall } from '../../../lib/usageStore';
import { createLogger } from '../../../lib/logger';
import { collectUpstreamInputs, mergePromptWithUpstream } from './collectUpstream';
import { fetchImageBatch } from './fetchImageBatch';
import {
  buildSiblingImageNodes,
  mergeSpawnedImageNodes,
} from './spawnImageResultNodes';
import type { FlowEdge, FlowNode } from '../flow/types';
import {
  buildCameraPromptSuffix,
  normalizeCameraPick,
  type CameraPick,
} from './cameraPresets';
import { applyImageRecipe } from './applyImageRecipe';
import { resolveEditRefs } from './resolveEditRefs';
import { localizeImageUrls } from './localizeImageUrls';

const log = createLogger('ImageNode');

/** 生图总超时（含图床/API/落盘）；超时后 abort 并标 error，避免半小时假死 */
const IMAGE_GEN_TIMEOUT_MS = 3 * 60 * 1000;

/** 运行阶段：UI 区分「上传中 / 生成中」，避免只看到笼统「生成中」 */
export type ImageGenPhase = 'idle' | 'preparing' | 'uploading' | 'generating' | 'saving';

export function imageGenPhaseLabel(phase: ImageGenPhase): string {
  switch (phase) {
    case 'preparing':
      return '准备中…';
    case 'uploading':
      return '上传中…';
    case 'generating':
      return '生成中…';
    case 'saving':
      return '保存中…';
    default:
      return '';
  }
}

function phaseFromStage(stage: string): ImageGenPhase {
  if (stage === 'refs') return 'uploading';
  if (stage === 'api') return 'generating';
  if (stage === 'localize') return 'saving';
  if (stage === 'recipe' || stage === 'init') return 'preparing';
  return 'generating';
}

function stageLabelOf(stage: string): string {
  if (stage === 'refs') return '参考图/图床';
  if (stage === 'api') return '图像API';
  if (stage === 'localize') return '结果落盘';
  if (stage === 'recipe') return '配方';
  return stage;
}

type PatchFn = (patch: Record<string, unknown>) => void;
type MetaFn = () => { recipeId: string; recipeTitle: string };
type SetNodesFn = (updater: (nodes: FlowNode[]) => FlowNode[]) => void;

export function useImageNodeGenerate(opts: {
  id: string;
  prompt: string;
  model: string;
  res: string;
  qty: string;
  aspect?: string;
  quality?: string;
  recipeId?: string;
  recipeMeta?: MetaFn;
  camera?: CameraPick;
  getGraph: () => { nodes: FlowNode[]; edges: FlowEdge[] };
  setNodes: SetNodesFn;
  patchNode: PatchFn;
  getImageSrcs?: () => string[];
  initialUrls?: string[];
  initialStatus?: string;
  initialError?: string;
}) {
  const {
    id,
    prompt,
    model,
    res,
    qty,
    aspect = 'auto',
    quality = 'high',
    recipeId = '',
    recipeMeta,
    camera,
    getGraph,
    setNodes,
    patchNode,
    getImageSrcs,
  } = opts;

  // 禁止从持久化 status=loading 恢复转圈；phase 驱动「上传中/生成中」文案
  const [phase, setPhase] = useState<ImageGenPhase>('idle');
  const phaseRef = useRef<ImageGenPhase>('idle');
  phaseRef.current = phase;
  const loading = phase !== 'idle';
  const [error, setError] = useState(
    opts.initialStatus === 'loading' ? '' : opts.initialError || '',
  );
  const [urls, setUrls] = useState<string[]>(opts.initialUrls || []);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    [],
  );

  // 工作流里残留的 loading 清掉（有图→done，无图→idle）
  useEffect(() => {
    if (opts.initialStatus !== 'loading') return;
    const hasImg = (opts.initialUrls?.length ?? 0) > 0;
    patchNode({ status: hasImg ? 'done' : 'idle', error: '', genPhase: '' });
    log.info('recoverStuckLoading', 'cleared persisted loading', {
      id,
      hasImg,
    });
    // 仅挂载恢复一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const sizeMeta = useCallback(
    () => ({
      aspect,
      quality,
      res,
      qty,
      camera: normalizeCameraPick(camera),
      ...(recipeMeta?.() ?? {}),
    }),
    [aspect, quality, res, qty, camera, recipeMeta],
  );

  const onStop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    phaseRef.current = 'idle';
    setPhase('idle');
    patchNode({ status: urls.length ? 'done' : 'idle', error: '', genPhase: '' });
    log.info('onStop', 'user stop', { id });
  }, [id, patchNode, urls.length]);

  const onSubmit = useCallback(async () => {
    if (phaseRef.current !== 'idle') return;

    const { nodes, edges } = getGraph();
    const up = collectUpstreamInputs(id, nodes, edges);
    // UI 缓存（useUpstreamImages）首帧可能仍为空；空数组不是 null，不能用 ?? 回退。
    // 以图上 collectUpstream 为准，再并入本地附加，避免 autoGenerate 抢跑成「无参考文生图」。
    const fromUi = (getImageSrcs?.() ?? []).filter((s) => Boolean(s?.trim()));
    const imageSrcs: string[] = [];
    for (const u of [...up.imageSrcs, ...fromUi]) {
      const t = u?.trim();
      if (t && !imageSrcs.includes(t)) imageSrcs.push(t);
    }
    if (!fromUi.length && up.imageSrcs.length) {
      log.info('onSubmit', 'imageSrcs from graph (ui lag)', {
        id,
        n: up.imageSrcs.length,
      });
    }
    const mergedPrompt = mergePromptWithUpstream(prompt, up.texts);
    if (!mergedPrompt.trim()) {
      const msg = '请输入描述，或连线上游文本节点';
      setError(msg);
      patchNode({ prompt, model, ...sizeMeta(), status: 'error', error: msg });
      return;
    }

    const channel = getPrimaryImageChannel();
    if (!channel?.apiKey?.trim() || !channel?.apiAddr?.trim()) {
      const msg = '未配置图像渠道：请在设置 → 图像模型中填写 API 地址与 Key';
      setError(msg);
      setUrls([]);
      patchNode({
        prompt,
        model,
        ...sizeMeta(),
        status: 'error',
        error: msg,
        value: '',
        imageUrls: [],
      });
      return;
    }

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    let timedOut = false;
    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      ac.abort();
      log.warn('onSubmit', 'timeout abort', { id, ms: IMAGE_GEN_TIMEOUT_MS });
    }, IMAGE_GEN_TIMEOUT_MS);

    setPhase('preparing');
    setError('');
    setUrls([]);

    const size = resolveImageSizeFromSpec({ aspect, res });
    const apiQuality = resolveImageQuality(quality);
    const n = resolveImageCount(qty);
    const mode = imageSrcs.length > 0 ? 'edits' : 'generations';

    patchNode({
      prompt,
      model,
      ...sizeMeta(),
      status: 'loading',
      genPhase: 'preparing',
      error: '',
      value: '',
      imageUrls: [],
    });
    log.info('onSubmit', 'generate', {
      id,
      model,
      recipeId: recipeId || 'none',
      n,
      mode,
      size: size ?? null,
      apiQuality: apiQuality ?? null,
      imageCount: imageSrcs.length,
      timeoutMs: IMAGE_GEN_TIMEOUT_MS,
      refKinds: imageSrcs.map((u) =>
        u.startsWith('data:')
          ? 'data'
          : u.startsWith('blob:')
            ? 'blob'
            : u.startsWith('http')
              ? 'http'
              : 'other',
      ),
    });

    const enterPhase = (next: ImageGenPhase) => {
      setPhase(next);
      patchNode({ genPhase: next });
    };

    const failIfAborted = (stageName: string): boolean => {
      if (!ac.signal.aborted) return false;
      if (timedOut) {
        const msg = `图像生成超时（>${Math.round(IMAGE_GEN_TIMEOUT_MS / 1000)}s · ${stageLabelOf(stageName)}）`;
        setPhase('idle');
        setError(msg);
        setUrls([]);
        patchNode({
          prompt,
          model,
          ...sizeMeta(),
          status: 'error',
          genPhase: '',
          error: msg,
          value: '',
          imageUrls: [],
        });
        log.error('onSubmit', 'timeout', { id, stage: stageName, msg });
      }
      return true;
    };

    let stage = 'init';
    try {
      stage = 'recipe';
      enterPhase('preparing');
      let finalPrompt = await applyImageRecipe(mergedPrompt, recipeId, ac.signal);
      if (failIfAborted(stage)) return;

      const camSuffix = buildCameraPromptSuffix(normalizeCameraPick(camera));
      if (camSuffix) {
        finalPrompt = `${finalPrompt.trim()}\n${camSuffix}`;
        log.info('onSubmit', 'camera_suffix', { id, camSuffix: camSuffix.slice(0, 120) });
      }

      stage = 'refs';
      // 有参考图才显示「上传中」；纯文生图跳过图床阶段
      if (imageSrcs.length > 0) enterPhase('uploading');
      else enterPhase('generating');
      log.info('onSubmit', 'stage refs', {
        id,
        n: imageSrcs.length,
        protocol: channel.protocol || '',
      });
      const { editImages, editImageUrls } = await resolveEditRefs(
        imageSrcs,
        model,
        id,
        ac.signal,
        channel.protocol,
      );
      log.info('onSubmit', 'refs ready', {
        id,
        editUrls: editImageUrls?.length ?? 0,
        editBlobs: editImages?.length ?? 0,
        urlPreview: (editImageUrls || []).map((u) => u.slice(0, 80)),
      });
      if (failIfAborted(stage)) return;

      stage = 'api';
      enterPhase('generating');
      log.info('onSubmit', 'stage api', {
        id,
        mode,
        model,
        protocol: channel.protocol || '',
      });
      const tApi = performance.now();
      const remoteUrls = await fetchImageBatch({
        baseUrl: channel.apiAddr,
        apiKey: channel.apiKey,
        model,
        prompt: finalPrompt,
        n,
        size,
        quality: apiQuality as string | undefined,
        protocol: channel.protocol,
        aspectRatio: aspect && aspect !== 'auto' ? aspect : undefined,
        imageSize: res || undefined,
        editImages,
        editImageUrls,
        signal: ac.signal,
      });
      log.info('onSubmit', 'api_done', {
        id,
        mode,
        got: remoteUrls.length,
        ms: Math.round(performance.now() - tApi),
        remotePreview: remoteUrls.map((u) => u.slice(0, 80)),
      });
      if (failIfAborted(stage)) return;

      stage = 'localize';
      enterPhase('saving');
      log.info('onSubmit', 'stage localize', { id, n: remoteUrls.length });
      const nextUrls = await localizeImageUrls(remoteUrls, ac.signal);
      if (failIfAborted(stage)) return;

      const primaryUrl = nextUrls[0] || '';
      const primaryList = primaryUrl ? [primaryUrl] : [];
      setUrls(primaryList);
      setPhase('idle');
      setError('');
      recordImageCall(nextUrls.length || 1);
      patchNode({
        prompt,
        model,
        ...sizeMeta(),
        status: nextUrls.length ? 'done' : 'error',
        genPhase: '',
        error: nextUrls.length ? '' : '接口未返回图片（无 url / b64）',
        value: primaryUrl,
        imageUrls: primaryList,
      });

      if (nextUrls.length > 1) {
        const graph = getGraph();
        const source = graph.nodes.find((node) => node.id === id);
        if (source) {
          const recipe = recipeMeta?.() ?? { recipeId: '', recipeTitle: '' };
          const siblings = buildSiblingImageNodes({
            source,
            urls: nextUrls,
            prompt,
            model,
            meta: {
              aspect,
              quality,
              res,
              recipeId: recipe.recipeId,
              recipeTitle: recipe.recipeTitle,
            },
            existingIds: graph.nodes.map((node) => node.id),
          });
          if (siblings.length) {
            setNodes((nds) => mergeSpawnedImageNodes(nds, siblings));
          }
        }
      }

      log.info('onSubmit', 'ok', {
        id,
        count: nextUrls.length,
        local: nextUrls.filter((u) => u.startsWith('data:image/')).length,
        spawned: Math.max(0, nextUrls.length - 1),
        mode,
      });
    } catch (err) {
      if (failIfAborted(stage)) return;
      const raw = err instanceof Error ? err.message : String(err);
      const msg = raw.startsWith('[') ? raw : `[${stageLabelOf(stage)}] ${raw}`;
      setPhase('idle');
      setError(msg);
      setUrls([]);
      patchNode({
        prompt,
        model,
        ...sizeMeta(),
        status: 'error',
        genPhase: '',
        error: msg,
        value: '',
        imageUrls: [],
      });
      log.error('onSubmit', 'failed', { id, stage, phase: phaseFromStage(stage), msg, raw });
    } finally {
      window.clearTimeout(timeoutId);
      if (abortRef.current === ac) abortRef.current = null;
    }
  }, [
    prompt,
    model,
    res,
    qty,
    aspect,
    quality,
    recipeId,
    camera,
    getImageSrcs,
    getGraph,
    setNodes,
    id,
    patchNode,
    sizeMeta,
    recipeMeta,
  ]);

  return {
    loading,
    phase,
    phaseLabel: imageGenPhaseLabel(phase),
    error,
    urls,
    onSubmit,
    onStop,
    setUrls,
  };
}
