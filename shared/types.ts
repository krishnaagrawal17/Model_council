export type CouncilModelId =
  | 'anthropic/claude-sonnet-5'
  | 'openai/gpt-5.6-luna'
  | '~x-ai/grok-latest'
  | 'google/gemini-3.5-flash-lite';

export const SYNTHESIZER_MODEL_ID = 'anthropic/claude-opus-5' as const;

export const COUNCIL_MODELS: CouncilModelId[] = [
  'anthropic/claude-sonnet-5',
  'openai/gpt-5.6-luna',
  '~x-ai/grok-latest',
  'google/gemini-3.5-flash-lite',
];

export const MODEL_LABELS: Record<CouncilModelId, string> = {
  'anthropic/claude-sonnet-5': 'Claude Sonnet 5',
  'openai/gpt-5.6-luna': 'GPT-5.6 Luna',
  '~x-ai/grok-latest': 'Grok latest',
  'google/gemini-3.5-flash-lite': 'Gemini 3.5 Flash Lite',
};

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export type ModelAnswerStatus = 'ok' | 'no_response';

export interface ModelAnswer {
  model: CouncilModelId;
  status: ModelAnswerStatus;
  text: string;
  confidence: number | null;
}

export interface RoundResult {
  round: 1 | 2 | 3;
  answers: ModelAnswer[];
}

export type AgreementStatus = 'agree' | 'disagree' | 'partial';

export interface VerdictRow {
  model: CouncilModelId;
  finalPosition: string;
  agreement: AgreementStatus;
  confidence: number | null;
}

export type SessionStatus = 'running' | 'complete' | 'error';

export interface Session {
  id: string;
  prompt: string;
  status: SessionStatus;
  rounds: RoundResult[];
  verdictText: string | null;
  verdictTable: VerdictRow[] | null;
  createdAt: string;
  errorMessage: string | null;
}

export type CouncilEvent =
  | { type: 'round_start'; round: 1 | 2 | 3 }
  | { type: 'token'; phase: 1 | 2 | 3 | 'synthesis'; model: CouncilModelId | 'synthesizer'; token: string }
  | { type: 'model_error'; round: 1 | 2 | 3; model: CouncilModelId; message: string }
  | { type: 'round_complete'; round: 1 | 2 | 3; result: RoundResult }
  | { type: 'synthesis_start' }
  | { type: 'session_complete'; verdictText: string; verdictTable: VerdictRow[] }
  | { type: 'session_error'; message: string };
