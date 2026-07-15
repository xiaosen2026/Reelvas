// 图片节点顶部工具栏 — 菜单数据与 prompt 模板（打光 / 分镜 / 场效等）

export type ToolMenuItem = {
  id: string;
  label: string;
  desc?: string;
  /** 若有 children 则为二级菜单 */
  children?: ToolMenuItem[];
  /** 写入下游节点的 prompt 片段 */
  prompt?: string;
};

/** 仅改光影、不改内容（电影级光影校正共用约束） */
const CINE_LIGHT_LOCK =
  '严格保留参考图主体、构图、服装、场景与细节，禁止改变人物身份、动作与画面内容；仅调整光照、曝光、色温与阴影层次。';

/** 情绪重塑共用约束 */
const EMOTION_LOCK =
  '锁定角色面部五官与发型特征，保持同一人物身份、服装与场景构图；仅精准调整喜怒哀乐等细腻情感表达与微表情，动作自然可信。';

/** 动态场效共用约束 */
const FX_LOCK =
  '保留参考图主体与构图；智能叠加环境粒子/氛围，不新增无关人物或文字水印。';

/** 分镜大师 */
export const STORY_MASTER_MENU: ToolMenuItem[] = [
  {
    id: 'multi-char-9',
    label: '多机位九宫格',
    desc: '基于一张参考图生成 3×3 不同机位/景别的关键帧',
    prompt:
      '基于参考图生成 3×3 共九格多机位分镜表。九格为同一角色与场景的不同机位与景别关键帧（如远景、中景、近景、特写、俯仰、侧面等），构图统一、电影分镜风格，格子边界清晰，高清细节。',
  },
  {
    id: 'plot-4',
    label: '剧情推演四宫格',
    desc: '以四格连环画形式，连贯展现情节的动态演变',
    prompt:
      '基于参考图以四格连环画形式推演情节：起承转合，从左到右、从上到下时间连贯，同一角色与场景风格，动作与情绪递进，电影关键帧质感。',
  },
  {
    id: 'comic-25',
    label: '25宫格连贯分镜',
    desc: '基于一张图生成连贯的 25 宫格分镜（5×5）',
    prompt:
      '基于参考图生成 5×5 共 25 格连贯分镜漫画页。叙事完整、时间顺序清晰，角色与场景风格统一，格子排布整齐，电影/漫画分镜质感，高清细节。',
  },
  {
    id: 'cine-color',
    label: '电影级光影校正',
    desc: '一键仅调整光照/曝光/色温，不改变画面内容',
    children: [
      {
        id: 'key',
        label: '主光',
        desc: '一键仅调整光照/曝光/色温，不改变画面内容',
        prompt: `${CINE_LIGHT_LOCK}应用电影级主光：明确主光源方向与强度，立体感强，曝光与色温自然。`,
      },
      {
        id: 'fill',
        label: '辅光',
        desc: '一键仅调整光照/曝光/色温，不改变画面内容',
        prompt: `${CINE_LIGHT_LOCK}应用电影级辅光填充：柔和阴影、压低反差，层次分明，肤色自然。`,
      },
      {
        id: 'rim',
        label: '逆光/轮廓光',
        desc: '一键仅调整光照/曝光/色温，不改变画面内容',
        prompt: `${CINE_LIGHT_LOCK}加强逆光与轮廓光，主体边缘与背景分离，电影感高光。`,
      },
      {
        id: 'hair',
        label: '发丝光',
        desc: '一键仅调整光照/曝光/色温，不改变画面内容',
        prompt: `${CINE_LIGHT_LOCK}增强发丝光与高光边缘，细腻发丝层次，肖像质感。`,
      },
      {
        id: 'side',
        label: '侧光',
        desc: '一键仅调整光照/曝光/色温，不改变画面内容',
        prompt: `${CINE_LIGHT_LOCK}改为戏剧侧光，明暗分割清晰，情绪张力。`,
      },
      {
        id: 'edge',
        label: '边缘光',
        desc: '一键仅调整光照/曝光/色温，不改变画面内容',
        prompt: `${CINE_LIGHT_LOCK}添加边缘光勾勒轮廓，主体从背景分离。`,
      },
      {
        id: 'top',
        label: '顶光',
        desc: '一键仅调整光照/曝光/色温，不改变画面内容',
        prompt: `${CINE_LIGHT_LOCK}使用顶光照明，眼窝与颧骨阴影戏剧化，电影质感。`,
      },
      {
        id: 'bottom',
        label: '底光',
        desc: '一键仅调整光照/曝光/色温，不改变画面内容',
        prompt: `${CINE_LIGHT_LOCK}使用底光照明，非常规向上阴影，悬疑氛围。`,
      },
      {
        id: 'eye',
        label: '眼神光',
        desc: '一键仅调整光照/曝光/色温，不改变画面内容',
        prompt: `${CINE_LIGHT_LOCK}增强眼神光与眼部高光，眼睛有神，肖像精修感。`,
      },
      {
        id: 'chiaroscuro',
        label: '明暗对比法',
        desc: '一键仅调整光照/曝光/色温，不改变画面内容',
        prompt: `${CINE_LIGHT_LOCK}应用 chiaroscuro 明暗对比法，戏剧高反差，暗部细节仍可读。`,
      },
      {
        id: 'rembrandt',
        label: '伦勃朗光',
        desc: '一键仅调整光照/曝光/色温，不改变画面内容',
        prompt: `${CINE_LIGHT_LOCK}应用伦勃朗光：面颊三角光，古典肖像光影。`,
      },
      {
        id: 'butterfly',
        label: '蝴蝶光',
        desc: '一键仅调整光照/曝光/色温，不改变画面内容',
        prompt: `${CINE_LIGHT_LOCK}应用蝴蝶光：鼻下蝶形阴影，时尚肖像。`,
      },
      {
        id: 'loop',
        label: '环形光',
        desc: '一键仅调整光照/曝光/色温，不改变画面内容',
        prompt: `${CINE_LIGHT_LOCK}应用环形光：鼻侧环形阴影，自然人像。`,
      },
      {
        id: 'split',
        label: '二分光',
        desc: '一键仅调整光照/曝光/色温，不改变画面内容',
        prompt: `${CINE_LIGHT_LOCK}应用二分光：半明半暗脸部，戏剧感。`,
      },
      {
        id: 'high-key',
        label: '高调光',
        desc: '一键仅调整光照/曝光/色温，不改变画面内容',
        prompt: `${CINE_LIGHT_LOCK}改为高调光：明亮通透，阴影极少，曝光提亮自然。`,
      },
      {
        id: 'flat',
        label: '平光',
        desc: '一键仅调整光照/曝光/色温，不改变画面内容',
        prompt: `${CINE_LIGHT_LOCK}改为平光：均匀照明，柔和低对比，无明显硬阴影。`,
      },
    ],
  },
  {
    id: 'tri-view',
    label: '角色三视图生成',
    desc: '一键生成角色三视图（正面/侧面/背面）',
    prompt:
      '基于参考角色一键生成人物模卡三视图：正面、侧面、背面并排展示，全身完整，比例正确，纯色或简洁背景，服装与五官与参考一致，高清细节。',
  },
  {
    id: 'push-3s',
    label: '画面推演 - 3秒后',
    desc: '基于物理逻辑，生成 3 秒后的动作结果',
    prompt:
      '基于参考图与物理逻辑，推演约 3 秒后的动作结果关键帧：动量、重力与姿态连贯可信，同一角色与场景，光影与运动模糊自然，不要跳跃换景。',
  },
  {
    id: 'push-5s',
    label: '画面推演 - 5秒前',
    desc: '基于物理逻辑，回溯生成 5 秒前的动作状态',
    prompt:
      '基于参考图与物理逻辑，回溯约 5 秒前的上一关键帧：动量与姿态可逆推合理，同一角色与场景，光影连贯，不要跳跃换景。',
  },
  {
    id: 'emotion',
    label: '情绪重塑',
    desc: '锁定角色面部特征，精准调整喜怒哀乐等细腻情感表达',
    children: [
      {
        id: 'angry',
        label: '生气',
        desc: '锁定角色面部特征，精准调整喜怒哀乐等细腻情感表达',
        prompt: `${EMOTION_LOCK}目标情绪：生气——眉头紧锁、眼含怒意、嘴角紧绷或咬牙，肢体微微紧绷。`,
      },
      {
        id: 'smile',
        label: '微笑',
        desc: '锁定角色面部特征，精准调整喜怒哀乐等细腻情感表达',
        prompt: `${EMOTION_LOCK}目标情绪：自然微笑——眼角放松、嘴角上扬，温柔可信。`,
      },
      {
        id: 'think',
        label: '思考',
        desc: '锁定角色面部特征，精准调整喜怒哀乐等细腻情感表达',
        prompt: `${EMOTION_LOCK}目标情绪：沉思——目光略垂或凝视远方，眉心微蹙，表情内敛。`,
      },
      {
        id: 'doubt',
        label: '疑惑',
        desc: '锁定角色面部特征，精准调整喜怒哀乐等细腻情感表达',
        prompt: `${EMOTION_LOCK}目标情绪：疑惑——单侧挑眉或微皱眉，眼神探询，嘴角略抿。`,
      },
      {
        id: 'scare',
        label: '吓到',
        desc: '锁定角色面部特征，精准调整喜怒哀乐等细腻情感表达',
        prompt: `${EMOTION_LOCK}目标情绪：受惊——眼睛睁大、瞳孔紧张、嘴唇微张，身体略后缩。`,
      },
      {
        id: 'peek',
        label: '偷窥',
        desc: '锁定角色面部特征，精准调整喜怒哀乐等细腻情感表达',
        prompt: `${EMOTION_LOCK}目标情绪：偷偷张望——侧目窥视、神情谨慎，半遮半掩的微表情。`,
      },
      {
        id: 'evil',
        label: '邪恶',
        desc: '锁定角色面部特征，精准调整喜怒哀乐等细腻情感表达',
        prompt: `${EMOTION_LOCK}目标情绪：阴险邪恶——嘴角冷笑、眼神锐利算计，压迫感。`,
      },
      {
        id: 'cry',
        label: '哭泣',
        desc: '锁定角色面部特征，精准调整喜怒哀乐等细腻情感表达',
        prompt: `${EMOTION_LOCK}目标情绪：哭泣——眼眶含泪或泪痕、鼻翼微红、嘴唇颤抖，悲伤可信。`,
      },
    ],
  },
  {
    id: 'depth',
    label: '深度视差（空间维补）',
    desc: '自动提取画面的 Z 轴深度信息，生成具有 3D 空间感的图层分层',
    prompt:
      '对参考图做深度视差与空间维补：自动理解 Z 轴深度，强化前景 / 中景 / 背景分层，轻微 3D 空间感与景深虚化，主体清晰，不改变人物身份与主要构图。',
  },
  {
    id: 'fx',
    label: '动态场效（意境增强）',
    desc: '智能添加雨、雪、尘埃、余烬或丁达尔效应等动态环境粒子',
    children: [
      {
        id: 'rain',
        label: '雨天',
        desc: '智能添加雨、雪、尘埃、余烬或丁达尔效应等动态环境粒子',
        prompt: `${FX_LOCK}叠加自然雨天粒子：清晰雨丝、溅水与湿润地面反光，氛围沉浸。`,
      },
      {
        id: 'snow',
        label: '雪天',
        desc: '智能添加雨、雪、尘埃、余烬或丁达尔效应等动态环境粒子',
        prompt: `${FX_LOCK}叠加自然雪天粒子：飘雪、轻落积雪感与冷色氛围，主体清晰。`,
      },
      {
        id: 'dust',
        label: '沙尘',
        desc: '智能添加雨、雪、尘埃、余烬或丁达尔效应等动态环境粒子',
        prompt: `${FX_LOCK}叠加沙尘颗粒与空气浑浊感，体积光中可见尘埃，主体可辨。`,
      },
      {
        id: 'tyndall',
        label: '丁达尔效应',
        desc: '智能添加雨、雪、尘埃、余烬或丁达尔效应等动态环境粒子',
        prompt: `${FX_LOCK}增强丁达尔光束与体积光柱，空气中可见微尘粒子，电影氛围。`,
      },
      {
        id: 'ember',
        label: '余烬',
        desc: '智能添加雨、雪、尘埃、余烬或丁达尔效应等动态环境粒子',
        prompt: `${FX_LOCK}叠加余烬与火星飞舞，暖色粒子点缀，光影与主体协调。`,
      },
      {
        id: 'firefly',
        label: '荧光浮游生物效果',
        desc: '智能添加雨、雪、尘埃、余烬或丁达尔效应等动态环境粒子',
        prompt: `${FX_LOCK}叠加荧光浮游光点粒子，梦幻微光氛围，主体清晰可读。`,
      },
    ],
  },
];

