// 扩图节点：提交绿幕合成 + 图生图

import type { MutableRefObject } from 'react';
import {
  getPrimaryImageChannel,
  listImageModelOptions,
} from '../../../lib/settingsStore';
import { recordImageCall } from '../../../lib/usageStore';
import { createLogger } from '../../../lib/logger';
import { collectUpstreamInputs } from './collectUpstream';
import { fetchImageBatch } from './fetchImageBatch';
import { resolveEditRefs } from './resolveEditRefs';
import { localizeImageUrls } from './localizeImageUrls';
import { mapNodeMediaSize } from './fitMediaNodeSize';
import {
  buildGreenScreenCanvas,
  buildOutpaintPrompt,
  clampPads,
  GREEN_SCREEN_HEX,
  SEEDREAM_MIN_PIXELS,
  type ExpandPads,
} from './buildGreenScreenCanvas';

const log = createLogger('OutpaintNode');
const GEN_TIMEOUT_MS = 3 * 60 * 1000;

/** 节点未选模型时回退：渠道 models[0] / listImageModelOptions 首项 */
function resolveFallbackImageModel(channel: {
  models?: Array<{ name?: string }>;
}): string {
  const fromChannel = String(channel.models?.[0]?.name || '').trim();
  if (fromChannel) return fromChannel;
  const fromList = listImageModelOptions()[0]?.value?.trim();
  if (fromList) return fromList;
  return 'doubao-seedream-5-0-260128';
}

/** Seedream/豆包：强制总像素下限；其它模型不抬像素 */
function minPixelsForModel(model: string): number {
  return /seedream|doubao|豆包/i.test(model) ? SEEDREAM_MIN_PIXELS : 0;
}

type Rf = {
  getNodes: () => any[];
  getEdges: () => any[];
  setNodes: (fn: (nds: any[]) => any[]) => void;
};

export type OutpaintSubmitArgs = {
  id: string;
  rf: Rf;
  /** 与图片节点一致：用户在下拉中选的模型名 */
  model: string;
  pads: ExpandPads;
  userHint: string;
  refImage?: string;
  sourceUrl: string;
  imageSrcsRef: MutableRefObject<string[]>;
  abortRef: MutableRefObject<AbortController | null>;
  patchNode: (patch: Record<string, unknown>) => void;
  setLoading: (v: boolean) => void;
  setError: (v: string) => void;
  setFullscreen: (v: boolean) => void;
};

export async function runOutpaintSubmit(args: OutpaintSubmitArgs): Promise<void> {
  const {
    id, rf, model: modelArg, pads, userHint, refImage, sourceUrl, imageSrcsRef,
    abortRef, patchNode, setLoading, setError, setFullscreen,
  } = args;

  const { imageSrcs } = collectUpstreamInputs(id, rf.getNodes(), rf.getEdges());
  const merged = imageSrcsRef.current.length ? imageSrcsRef.current : imageSrcs;
  const src = String(refImage || merged[0] || sourceUrl || '').trim();
  if (!src) {
    const msg = '请先连接参考图片';
    setError(msg);
    patchNode({ error: msg, status: 'error' });
    return;
  }

  const channel = getPrimaryImageChannel();
  if (!channel?.apiKey?.trim() || !channel?.apiAddr?.trim()) {
    const msg = '未配置图像渠道：请在设置 → 图像模型中填写 API 地址与 Key';
    setError(msg);
    patchNode({ error: msg, status: 'error' });
    return;
  }

  // 优先节点下拉所选模型；空则回退渠道首模型（禁止空串 → 网关 dall-e）
  const model = String(modelArg || '').trim() || resolveFallbackImageModel(channel);
  const finalPads = clampPads(pads);
  log.info('onSubmit', 'start', {
    id,
    model,
    protocol: channel.protocol || '',
    pads: finalPads,
    hasHint: !!userHint.trim(),
  });
  setLoading(true);
  setError('');
  patchNode({
    status: 'loading',
    error: '',
    model,
    pads: finalPads,
    userHint,
    refImage: src,
  });

  const ac = new AbortController();
  abortRef.current = ac;
  const timer = window.setTimeout(() => ac.abort(), GEN_TIMEOUT_MS);

  try {
    // 源图 1:1 外扩；Seedream 再抬到 ≥3686400 像素，禁止默认压成 <2K
    const composite = await buildGreenScreenCanvas(src, {
      pads: finalPads,
      greenHex: GREEN_SCREEN_HEX,
      minPixels: minPixelsForModel(model),
    });
    if (ac.signal.aborted) return;
    const size = `${composite.width}x${composite.height}`;
    log.info('onSubmit', 'composite', {
      id,
      size,
      pixels: composite.width * composite.height,
      placed: composite.placed,
    });
    patchNode({
      compositeUrl: composite.dataUrl,
      compositeW: composite.width,
      compositeH: composite.height,
    });
    rf.setNodes((nds) => mapNodeMediaSize(nds, id, composite.width, composite.height));

    const prompt = buildOutpaintPrompt({ greenHex: GREEN_SCREEN_HEX, userHint });
    const refs = await resolveEditRefs(
      [composite.dataUrl],
      model,
      id,
      ac.signal,
      channel.protocol,
    );
    if (ac.signal.aborted) return;

    const urls = await fetchImageBatch({
      baseUrl: channel.apiAddr,
      apiKey: channel.apiKey,
      model,
      prompt,
      n: 1,
      size,
      protocol: channel.protocol,
      editImages: refs.editImages,
      editImageUrls: refs.editImageUrls,
      signal: ac.signal,
    });
    if (ac.signal.aborted) return;
    if (!urls.length) throw new Error('扩图未返回图片');

    const localized = await localizeImageUrls(urls, ac.signal);
    const out = localized[0] || urls[0];
    setLoading(false);
    setError('');
    setFullscreen(false);
    patchNode({
      status: 'done',
      error: '',
      value: out,
      imageUrls: [out],
      prompt,
      model,
      compositeUrl: composite.dataUrl,
      pads: finalPads,
      userHint,
      refImage: src,
    });
    recordImageCall(1);
    log.info('onSubmit', 'ok', { id, model, out: out.slice(0, 48) });
  } catch (e) {
    if (ac.signal.aborted) {
      setLoading(false);
      return;
    }
    const msg = e instanceof Error ? e.message : String(e);
    setLoading(false);
    setError(msg);
    patchNode({ status: 'error', error: msg });
    log.error('onSubmit', 'fail', { id, error: msg });
  } finally {
    window.clearTimeout(timer);
    if (abortRef.current === ac) abortRef.current = null;
  }
}

