// 图片节点「摄影机」预设：合并 store 列表 + 焦距/风格常量

import {
  CAMERA_FOCALS,
  CAMERA_STYLES,
  EMPTY_CAMERA,
  type CameraOption,
  type CameraPick,
} from './cameraPresetData';
import {
  findCameraOption,
  listCameraOptions,
} from '../../../lib/cameraPresetStore';

export type { CameraOption, CameraPick } from './cameraPresetData';
export {
  CAMERA_BODIES,
  CAMERA_LENSES,
  CAMERA_FILMS,
  CAMERA_FOCALS,
  CAMERA_STYLES,
  EMPTY_CAMERA,
} from './cameraPresetData';

function findOpt(list: CameraOption[], id: string): CameraOption | undefined {
  return list.find((x) => x.id === id);
}

function bodies() {
  return listCameraOptions('body');
}
function lenses() {
  return listCameraOptions('lens');
}
function films() {
  return listCameraOptions('film');
}

export function normalizeCameraPick(raw?: Partial<CameraPick> | null): CameraPick {
  return {
    body: raw?.body && findCameraOption('body', raw.body) ? raw.body : 'none',
    lens: raw?.lens && findCameraOption('lens', raw.lens) ? raw.lens : 'none',
    film: raw?.film && findCameraOption('film', raw.film) ? raw.film : 'none',
    focal: raw?.focal && findOpt(CAMERA_FOCALS, raw.focal) ? raw.focal : 'none',
    style: raw?.style && findOpt(CAMERA_STYLES, raw.style) ? raw.style : 'none',
  };
}

/** 是否有任意有效选择 */
export function hasCameraPick(pick: CameraPick): boolean {
  return [pick.body, pick.lens, pick.film, pick.focal, pick.style].some((v) => v && v !== 'none');
}

/** 按钮上的短摘要 */
export function formatCameraSummary(pick: CameraPick): string {
  if (!hasCameraPick(pick)) return '摄影机';
  const parts: string[] = [];
  const body = findCameraOption('body', pick.body);
  const lens = findCameraOption('lens', pick.lens);
  const film = findCameraOption('film', pick.film);
  const focal = findOpt(CAMERA_FOCALS, pick.focal);
  const style = findOpt(CAMERA_STYLES, pick.style);
  if (body && body.id !== 'none') parts.push(body.label);
  else if (style && style.id !== 'none') parts.push(style.label);
  else if (lens && lens.id !== 'none') parts.push(lens.label);
  else if (film && film.id !== 'none') parts.push(film.label);
  else if (focal && focal.id !== 'none') parts.push(focal.label);
  return parts[0] || '摄影机';
}

/** 拼入生图 prompt 的后缀（无选择时返回空串） */
export function buildCameraPromptSuffix(pick: CameraPick): string {
  const chunks: string[] = [];
  const push = (o: CameraOption | undefined) => {
    if (o?.prompt) chunks.push(o.prompt);
  };
  push(findCameraOption('body', pick.body));
  push(findCameraOption('lens', pick.lens));
  push(findCameraOption('film', pick.film));
  push(findOpt(CAMERA_FOCALS, pick.focal));
  push(findOpt(CAMERA_STYLES, pick.style));
  if (!chunks.length) return '';
  return `Camera look: ${chunks.join(', ')}.`;
}

/** 运行时列表（含用户自定义） */
export function getRuntimeCameraLists() {
  return { bodies: bodies(), lenses: lenses(), films: films() };
}
