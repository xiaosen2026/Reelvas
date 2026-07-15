// 设置对话框 Skills / Recipes 内置数据（抽包自原版 v1.0.4）
import skillsData from "./builtinSkills.json";
import recipesData from "./builtinRecipes.json";

export interface SkillItem {
  id: string;
  version: string;
  category: string; // ecommerce / general / video / social
  desc: string;
  keywords: string[]; // "关键词" 或 "关键词:权重"
  nodeTypes: string[];
  metaPlanningHints: string;
  promptStyleGuide: string;
}

export interface RecipeItem {
  id: string;
  version: string;
  type: string; // 文本 / 图片 / 视频
  title: string;
  operationTypes: string[];
  systemPrompt: string;
  requiredElements: string[];
  plannerHint: string;
}

// 内置定义直接读取自原版导出的 JSON（含完整关键词/提示词），保持单一数据源
export const SKILLS: SkillItem[] = skillsData as SkillItem[];
export const RECIPES: RecipeItem[] = recipesData as RecipeItem[];

export const TYPE_BADGE: Record<string, string> = {
  文本: 'text-amber-600 border-amber-300 bg-amber-50',
  图片: 'text-blue-600 border-blue-300 bg-blue-50',
  视频: 'text-purple-600 border-purple-300 bg-purple-50',
};

// Agent 模型偏好下拉数据（抓包自原版，含定价说明）
export interface ModelItem {
  name: string;
  icon: string;
  desc: string;
}

export const TEXT_MODELS: ModelItem[] = [
  { name: 'Gemini 3.5 Flash', icon: '✦', desc: '速度快' },
  { name: 'Gemini 3.1 Pro', icon: '✦', desc: '比 3 Pro 的推理性能提升了一倍以上' },
  { name: 'GPT-5.4', icon: '🤖', desc: '适合复杂任务' },
  { name: 'GPT-5.5', icon: '🤖', desc: '极强的推理能力，适合复杂任务' },
  { name: 'Claude Opus 4.6', icon: '🅰', desc: '强大推理模型，适合长上下文和专业任务' },
  { name: 'Claude Opus 4.7', icon: '🅰', desc: '强大推理模型，适合长上下文和专业任务' },
  { name: 'Claude Opus 4.8', icon: '🅰', desc: '目前 Anthropic 最强的能单独扛住长时间复杂工作的模型' },
];

export const IMAGE_MODELS: ModelItem[] = [
  { name: 'Grok 4.2 Image', icon: '🌀', desc: 'xAI 图像生成，3图参考，1K分辨率' },
  { name: 'GPT Image 2', icon: '🤖', desc: 'OpenAI 新一代图片模型，文本渲染与排版极其强大' },
  { name: 'Banana', icon: '🍌', desc: 'Banana 基础版，支持多图参考' },
  { name: 'Banana 2', icon: '🍌', desc: '与Pro相近，支持4K与极端宽高比，进阶文字生成' },
  { name: 'Banana Pro', icon: '🍌', desc: 'Banana 升级版，强大融图，自定义尺寸' },
  { name: 'Banana Pro 4k', icon: '🍌', desc: 'Banana Pro 高清版，4K 分辨率' },
  { name: 'Seedream 5.0 Lite', icon: '🌊', desc: '支持 2K/3K' },
  { name: 'Seedream 4.5', icon: '🌊', desc: '支持 2K/4K' },
  { name: 'Midjourney', icon: '🎨', desc: '风格强大，富于电影、艺术感，支持垫单图参考' },
  { name: 'Qwen Image Edit Plus', icon: '🖼', desc: '1-3图输入，强大的通用图像编辑' },
  { name: 'Qwen Image Edit Max', icon: '🖼', desc: '1-3图输入，旗舰级图像编辑模型，稳定高质量' },
  { name: 'Bria RMBG-2.0', icon: '✂', desc: '背景移除为透明，支持半透明细节保留' },
  { name: 'Topaz Labs', icon: '💎', desc: '专业图像增强与超分辨率' },
];

