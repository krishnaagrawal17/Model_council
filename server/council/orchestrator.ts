import type { OpenRouterClient } from '../openrouter/client';
import type { SessionStore } from '../db/store';
import { COUNCIL_MODELS } from '../../shared/types';
import type { CouncilEvent, CouncilModelId, ModelAnswer, RoundResult, ChatMessage } from '../../shared/types';
import { buildRound1Messages, parseConfidence } from './prompts';

export interface CouncilEventSink {
  emit(sessionId: string, event: CouncilEvent): void;
}

export class CouncilOrchestrator {
  constructor(
    private client: OpenRouterClient,
    private store: SessionStore,
    private events: CouncilEventSink,
  ) {}

  async runRound1(sessionId: string, prompt: string): Promise<RoundResult> {
    this.events.emit(sessionId, { type: 'round_start', round: 1 });
    const answers = await Promise.all(
      COUNCIL_MODELS.map((model) => this.runModelTurn(sessionId, 1, model, buildRound1Messages(prompt))),
    );
    const result: RoundResult = { round: 1, answers };
    this.store.appendRound(sessionId, result);
    this.events.emit(sessionId, { type: 'round_complete', round: 1, result });
    return result;
  }

  protected async runModelTurn(
    sessionId: string,
    round: 1 | 2 | 3,
    model: CouncilModelId,
    messages: ChatMessage[],
  ): Promise<ModelAnswer> {
    try {
      let text = '';
      for await (const token of this.client.streamChatCompletion(model, messages)) {
        text += token;
        this.events.emit(sessionId, { type: 'token', phase: round, model, token });
      }
      return { model, status: 'ok', text, confidence: parseConfidence(text) };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.events.emit(sessionId, { type: 'model_error', round, model, message });
      return { model, status: 'no_response', text: '', confidence: null };
    }
  }
}