/** 宫格裁剪：本地 canvas 切图 → 多张 image 节点（非 AI prompt） */
export type GridCropSpec = { cols: number; rows: number };

export const GRID_CROP_MENU: (ToolMenuItem & { grid?: GridCropSpec })[] = [
  { id: 'g2x2', label: '4宫格裁剪', desc: '2×2 · 本地切成 4 张图片节点', grid: { cols: 2, rows: 2 } },
  { id: 'g3x3', label: '9宫格裁剪', desc: '3×3 · 本地切成 9 张图片节点', grid: { cols: 3, rows: 3 } },
  { id: 'g4x4', label: '16宫格裁剪', desc: '4×4 · 本地切成 16 张图片节点', grid: { cols: 4, rows: 4 } },
  { id: 'g5x5', label: '25宫格裁剪', desc: '5×5 · 本地切成 25 张图片节点', grid: { cols: 5, rows: 5 } },
  { id: 'gcustom', label: '自定义宫格裁剪', desc: '输入行 × 列后本地切图' },
];

/** 角度 */
export const ANGLE_MENU: ToolMenuItem[] = [
  { id: 'front', label: '正面', prompt: '保持主体一致，改为正面视角' },
  { id: 'side', label: '侧面', prompt: '保持主体一致，改为侧面视角' },
  { id: 'back', label: '背面', prompt: '保持主体一致，改为背面视角' },
  { id: 'top', label: '俯视', prompt: '保持主体一致，改为俯视视角' },
  { id: 'low', label: '仰视', prompt: '保持主体一致，改为仰视视角' },
  { id: 'dutch', label: '荷兰角', prompt: '保持主体一致，改为荷兰角倾斜构图' },
];

