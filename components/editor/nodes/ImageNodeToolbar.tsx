'use client';
import { useCallback, useState } from 'react';
import {
  Globe2, ZoomIn, Scissors, Clapperboard, LayoutGrid, RotateCcw,
  Lightbulb, MoreHorizontal, Download, Undo2, Redo2, Bot,
} from 'lucide-react';
import { useFlow } from '../flow';
import { NodeTopBar } from './NodeTopBar';
import {
  STORY_MASTER_MENU,
  GRID_CROP_MENU,
  MORE_MENU,
  MATTING_PROMPT,
  PANORAMA_PROMPT,
  LIGHT_DIR_LABEL,
  buildLightingPrompt,
  buildAnglePrompt,
  type ToolMenuItem,
} from './imageToolMenus';
import { buildLinkedSpawn, mergeSpawnEdge, mergeSpawnNode } from './spawnLinkedNode';
import {
  buildGridCropNodes,
  mergeGridCropEdges,
  mergeGridCropNodes,
} from './spawnGridCropNodes';
import { TbBtn, IconBtn, Div, MenuWrap, SimpleMenu, CascadeMenu } from './ImageNodeToolbarUi';
import { LightingPanel, orbitElevToDirection } from './LightingPanel';
import { AnglePanel, type AngleParams } from './AnglePanel';
import { createLogger } from '../../../lib/logger';
const log = createLogger('ImageNodeToolbar');

type Props = {
  nodeId: string;
  selected?: boolean;
  cardRef: React.RefObject<HTMLDivElement | null>;
  imageUrl?: string;
  hasImage: boolean;
};

