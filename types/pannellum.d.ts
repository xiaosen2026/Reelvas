/** Pannellum 全局类型（包无官方 @types） */

interface PannellumRenderer {
  getCanvas?: () => HTMLCanvasElement;
  /** returnImage: true 时返回 PNG dataURL */
  render?: (
    pitch: number,
    yaw: number,
    hfov: number,
    params?: { returnImage?: boolean },
  ) => string | void;
  resize?: () => void;
}

interface PannellumViewer {
  destroy: () => void;
  getYaw?: () => number;
  getPitch?: () => number;
  getHfov?: () => number;
  setYaw?: (yaw: number) => void;
  setPitch?: (pitch: number) => void;
  setHfov?: (hfov: number) => void;
  loadScene?: (sceneId: string) => void;
  getRenderer?: () => PannellumRenderer | null | undefined;
}

interface PannellumConfig {
  type?: string;
  panorama?: string;
  autoLoad?: boolean;
  showControls?: boolean;
  mouseZoom?: boolean;
  draggable?: boolean;
  compass?: boolean;
  hfov?: number;
  yaw?: number;
  pitch?: number;
  autoRotate?: number;
  keyboardZoom?: boolean;
  crossOrigin?: string;
  [key: string]: unknown;
}

interface PannellumAPI {
  viewer: (container: HTMLElement | string, config: PannellumConfig) => PannellumViewer;
}

interface Window {
  pannellum?: PannellumAPI;
}

declare module 'pannellum';
declare module 'pannellum/build/pannellum.css';
