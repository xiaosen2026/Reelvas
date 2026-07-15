'use client';

// 视频节点生成：按渠道 protocol 分流 + 文生/图生

import { useCallback, useEffect, useRef, useState } from 'react';
import type { FlowEdge, FlowNode } from '../flow/types';
import { getPrimaryVideoChannel } from '../../../lib/settingsStore';
import { createAndWaitVideo, mapVideoSeconds, mapVideoSize } from '../../../lib/llm/openaiVideos';
import { recordVideoCall } from '../../../lib/usageStore';
import { createLogger } from '../../../lib/logger';
import { loadImageHostSettings } from '../../../lib/imageHostSettings';
import { collectUpstreamInputs, mergePromptWithUpstream } from './collectUpstream';
import { uploadRefsToHost } from './uploadRefsToHost';

const log = createLogger('useVideoNodeGenerate');

export type VideoGenerateParams = {
  id: string;
  prompt: string;
  model: string;
  res: string;
  ratio: string;
  duration: string;
  qty: string;
  /** 自定义像素宽，空则按 res+ratio */
  width?: string;
  height?: string;
  fps?: string;
  seed?: string;
  negativePrompt?: string;
  getGraph: () => { nodes: FlowNode[]; edges: FlowEdge[] };
  patchNode: (data: Record<string, unknown>) => void;
  /** 覆盖上游图（含本地附加），优先于 collectUpstream */
  getImageSrcs?: () => string[];
  /** 覆盖上游视频（全能参考） */
  getVideoSrcs?: () => string[];
  /** 覆盖上游音频（全能参考） */
  getAudioSrcs?: () => string[];
  initialUrl?: string;
  initialStatus?: string;
  initialError?: string;
};

function parseOptionalInt(raw?: string): number | undefined {
  if (raw == null || !String(raw).trim()) return undefined;
  const n = parseInt(String(raw).replace(/[^\d-]/g, ''), 10);
  return Number.isFinite(n) ? n : undefined;
}