type OpenMenu = 'story' | 'grid' | 'angle' | 'light' | 'more' | null;
export function ImageNodeToolbar({ nodeId, selected, cardRef, imageUrl, hasImage }: Props) {
  const rf = useFlow();
  const [open, setOpen] = useState<OpenMenu>(null);
  const [subId, setSubId] = useState<string | null>(null);
  const [lightIntensity, setLightIntensity] = useState(30);
  const [lightColor, setLightColor] = useState('#FFFFFF');
  const [orbit, setOrbit] = useState(0);
  const [elev, setElev] = useState(10);
  /** 光锥夹角（°），越小越聚光 */
  const [coneAngle, setConeAngle] = useState(45);
  const [angleParams, setAngleParams] = useState<AngleParams>({
    rotate: 0,
    tilt: 0,
    zoom: 5,
  });

  const closeAll = useCallback(() => {
    setOpen(null);
    setSubId(null);
  }, []);

  const spawnImageEdit = useCallback(
    (prompt: string, labelHint?: string, opts?: { aspect?: string; autoGenerate?: boolean }) => {
      const source = rf.getNodes().find((n) => n.id === nodeId);
      if (!source) return;
      const result = buildLinkedSpawn({
        source,
        menuType: 'image',
        data: {
          prompt,
          label: labelHint || '图片节点',
          model: source.data?.model,
          aspect: opts?.aspect || source.data?.aspect || 'auto',
          quality: source.data?.quality || 'high',
          res: source.data?.res || '1K',
          qty: '1x',
          value: '',
          imageUrls: [],
          status: 'idle',
          autoGenerate: opts?.autoGenerate === true,
        },
        existingNodeIds: rf.getNodes().map((n) => n.id),
        existingEdgeIds: rf.getEdges().map((e) => e.id),
      });
      if (!result) return;
      rf.setNodes((nds) => mergeSpawnNode(nds, result.node, true));
      rf.setEdges((eds) => mergeSpawnEdge(eds, result.edge));
      log.info('spawnImageEdit', 'ok', { nodeId, prompt: prompt.slice(0, 80) });
      closeAll();
    },
    [rf, nodeId, closeAll],
  );

  const spawnPanorama = useCallback(() => {
    spawnImageEdit(PANORAMA_PROMPT, '生成全景图', { aspect: '2:1', autoGenerate: true });
    log.info('spawnPanorama', 'image-node', { nodeId });
  }, [spawnImageEdit, nodeId]);

  const spawnMatting = useCallback(() => {
    spawnImageEdit(MATTING_PROMPT, '抠图');
  }, [spawnImageEdit]);

  const spawnUpscale = useCallback(() => {
    const source = rf.getNodes().find((n) => n.id === nodeId);
    if (!source) return;
    const result = buildLinkedSpawn({
      source,
      menuType: 'upscale',
      data: {
        label: '增强',
        value: imageUrl || source.data?.value || '',
        refImage: imageUrl || source.data?.value || '',
        scale: '2x',
        mode: 'api',
        style: '通用',
        faceEnhance: false,
        status: 'idle',
      },
      existingNodeIds: rf.getNodes().map((n) => n.id),
      existingEdgeIds: rf.getEdges().map((e) => e.id),
    });
    if (!result) return;
    rf.setNodes((nds) => mergeSpawnNode(nds, result.node, true));
    rf.setEdges((eds) => mergeSpawnEdge(eds, result.edge));
    log.info('spawnUpscale', 'ok', { nodeId });
    closeAll();
  }, [rf, nodeId, imageUrl, closeAll]);

  const spawnOutpaint = useCallback(() => {
    const source = rf.getNodes().find((n) => n.id === nodeId);
    if (!source) return;
    const ref = imageUrl || source.data?.value || '';
    const result = buildLinkedSpawn({
      source,
      menuType: 'outpaint',
      data: {
        label: '扩图',
        refImage: ref,
        value: '',
        pads: { left: 0.25, right: 0.25, top: 0.25, bottom: 0.25 },
        userHint: '',
        status: 'idle',
      },
      existingNodeIds: rf.getNodes().map((n) => n.id),
      existingEdgeIds: rf.getEdges().map((e) => e.id),
    });
    if (!result) return;
    rf.setNodes((nds) => mergeSpawnNode(nds, result.node, true));
    rf.setEdges((eds) => mergeSpawnEdge(eds, result.edge));
    log.info('spawnOutpaint', 'ok', { nodeId });
    closeAll();
  }, [rf, nodeId, imageUrl, closeAll]);

  const onDownload = useCallback(() => {
    if (!imageUrl) return;
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = `image-${nodeId}.png`;
    a.target = '_blank';
    a.rel = 'noopener';
    a.click();
    log.info('onDownload', 'trigger', { nodeId });
  }, [imageUrl, nodeId]);

  const spawnGridCrop = useCallback(
    async (cols: number, rows: number, labelHint?: string) => {
      const source = rf.getNodes().find((n) => n.id === nodeId);
      const srcUrl = imageUrl || (typeof source?.data?.value === 'string' ? source.data.value : '');
      if (!source || !srcUrl) {
        log.warn('spawnGridCrop', 'no image', { nodeId });
        return;
      }
      try {
        const { nodes, edges } = await buildGridCropNodes({
          source,
          imageUrl: srcUrl,
          cols,
          rows,
          labelPrefix: '裁剪',
          existingNodeIds: rf.getNodes().map((n) => n.id),
          existingEdgeIds: rf.getEdges().map((e) => e.id),
        });
        if (!nodes.length) return;
        rf.setNodes((nds) => mergeGridCropNodes(nds, nodes));
        rf.setEdges((eds) => mergeGridCropEdges(eds, edges));
        log.info('spawnGridCrop', 'ok', { nodeId, cols, rows, n: nodes.length });
      } catch (err) {
        log.error('spawnGridCrop', 'fail', { msg: err instanceof Error ? err.message : String(err) });
      }
      closeAll();
    },
    [rf, nodeId, imageUrl, closeAll],
  );

  const onMenuPick = useCallback(
    (item: ToolMenuItem) => {
      if (item.children?.length) {
        setSubId((cur) => (cur === item.id ? null : item.id));
        return;
      }
      const grid = (item as ToolMenuItem & { grid?: { cols: number; rows: number } }).grid;
      if (grid) {
        void spawnGridCrop(grid.cols, grid.rows, item.label);
        return;
      }
      if (item.id === 'gcustom') {
        const raw = typeof window !== 'undefined'
          ? window.prompt('自定义宫格：行 × 列（如 2x3 或 3,2）', '2x2')
          : null;
        if (!raw) return;
        const m = raw.trim().match(/^(\d+)\s*[xX×,，]\s*(\d+)$/);
        if (!m) {
          log.warn('onMenuPick', 'custom grid parse fail', { raw });
          return;
        }
        const rows = Math.max(1, Math.min(12, parseInt(m[1], 10)));
        const cols = Math.max(1, Math.min(12, parseInt(m[2], 10)));
        if (rows * cols < 2) return;
        void spawnGridCrop(cols, rows, `${rows}×${cols}裁剪`);
        return;
      }
      if (item.id === 'outpaint') {
        spawnOutpaint();
        return;
      }
      if (item.prompt) spawnImageEdit(item.prompt, item.label);
    },
    [spawnImageEdit, spawnGridCrop, spawnOutpaint],
  );

  const applyLighting = useCallback(() => {
    const dir = orbitElevToDirection(orbit, elev);
    const prompt = buildLightingPrompt({
      intensity: lightIntensity,
      colorHex: lightColor,
      orbitDeg: orbit,
      elevDeg: elev,
      coneAngleDeg: coneAngle,
      directionLabel: LIGHT_DIR_LABEL[dir],
    });
    const label = `打光·${Math.round(orbit)}°/${Math.round(elev)}°·夹角${Math.round(coneAngle)}°`;
    spawnImageEdit(prompt, label);
    log.info('applyLighting', 'spawn', {
      nodeId, orbit, elev, coneAngle, intensity: lightIntensity, color: lightColor,
    });
  }, [lightIntensity, lightColor, orbit, elev, coneAngle, spawnImageEdit, nodeId]);

  const applyAngle = useCallback(() => {
    const prompt = buildAnglePrompt({
      rotateDeg: angleParams.rotate,
      tiltDeg: angleParams.tilt,
      zoom: angleParams.zoom,
    });
    const label = `角度·${Math.round(angleParams.rotate)}°/${Math.round(angleParams.tilt)}°`;
    spawnImageEdit(prompt, label);
    log.info('applyAngle', 'spawn', { nodeId, ...angleParams });
  }, [angleParams, spawnImageEdit, nodeId]);

  return (
    <NodeTopBar cardRef={cardRef} selected={selected} barW={780} gap={12}>
      <div className="flex items-center gap-0.5 rounded-full border border-border/50 bg-card/95 backdrop-blur-sm px-1.5 py-1 shadow-sm mx-auto w-max max-w-full">
        <TbBtn onClick={spawnPanorama} disabled={!hasImage} title="生成全景图（图片节点 · 2:1）">
          <Globe2 className="size-3.5" /> 生成全景图
        </TbBtn>
        <TbBtn onClick={spawnUpscale} disabled={!hasImage} title="放大增强节点">
          <ZoomIn className="size-3.5" /> 增强
        </TbBtn>
        <TbBtn onClick={spawnMatting} disabled={!hasImage} title="抠图扣主体（拉出图片节点）">
          <Scissors className="size-3.5" /> 抠图
        </TbBtn>

        <MenuWrap open={open === 'story'} onToggle={() => setOpen(open === 'story' ? null : 'story')} onClose={closeAll}
          label="分镜大师" icon={<Clapperboard className="size-3.5" />} disabled={!hasImage} wide>
          <CascadeMenu items={STORY_MASTER_MENU} subId={subId} onPick={onMenuPick} />
        </MenuWrap>

        <MenuWrap open={open === 'grid'} onToggle={() => setOpen(open === 'grid' ? null : 'grid')} onClose={closeAll}
          label="宫格裁剪" icon={<LayoutGrid className="size-3.5" />} disabled={!hasImage}>
          <SimpleMenu items={GRID_CROP_MENU} onPick={onMenuPick} />
        </MenuWrap>

        <MenuWrap open={open === 'angle'} onToggle={() => setOpen(open === 'angle' ? null : 'angle')} onClose={closeAll}
          label="角度" icon={<RotateCcw className="size-3.5" />} disabled={!hasImage} wide>
          <AnglePanel
            params={angleParams}
            onChange={setAngleParams}
            onSend={applyAngle}
            previewUrl={imageUrl}
          />
        </MenuWrap>

        <MenuWrap open={open === 'light'} onToggle={() => setOpen(open === 'light' ? null : 'light')} onClose={closeAll}
          label="打光" icon={<Lightbulb className="size-3.5" />} disabled={!hasImage} wide>
          <LightingPanel
            intensity={lightIntensity}
            onIntensity={setLightIntensity}
            color={lightColor}
            onColor={setLightColor}
            orbit={orbit}
            onOrbit={setOrbit}
            elev={elev}
            coneAngle={coneAngle}
            onConeAngle={setConeAngle}
            onElev={setElev}
            onApply={applyLighting}
            previewUrl={imageUrl}
          />
        </MenuWrap>

        <MenuWrap open={open === 'more'} onToggle={() => setOpen(open === 'more' ? null : 'more')} onClose={closeAll}
          label="更多" icon={<MoreHorizontal className="size-3.5" />} disabled={!hasImage}>
          <SimpleMenu items={MORE_MENU} onPick={onMenuPick} />
        </MenuWrap>

        <Div />

        <IconBtn title="撤销" disabled><Undo2 className="size-3.5" /></IconBtn>
        <IconBtn title="重做" disabled><Redo2 className="size-3.5" /></IconBtn>
        <IconBtn title="下载" disabled={!hasImage} onClick={onDownload}><Download className="size-3.5" /></IconBtn>

        <Div />

        <TbBtn onClick={() => log.info('agent', 'stub')} title="加入 Agent（后续）">
          <Bot className="size-3.5" /> 加入 Agent
        </TbBtn>
      </div>
    </NodeTopBar>
  );
}
