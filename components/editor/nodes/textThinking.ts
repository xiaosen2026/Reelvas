/** 文本节点思考档位 */

export type ThinkingLevel = 'off' | 'low' | 'medium' | 'high';

export const THINKING_LABEL: Record<ThinkingLevel, string> = {
  off: '关闭',
  low: '低',
  medium: '中',
  high: '高',
};

export const THINKING_CYCLE: ThinkingLevel[] = ['off', 'low', 'medium', 'high'];

export const THINKING_TEMP: Record<ThinkingLevel, number> = {
  off: 0.7,
  low: 0.5,
  medium: 0.35,
  high: 0.2,
};

export const THINKING_HINT: Record<ThinkingLevel, string | null> = {
  off: null,
  low: '请简洁作答，抓住要点即可，无需冗长推理。',
  medium: '请先简要梳理思路，再给出清晰、结构化的答案。',
  high: '请进行充分的多步推理与自检，再给出最终答案；关键结论请明确标出。',
};