export function useVideoNodeGenerate(p: VideoGenerateParams) {
  const [loading, setLoading] = useState(p.initialStatus === 'loading');
  const [error, setError] = useState(p.initialError || '');
  const [url, setUrl] = useState(p.initialUrl || '');
  const [progress, setProgress] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const pRef = useRef(p);
  pRef.current = p;

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const onStop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
    setProgress('');
    pRef.current.patchNode({ status: 'idle', progress: '' });
    log.info('onStop', 'aborted', { id: pRef.current.id });
  }, []);

  const onSubmit = useCallback(async () => {
    const cur = pRef.current;
    const channel = getPrimaryVideoChannel();
    if (!channel?.apiKey?.trim() || !channel?.apiAddr?.trim()) {
      const msg = '请先在设置 → 视频模型 配置 API 地址与 Key';
      setError(msg);
      cur.patchNode({ status: 'error', error: msg });
      return;
    }

    const { nodes, edges } = cur.getGraph();
    const upstream = collectUpstreamInputs(cur.id, nodes, edges);
    // 上游文字：追加到本节点提示词；图/视频/音频：火山全能参考
    const finalPrompt = mergePromptWithUpstream(cur.prompt, upstream.texts);
    let imageSrcs = (cur.getImageSrcs?.() ?? upstream.imageSrcs).filter((s) =>
      Boolean(s?.trim()),
    );
    const videoSrcs = (cur.getVideoSrcs?.() ?? upstream.videoSrcs).filter((s) =>
      Boolean(s?.trim()),
    );
    const audioSrcs = (cur.getAudioSrcs?.() ?? upstream.audioSrcs).filter((s) =>
      Boolean(s?.trim()),
    );
    const hasImage = imageSrcs.length > 0;
    const hasMedia = hasImage || videoSrcs.length > 0 || audioSrcs.length > 0;
    let primaryImage = hasImage ? imageSrcs[0] : undefined;

    if (!finalPrompt.trim() && !hasMedia) {
      const msg = '请输入描述，或连接上游文本/图片/视频/音频节点';
      setError(msg);
      cur.patchNode({ status: 'error', error: msg });
      return;
    }

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setLoading(true);
    setError('');
    setProgress('准备中…');
    cur.patchNode({
      status: 'loading',
      error: '',
      progress: '准备中…',
      prompt: cur.prompt,
      model: cur.model,
      res: cur.res,
      ratio: cur.ratio,
      duration: cur.duration,
      qty: cur.qty,
      width: cur.width || '',
      height: cur.height || '',
      fps: cur.fps || '',
      seed: cur.seed || '',
      negativePrompt: cur.negativePrompt || '',
      genMode: hasMedia ? 'i2v' : 't2v',
    });

    // !!! ⚠️ 参考图图床：data: → 公网 URL，避免 B64 撑爆 JSON 导致服务器超时 !!!
    // - 图像节点已做（resolveEditRefs → uploadRefsToHost），视频节点之前漏了
    // - 上传节点用 FileReader.readAsDataURL 产出 data:image/xxx;base64,... 可达数 MB
    // - 直接塞进 JSON body 经有限带宽网关提交视频 API → 超时 / 502
    // - 必须抢在 setLoading(true)（即按钮变「停止」）之前完成，否则用户看到已开始但实
    //   际还在慢慢吐 b64 → 以为卡死
    // - 图床失败不阻断生成，回退原始 data URL（网关慢但总比报错强）
    // - 不要删这个块，不要移 setLoading 之前
    const host = loadImageHostSettings();
    if (imageSrcs.length > 0 && host.enabled) {
      const dataSrcs = imageSrcs.filter((s) => s.startsWith('data:'));
      if (dataSrcs.length > 0) {
        const progressText = `图床 ${dataSrcs.length} 张…`;
        setProgress(progressText);
        cur.patchNode({ progress: progressText });
        log.info('onSubmit', 'imageHost upload start', {
          id: cur.id,
          n: dataSrcs.length,
        });
        try {
          const hostUrls = await uploadRefsToHost(dataSrcs, ac.signal);
          // 非 data: 的 URL 保留原样，替换 data: 为图床 URL
          let hostIdx = 0;
          imageSrcs = imageSrcs.map((s) =>
            s.startsWith('data:') ? hostUrls[hostIdx++] ?? s : s,
          );
          primaryImage = imageSrcs[0];
          log.info('onSubmit', 'imageHost upload done', {
            id: cur.id,
            n: hostUrls.length,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          log.warn('onSubmit', 'imageHost upload fail → fallback raw', {
            id: cur.id,
            msg,
          });
          // 图床失败不阻断，回退 data URL
        }
      }
    }

    setProgress('提交任务…');
    cur.patchNode({ progress: '提交任务…' });

    const autoSize = mapVideoSize(cur.res, cur.ratio);
    const seconds = mapVideoSeconds(cur.duration);
    const customW = parseOptionalInt(cur.width);
    const customH = parseOptionalInt(cur.height);
    const fps = parseOptionalInt(cur.fps);
    const seed = parseOptionalInt(cur.seed);
    const size =
      customW && customH && customW >= 256 && customH >= 256
        ? `${customW}x${customH}`
        : autoSize;
    const n = Math.min(4, Math.max(1, parseInt(String(cur.qty).replace(/[^\d]/g, ''), 10) || 1));

    log.info('onSubmit', 'start', {
      id: cur.id,
      model: cur.model,
      protocol: channel.protocol,
      mode: hasMedia ? 'i2v' : 't2v',
      size,
      seconds,
      n,
      fps,
      seed,
      hasNegative: Boolean(cur.negativePrompt?.trim()),
      promptLen: finalPrompt.length,
      upstreamImages: imageSrcs.length,
      upstreamVideos: videoSrcs.length,
      upstreamAudios: audioSrcs.length,
    });

    try {
      let lastUrl = '';
      for (let i = 0; i < n; i++) {
        const batchHint = n > 1 ? `（${i + 1}/${n}）` : '';
        const result = await createAndWaitVideo({
          baseUrl: channel.apiAddr,
          apiKey: channel.apiKey,
          model: cur.model,
          protocol: channel.protocol,
          prompt: finalPrompt,
          image: primaryImage,
          images: hasImage ? imageSrcs : undefined,
          // 火山全能参考：视频/音频一并写入 metadata.content
          videos: videoSrcs.length ? videoSrcs : undefined,
          audios: audioSrcs.length ? audioSrcs : undefined,
          seconds,
          size,
          width: customW && customW >= 256 ? customW : undefined,
          height: customH && customH >= 256 ? customH : undefined,
          fps: fps && fps > 0 ? fps : undefined,
          seed,
          aspectRatio: cur.ratio || '16:9',
          resolution: cur.res || undefined,
          negativePrompt: cur.negativePrompt?.trim() || undefined,
          signal: ac.signal,
          onProgress: (label) => {
            const text = `${label}${batchHint}`;
            setProgress(text);
            cur.patchNode({ progress: text });
          },
        });
        lastUrl = result.videoUrl;
        recordVideoCall(1);
      }

      setUrl(lastUrl);
      setLoading(false);
      setProgress('');
      cur.patchNode({
        status: 'done',
        error: '',
        progress: '',
        value: lastUrl,
        videoUrl: lastUrl,
        genMode: hasMedia ? 'i2v' : 't2v',
      });
      log.info('onSubmit', 'done', { id: cur.id, urlLen: lastUrl.length });
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        setLoading(false);
        setProgress('');
        cur.patchNode({ status: 'idle', progress: '' });
        return;
      }
      const msg = e instanceof Error ? e.message : String(e);
      log.error('onSubmit', 'fail', { id: cur.id, err: msg });
      setError(msg);
      setLoading(false);
      setProgress('');
      cur.patchNode({ status: 'error', error: msg, progress: '' });
    } finally {
      if (abortRef.current === ac) abortRef.current = null;
    }
  }, []);

  return { loading, error, url, progress, onSubmit, onStop };
}