export type LightDirection = 'left' | 'top' | 'right' | 'front' | 'bottom' | 'back';

export const LIGHT_DIR_LABEL: Record<LightDirection, string> = {
  left: '左侧',
  top: '顶部',
  right: '右侧',
  front: '前方',
  bottom: '底部',
  back: '后方',
};

/**
 * 拼装打光 prompt：只写球面板上的真实参数（环绕/高度/夹角/强度/颜色）。
 */
export function buildLightingPrompt(opts: {
  intensity: number; // 0-100
  colorHex: string;
  orbitDeg: number;
  elevDeg: number;
  /** 光锥夹角 10–120°，越小越聚光 */
  coneAngleDeg?: number;
  /** 由 orbit/elev 推导的快捷方位，可选 */
  directionLabel?: string;
}): string {
  const color = (opts.colorHex || '#FFFFFF').toUpperCase();
  const intensity = Math.max(0, Math.min(100, Math.round(opts.intensity)));
  let orbit = Math.round(opts.orbitDeg);
  if (orbit > 180) orbit -= 360;
  if (orbit < -180) orbit += 360;
  const elev = Math.max(-90, Math.min(90, Math.round(opts.elevDeg)));
  const cone = Math.max(10, Math.min(120, Math.round(opts.coneAngleDeg ?? 45)));
  const beamHint =
    cone <= 25 ? '窄光束/聚光' : cone >= 80 ? '宽光束/散射柔光' : '中等光束';
  const dirHint = opts.directionLabel ? `（约${opts.directionLabel}）` : '';
  return [
    '基于参考图重新打光，严格保留主体、构图与材质细节，仅改变光照。',
    `主光源水平环绕 ${orbit}°、高度 ${elev}°${dirHint}，阴影与高光方向与此一致。`,
    `光锥夹角约 ${cone}°（${beamHint}），边缘过渡与光斑大小与此一致。`,
    `光照强度约 ${intensity}%；灯光颜色 ${color}。`,
    '电影级光影层次，不要添加无关物体或文字。',
  ].join('');
}

