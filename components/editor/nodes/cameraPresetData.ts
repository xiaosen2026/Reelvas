// 摄影机预设：类型 + 内置种子数据（无 store 依赖，避免循环引用）

export type CameraPick = {
  body: string;
  lens: string;
  film: string;
  focal: string;
  style: string;
};

export type CameraOption = {
  id: string;
  label: string;
  /** 写入提示词的英文/中文描述片段 */
  prompt: string;
  desc?: string;
};

export const CAMERA_BODIES: CameraOption[] = [
  { id: 'none', label: '不指定', prompt: '' },
  { id: 'arri-alexa-35', label: 'ARRI Alexa 35', prompt: 'shot on ARRI Alexa 35 cinema camera', desc: '电影感、宽动态' },
  { id: 'red-v-raptor', label: 'RED V-Raptor', prompt: 'shot on RED V-Raptor 8K cinema camera', desc: '高细节、锐利' },
  { id: 'sony-venice', label: 'Sony Venice', prompt: 'shot on Sony Venice cinema camera', desc: '肤色友好' },
  { id: 'blackmagic-6k', label: 'Blackmagic 6K', prompt: 'shot on Blackmagic URSA Mini Pro 6K', desc: '电影机身' },
  { id: 'canon-c70', label: 'Canon C70', prompt: 'shot on Canon EOS C70', desc: '轻量电影机' },
  { id: 'iphone-15-pro', label: 'iPhone 15 Pro', prompt: 'shot on iPhone 15 Pro main camera', desc: '手机纪实' },
  { id: 'leica-m11', label: 'Leica M11', prompt: 'shot on Leica M11 rangefinder', desc: '人文街拍' },
  { id: 'hasselblad-x2d', label: 'Hasselblad X2D', prompt: 'shot on Hasselblad X2D medium format', desc: '中画幅质感' },
];

export const CAMERA_LENSES: CameraOption[] = [
  { id: 'none', label: '不指定', prompt: '' },
  { id: 'prime-35', label: '35mm 定焦', prompt: '35mm prime lens', desc: '环境人像' },
  { id: 'prime-50', label: '50mm 定焦', prompt: '50mm prime lens', desc: '自然视角' },
  { id: 'prime-85', label: '85mm 定焦', prompt: '85mm portrait prime lens', desc: '人像虚化' },
  { id: 'anamorphic', label: '变形宽银幕', prompt: 'anamorphic cinema lens, oval bokeh, horizontal flares', desc: '电影宽画幅' },
  { id: 'wide-24', label: '24mm 广角', prompt: '24mm wide-angle lens', desc: '空间感' },
  { id: 'tele-135', label: '135mm 长焦', prompt: '135mm telephoto lens, compressed perspective', desc: '压缩透视' },
  { id: 'macro', label: '微距', prompt: 'macro lens, extreme close-up detail', desc: '细节特写' },
  { id: 'fisheye', label: '鱼眼', prompt: 'fisheye lens, curved perspective', desc: '夸张透视' },
];

export const CAMERA_FILMS: CameraOption[] = [
  { id: 'none', label: '不指定', prompt: '' },
  { id: 'kodak-portra-400', label: 'Kodak Portra 400', prompt: 'Kodak Portra 400 film stock, soft pastels, natural skin tones', desc: '人像胶片' },
  { id: 'kodak-vision3', label: 'Kodak Vision3 500T', prompt: 'Kodak Vision3 500T cinema film stock', desc: '电影底片' },
  { id: 'fuji-provia', label: 'Fuji Provia 100F', prompt: 'Fujifilm Provia 100F slide film, clean colors', desc: '反转片' },
  { id: 'fuji-velvia', label: 'Fuji Velvia 50', prompt: 'Fujifilm Velvia 50, vivid saturated colors', desc: '风光高饱和' },
  { id: 'ilford-hp5', label: 'Ilford HP5', prompt: 'Ilford HP5 Plus black and white film grain', desc: '黑白颗粒' },
  { id: 'cinestill-800t', label: 'CineStill 800T', prompt: 'CineStill 800T, tungsten, red halation', desc: '夜景红晕' },
  { id: 'digital-clean', label: '数字干净', prompt: 'clean digital capture, low noise, modern color science', desc: '无胶片感' },
];

export const CAMERA_FOCALS: CameraOption[] = [
  { id: 'none', label: '不指定', prompt: '' },
  { id: 'f1.4', label: 'f/1.4', prompt: 'aperture f/1.4, shallow depth of field, creamy bokeh', desc: '极浅景深' },
  { id: 'f2.0', label: 'f/2.0', prompt: 'aperture f/2.0, soft background separation', desc: '浅景深' },
  { id: 'f2.8', label: 'f/2.8', prompt: 'aperture f/2.8', desc: '常用电影光圈' },
  { id: 'f4.0', label: 'f/4.0', prompt: 'aperture f/4.0, balanced depth of field', desc: '平衡' },
  { id: 'f8.0', label: 'f/8.0', prompt: 'aperture f/8, deep focus, sharp landscape detail', desc: '深景深' },
  { id: 'f16', label: 'f/16', prompt: 'aperture f/16, maximum depth of field', desc: '全清晰' },
];

export const CAMERA_STYLES: CameraOption[] = [
  { id: 'none', label: '不指定', prompt: '' },
  { id: 'cinematic', label: '电影感', prompt: 'cinematic lighting, dramatic contrast, film still', desc: '戏剧光影' },
  { id: 'documentary', label: '纪实', prompt: 'documentary photography style, candid moment', desc: '真实瞬间' },
  { id: 'commercial', label: '商业广告', prompt: 'high-end commercial photography, polished product look', desc: '精致商业' },
  { id: 'noir', label: '黑色电影', prompt: 'film noir, high contrast black and white shadows', desc: '硬光阴影' },
  { id: 'golden-hour', label: '黄金时刻', prompt: 'golden hour warm sunlight, soft rim light', desc: '暖金逆光' },
  { id: 'neon-night', label: '霓虹夜景', prompt: 'neon night city, cyan and magenta rim lights', desc: '赛博夜色' },
  { id: 'soft-portrait', label: '柔美人像', prompt: 'soft beauty portrait lighting, flattering skin', desc: '柔光人像' },
  { id: 'vintage', label: '复古', prompt: 'vintage retro aesthetic, slight fade, nostalgic tone', desc: '怀旧色调' },
];

export const EMPTY_CAMERA: CameraPick = {
  body: 'none',
  lens: 'none',
  film: 'none',
  focal: 'none',
  style: 'none',
};
