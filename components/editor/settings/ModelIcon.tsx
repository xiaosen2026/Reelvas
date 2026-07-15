'use client';

import type { ComponentType } from 'react';
import {
  OpenAI, Gemini, Claude, Grok, Midjourney, Qwen, Kling, Vidu, Minimax, Hailuo,
  NanoBanana, ByteDance, Alibaba, Flux, BriaAI, TopazLabs, DeepSeek, Doubao, Zhipu, Moonshot,
  Sora,
} from '@lobehub/icons';

type IconC = ComponentType<{ size?: number }>;

// [匹配规则, 图标组件]：彩色品牌用 Color 变体；OpenAI/Grok/Midjourney/Flux/Topaz 仅单色
// 顺序敏感：更具体的规则放前面（如 sora 先于 gpt、seedream 先于 seed）
const RULES: Array<[RegExp, IconC]> = [
  [/deepseek/i, DeepSeek.Color],
  [/gemini/i, Gemini.Color],
  // sora 必须在 gpt 前：sora-2 不应落到 emoji fallback
  [/sora/i, Sora.Color ?? Sora],
  [/gpt|openai|dall[-\s]?e/i, OpenAI],
  [/claude/i, Claude.Color],
  [/grok/i, Grok],
  [/midjourney|\bmj\b/i, Midjourney],
  [/qwen|通义/i, Qwen.Color],
  [/kling|可灵/i, Kling.Color],
  [/vidu/i, Vidu.Color],
  [/hailuo|海螺/i, Hailuo.Color],
  [/minimax/i, Minimax.Color],
  [/banana/i, NanoBanana.Color],
  [/seedream|seedance/i, ByteDance.Color],
  [/doubao|豆包/i, Doubao.Color],
  [/glm|chatglm|智谱|zhipu|z-ai/i, Zhipu.Color],
  [/moonshot|kimi/i, Moonshot],
  [/\bwan\b|wanx/i, Alibaba.Color],
  [/flux/i, Flux],
  [/bria|rmbg/i, BriaAI.Color],
  [/topaz/i, TopazLabs],
];

export function ModelIcon({ name, size = 18, fallback }: { name: string; size?: number; fallback?: string }) {
  for (const [re, Icon] of RULES) {
    if (re.test(name)) return <Icon size={size} />;
  }
  return <span style={{ fontSize: size - 2 }}>{fallback ?? '🧠'}</span>;
}
