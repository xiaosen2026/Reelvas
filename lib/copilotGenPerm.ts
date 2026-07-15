// Agent 生成权限：用户勾选后再自动提交，否则只建节点不改参数

export type GenPerm = {
  image: boolean;   // 生图
  video: boolean;   // 生视频
  audio: boolean;   // 生音频
  music: boolean;   // 生音乐
};

export const DEFAULT_GEN_PERM: GenPerm = {
  image: false, video: false, audio: false, music: false,
};

export const GEN_PERM_LABELS: Record<keyof GenPerm, string> = {
  image: '生图',
  video: '生视频',
  audio: '生音频',
  music: '生音乐',
};