export const VIDEO_MODELS: ModelItem[] = [
  { name: 'Kling V3', icon: '🎬', desc: '3~15秒，首帧，尾帧，首尾帧，720P~4K' },
  { name: 'Kling V2.6', icon: '🎬', desc: '支持首帧，首尾帧，2图输入，支持配音' },
  { name: 'Kling V2.5 Turbo', icon: '🎬', desc: '支持首帧，尾帧，首尾帧，2图输入' },
  { name: 'Kling O3', icon: '🎬', desc: '3~15秒，多模态视频生成与编辑，720P~4K' },
  { name: 'Seedance 2.0', icon: '💃', desc: '地表最强视频模型，支持全能参考' },
  { name: 'Seedance 2.0 低价', icon: '💃', desc: '特殊渠道，请酌情适度使用' },
  { name: 'Seedance 2.0 Fast', icon: '💃', desc: '地表最强视频模型快速版，支持全能参考' },
  { name: 'Seedance 2.0 Mini', icon: '💃', desc: 'Seedance 2.0 轻量版，支持全能参考' },
  // 网关真实 model id（通用 /v1/video/generations）
  { name: 'doubao-seedance-2-0-fast-260128', icon: '💃', desc: 'Seedance Fast · 通用协议已验证' },
  { name: 'happyhorse-1.0-r2v-720p', icon: '🐴', desc: 'HappyHorse 参考生视频 · 通用协议' },
  { name: 'happyhorse-1.0-i2v-720p', icon: '🐴', desc: 'HappyHorse 图生 · 通用协议' },
  { name: 'happyhorse-1.0-t2v-720p', icon: '🐴', desc: 'HappyHorse 文生 · 通用协议' },
  { name: 'grok-video-1.5-preview', icon: '🌀', desc: 'Grok · 文生视频' },
  { name: 'Grok Video 3', icon: '🌀', desc: 'Grok视频生成，支持文生视频和7图参考' },
  { name: 'Grok Imagine 1.5 Video', icon: '🌀', desc: '7图参考，支持480p/720p' },
  { name: 'Grok Imagine Video (官方)', icon: '🌀', desc: 'xAI 官转，支持 480p/720p 与 1-15 秒' },
  { name: 'Omni Flash', icon: '⚡', desc: '文生视频/单图/3图参考，720P~4K，4~10s' },
  { name: 'Wan 2.6 T2V', icon: '🎞', desc: '文生视频' },
  { name: 'Wan 2.5 T2V Preview', icon: '🎞', desc: '文生视频' },
  { name: 'Wan 2.6 I2V', icon: '🎞', desc: '图文生视频，首帧' },
  { name: 'Wan 2.5 I2V Preview', icon: '🎞', desc: '图文生视频，首帧' },
  { name: 'WanX 2.1 KF2V Plus', icon: '🎞', desc: '图文生视频，首尾帧' },
  { name: 'MiniMax Hailuo 2.3', icon: '🎥', desc: '支持图文生视频，首帧' },
  { name: 'MiniMax Hailuo 2.3 Fast', icon: '🎥', desc: '支持图文生视频，首帧' },
  { name: 'Vidu Q3 Pro', icon: '🎥', desc: '高效音视频直出，支持1-16秒，首帧' },
  { name: 'Topaz Labs', icon: '💎', desc: '专业视频增强与超分辨率，由 Topaz Labs 提供' },
];

/** 音频/音乐候选模型（NewAPI Suno · 非 TTS） */
export const AUDIO_MODELS: ModelItem[] = [
  { name: 'suno_music', icon: '🎵', desc: 'Suno 音乐 · POST /suno/submit/music' },
  { name: 'suno_lyrics', icon: '📝', desc: 'Suno 歌词 · POST /suno/submit/lyrics' },
];

/** TTS 候选模型（优先 nxfl /v1/models 中的 Qwen·CosyVoice 非实时名）
 *  注意：模型在列表可见 ≠ 网关 ConvertAudio 已实现。
 *  当前 nxfl 对 qwen-tts / cosyvoice 走 /v1/audio/speech 常返回 convert_request_failed。
 *  realtime / vc / vd / voice-enrollment 不作为默认候选。
 *  browser-tts 为免费 Edge 神经 TTS（无 Key，生成 mp3 可播放/下载）。
 */
export const TTS_MODELS: ModelItem[] = [
  { name: 'browser-tts', icon: '🆓', desc: '免费 · Edge 神经语音（可落盘 mp3，不扣费）' },
  { name: 'qwen3-tts-flash', icon: '🎙', desc: '通义 Qwen3 TTS Flash · 稳定版' },
  { name: 'qwen3-tts-flash-2025-11-27', icon: '🎙', desc: 'Qwen3 TTS Flash 快照 2025-11-27' },
  { name: 'qwen3-tts-flash-2025-09-18', icon: '🎙', desc: 'Qwen3 TTS Flash 快照 2025-09-18' },
  { name: 'qwen3-tts-instruct-flash', icon: '🎙', desc: 'Qwen3 TTS Instruct Flash · 指令控制' },
  { name: 'qwen3-tts-instruct-flash-2026-01-26', icon: '🎙', desc: 'Qwen3 Instruct 快照 2026-01-26' },
  { name: 'qwen-tts-2025-05-22', icon: '🎙', desc: 'Qwen-TTS 快照 2025-05-22' },
  { name: 'cosyvoice-v3-flash', icon: '🎙', desc: 'CosyVoice v3 Flash' },
  { name: 'tts-1', icon: '🔊', desc: 'OpenAI TTS · 需 OpenAI 渠道' },
  { name: 'tts-1-hd', icon: '🔊', desc: 'OpenAI TTS HD · 需 OpenAI 渠道' },
  { name: 'gpt-4o-mini-tts', icon: '🔊', desc: 'OpenAI mini TTS · 需 OpenAI 渠道' },
];
