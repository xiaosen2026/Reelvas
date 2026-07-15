import { TextNode } from './TextNode';
import { ImageNode } from './ImageNode';
import { VideoNode } from './VideoNode';
import { AudioNode } from './AudioNode';
import { TtsNode } from './TtsNode';
import { ThreeDNode } from './ThreeDNode';
import { TextInputNode } from './TextInputNode';
import { StickyNoteNode } from './StickyNoteNode';
import { CanvasNode } from './CanvasNode';
import { UploadNode } from './UploadNode';
// 骨架节点（已落盘，编辑面板待补齐）
import { ScriptNode } from './ScriptNode';
import { TableNode } from './TableNode';
import { PanoramaNode } from './PanoramaNode';
import { StoryboardNode } from './StoryboardNode';
import { ComfyUINode } from './ComfyUINode';
import { HttpRequestNode } from './HttpRequestNode';
import { UpscaleNode } from './UpscaleNode';
import { OutpaintNode } from './OutpaintNode';

// type 字符串 -> 节点组件
export const nodeTypes = {
  // 已实现
  textInput: TextNode,
  image: ImageNode,
  video: VideoNode,
  audio: AudioNode,
  tts: TtsNode,
  threeDGeneration: ThreeDNode,
  textResource: TextInputNode,
  stickyNote: StickyNoteNode,
  canvas: CanvasNode,
  upload: UploadNode,
  upscale: UpscaleNode,
  outpaint: OutpaintNode,
  // 骨架
  script: ScriptNode,
  table: TableNode,
  panorama: PanoramaNode,
  storyboard: StoryboardNode,
  comfyui: ComfyUINode,
  httpRequest: HttpRequestNode,
};

// 菜单 id -> 节点配置（labelPrefix / 默认尺寸）
export interface NodeConfig {
  type: string;
  labelPrefix: string;
  width: number;
  height: number;
}

// key 用 ContextMenu 传来的菜单 id
export const nodeConfigs: Record<string, NodeConfig> = {
  // 已实现
  text: { type: 'textInput', labelPrefix: '文本节点', width: 400, height: 440 },
  image: { type: 'image', labelPrefix: '图片节点', width: 500, height: 500 },
  video: { type: 'video', labelPrefix: '视频节点', width: 500, height: 281 },
  audio: { type: 'audio', labelPrefix: '音频节点', width: 340, height: 112 },
  tts: { type: 'tts', labelPrefix: 'TTS 节点', width: 300, height: 148 },
  '3d': { type: 'threeDGeneration', labelPrefix: '3D导演台', width: 460, height: 380 },
  input: { type: 'textResource', labelPrefix: '文本', width: 360, height: 220 },
  board: { type: 'canvas', labelPrefix: 'CANVAS', width: 420, height: 320 },
  note: { type: 'stickyNote', labelPrefix: 'NOTE', width: 240, height: 180 },
  upload: { type: 'upload', labelPrefix: '上传', width: 500, height: 500 },
  upscale: { type: 'upscale', labelPrefix: '增强', width: 420, height: 480 },
  outpaint: { type: 'outpaint', labelPrefix: '扩图', width: 500, height: 500 },
  // 骨架
  script: { type: 'script', labelPrefix: '创建脚本', width: 460, height: 420 },
  table: { type: 'table', labelPrefix: '表格', width: 520, height: 120 },
  panorama: { type: 'panorama', labelPrefix: '全景图', width: 460, height: 380 },
  storyboard: { type: 'storyboard', labelPrefix: '分镜格子', width: 520, height: 420 },
  comfyui: { type: 'comfyui', labelPrefix: 'COMFY', width: 480, height: 420 },
  http: { type: 'httpRequest', labelPrefix: 'HTTP', width: 420, height: 360 },
};