/**
 * 拼装「角度」prompt：旋转 / 倾斜 / 缩放参数写入提示词。
 * 上游参考图由连线传入，此处只描述机位变化。
 */
export function buildAnglePrompt(opts: {
  rotateDeg: number;
  tiltDeg: number;
  zoom: number;
}): string {
  let rot = Math.round(opts.rotateDeg) % 360;
  if (rot < 0) rot += 360;
  const tilt = Math.max(-90, Math.min(90, Math.round(opts.tiltDeg)));
  const zoom = Math.max(1, Math.min(10, Number(opts.zoom) || 5));
  const zoomFixed = zoom.toFixed(2);
  const zoomHint =
    zoom >= 7.5 ? '偏近景/特写' : zoom <= 3 ? '偏远景/全景' : '中景适中';
  return [
    '基于参考图调整画面机位与透视角度，严格保留主体身份、服装、场景内容与风格，仅改变观察视角与构图距离。',
    `水平旋转（yaw）约 ${rot}°；俯仰倾斜（pitch）约 ${tilt}°；镜头缩放约 ${zoomFixed}（1–10，${zoomHint}）。`,
    '透视自然、景深合理，电影级构图，不要添加无关物体或文字，不要改写角色五官与服装。',
  ].join('');
}

export const MORE_MENU: ToolMenuItem[] = [
  { id: 'inpaint', label: '重绘', prompt: '对参考图局部重绘优化，保持整体风格一致' },
  { id: 'erase', label: '擦除', prompt: '擦除参考图中多余元素，自然填充背景' },
  /** 扩图走专用 outpaint 节点（绿幕底图 + 填充），无 prompt 以免误走图生图 */
  { id: 'outpaint', label: '扩图', desc: '绿幕扩图画布 → AI 填充边缘' },
  { id: 'deText', label: '去文字', prompt: '去除参考图中的文字水印与字幕，自然修复背景' },
];

/** 顶栏「抠图」：spawn 图片节点时的提示词 */
export const MATTING_PROMPT =
  '抠出参考图主体，去除背景，边缘干净，主体细节与参考一致，纯色或透明背景，不要新增物体或文字。';

export const PANORAMA_PROMPT =
  '基于参考图生成 360 度等距柱状全景图（equirectangular，画幅约 2:1），环境连贯，可用于场景空间参考，高清细节';
