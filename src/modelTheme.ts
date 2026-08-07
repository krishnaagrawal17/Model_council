import type { CouncilModelId } from '../shared/types';

export interface ModelTheme {
  accent: string;
  bg: string;
  initial: string;
}

export const MODEL_THEME: Record<CouncilModelId, ModelTheme> = {
  'anthropic/claude-sonnet-5': { accent: 'var(--claude)', bg: 'var(--claude-bg)', initial: 'C' },
  'openai/gpt-5.6-luna': { accent: 'var(--gpt)', bg: 'var(--gpt-bg)', initial: 'G' },
  '~x-ai/grok-latest': { accent: 'var(--grok)', bg: 'var(--grok-bg)', initial: 'X' },
  'google/gemini-3.5-flash-lite': { accent: 'var(--gemini)', bg: 'var(--gemini-bg)', initial: 'Ge' },
};

export const SYNTHESIZER_THEME: ModelTheme = { accent: 'var(--synth)', bg: 'var(--synth-bg)', initial: 'S' };

export const AGREEMENT_THEME: Record<string, { accent: string; bg: string }> = {
  agree: { accent: 'var(--agree)', bg: 'var(--agree-bg)' },
  disagree: { accent: 'var(--disagree)', bg: 'var(--disagree-bg)' },
  partial: { accent: 'var(--partial)', bg: 'var(--partial-bg)' },
};
