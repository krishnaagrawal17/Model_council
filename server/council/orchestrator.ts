import type { OpenRouterClient } from '../openrouter/client';
import type { SessionStore } from '../db/store';
import { COUNCIL_MODELS, SYNTHESIZER_MODEL_ID } from '../../shared/types';
import type { CouncilEvent, CouncilModelId, ModelAnswer, RoundResult, ChatMessage } from '../../shared/types';
import {
  buildRound1Messages,
  buildDebateRoundMessages,
  buildConvergenceCheckMessages,
  buildFinalSynthesisMessages,
  parseConfidence,
  parseVerdictTable,
} from './prompts';

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

  async runDebateRound(
    sessionId: string,
    prompt: string,
    round: 2 | 3,
    priorRounds: RoundResult[],
  ): Promise<RoundResult> {
    this.events.emit(sessionId, { type: 'round_start', round });
    const answers = await Promise.all(
      COUNCIL_MODELS.map((model) =>
        this.runModelTurn(sessionId, round, model, buildDebateRoundMessages(prompt, model, priorRounds)),
      ),
    );
    const result: RoundResult = { round, answers };
    this.store.appendRound(sessionId, result);
    this.events.emit(sessionId, { type: 'round_complete', round, result });
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

  async checkConvergence(sessionId: string, prompt: string, rounds: RoundResult[]): Promise<boolean> {
    const text = await this.callSynthesizerWithRetry(
      sessionId,
      buildConvergenceCheckMessages(prompt, rounds),
      'convergence_check',
    );
    return text.trim().toUpperCase().startsWith('CONVERGED');
  }

  protected async callSynthesizerWithRetry(
    sessionId: string,
    messages: ChatMessage[],
    purpose: 'convergence_check' | 'final_synthesis',
    attempts = 3,
  ): Promise<string> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        let text = '';
        for await (const token of this.client.streamChatCompletion(SYNTHESIZER_MODEL_ID, messages)) {
          text += token;
          if (purpose === 'final_synthesis') {
            this.events.emit(sessionId, { type: 'token', phase: 'synthesis', model: 'synthesizer', token });
          }
        }
        return text;
      } catch (err) {
        lastError = err;
        if (attempt < attempts) {
          await new Promise((resolve) => setTimeout(resolve, 200 * attempt));
        }
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  async synthesize(sessionId: string, prompt: string, rounds: RoundResult[]): Promise<void> {
    this.events.emit(sessionId, { type: 'synthesis_start' });
    const text = await this.callSynthesizerWithRetry(
      sessionId,
      buildFinalSynthesisMessages(prompt, rounds),
      'final_synthesis',
    );
    const verdictTable = parseVerdictTable(text, rounds);
    this.store.setVerdict(sessionId, text, verdictTable);
    this.events.emit(sessionId, { type: 'session_complete', verdictText: text, verdictTable });
  }

  async retryModel(sessionId: string, round: 1 | 2 | 3, model: CouncilModelId): Promise<ModelAnswer> {
    const session = this.store.getSession(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    const roundResult = session.rounds.find((r) => r.round === round);
    if (!roundResult) throw new Error(`Round ${round} not found for session ${sessionId}`);

    const priorRounds = session.rounds.filter((r) => r.round < round);
    const messages =
      round === 1 ? buildRound1Messages(session.prompt) : buildDebateRoundMessages(session.prompt, model, priorRounds);

    const updatedAnswer = await this.runModelTurn(sessionId, round, model, messages);
    const updatedAnswers = roundResult.answers.map((a) => (a.model === model ? updatedAnswer : a));
    const updatedRound: RoundResult = { round, answers: updatedAnswers };
    this.store.replaceRound(sessionId, updatedRound);
    this.events.emit(sessionId, { type: 'round_complete', round, result: updatedRound });
    return updatedAnswer;
  }

  async run(sessionId: string, prompt: string): Promise<void> {
    try {
      const round1 = await this.runRound1(sessionId, prompt);
      const rounds: RoundResult[] = [round1];

      const round2 = await this.runDebateRound(sessionId, prompt, 2, rounds);
      rounds.push(round2);

      const converged = await this.checkConvergence(sessionId, prompt, rounds);
      if (!converged) {
        const round3 = await this.runDebateRound(sessionId, prompt, 3, rounds);
        rounds.push(round3);
      }

      await this.synthesize(sessionId, prompt, rounds);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.store.setError(sessionId, message);
      this.events.emit(sessionId, { type: 'session_error', message });
    }
  }
}
