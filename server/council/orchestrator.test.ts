import { describe, it, expect } from 'vitest';
import { CouncilOrchestrator } from './orchestrator';
import { FakeOpenRouterClient } from '../openrouter/client';
import { SessionStore } from '../db/store';
import { COUNCIL_MODELS, SYNTHESIZER_MODEL_ID } from '../../shared/types';
import type { CouncilEvent } from '../../shared/types';

class RecordingEventSink {
  events: CouncilEvent[] = [];
  emit(_sessionId: string, event: CouncilEvent) {
    this.events.push(event);
  }
}

describe('CouncilOrchestrator.runRound1', () => {
  it('collects independent answers from all four council models', async () => {
    const client = new FakeOpenRouterClient();
    for (const model of COUNCIL_MODELS) {
      client.script(model, ['Answer from a model. Confidence: 80%']);
    }
    const store = new SessionStore(':memory:');
    store.createSession('s1', 'Is this a good idea?');
    const orchestrator = new CouncilOrchestrator(client, store, new RecordingEventSink());

    const result = await orchestrator.runRound1('s1', 'Is this a good idea?');

    expect(result.round).toBe(1);
    expect(result.answers).toHaveLength(4);
    expect(result.answers.every((a) => a.status === 'ok')).toBe(true);
    expect(result.answers[0].confidence).toBe(80);
    expect(store.getSession('s1')?.rounds).toHaveLength(1);
  });

  it('marks a model as no_response when it errors, without failing the round', async () => {
    const client = new FakeOpenRouterClient();
    client.script(COUNCIL_MODELS[0], ['ok answer. Confidence: 50%']);
    client.scriptError(COUNCIL_MODELS[1], new Error('timeout'));
    client.script(COUNCIL_MODELS[2], ['ok answer. Confidence: 50%']);
    client.script(COUNCIL_MODELS[3], ['ok answer. Confidence: 50%']);
    const store = new SessionStore(':memory:');
    store.createSession('s1', 'prompt');
    const events = new RecordingEventSink();
    const orchestrator = new CouncilOrchestrator(client, store, events);

    const result = await orchestrator.runRound1('s1', 'prompt');

    // Assert the failed model is marked as no_response
    const failed = result.answers.find((a) => a.model === COUNCIL_MODELS[1]);
    expect(failed?.status).toBe('no_response');
    expect(events.events.some((e) => e.type === 'model_error' && e.model === COUNCIL_MODELS[1])).toBe(true);

    // Assert round still has all 4 answers with 3/4 successful
    expect(result.answers).toHaveLength(4);
    expect(result.answers.filter((a) => a.status === 'ok')).toHaveLength(3);

    // Assert the successful models have expected text and confidence
    const success0 = result.answers.find((a) => a.model === COUNCIL_MODELS[0]);
    expect(success0?.status).toBe('ok');
    expect(success0?.text).toBe('ok answer. Confidence: 50%');
    expect(success0?.confidence).toBe(50);

    const success2 = result.answers.find((a) => a.model === COUNCIL_MODELS[2]);
    expect(success2?.status).toBe('ok');
    expect(success2?.text).toBe('ok answer. Confidence: 50%');
    expect(success2?.confidence).toBe(50);

    const success3 = result.answers.find((a) => a.model === COUNCIL_MODELS[3]);
    expect(success3?.status).toBe('ok');
    expect(success3?.text).toBe('ok answer. Confidence: 50%');
    expect(success3?.confidence).toBe(50);
  });

  it('accumulates multi-token responses and parses confidence from full text', async () => {
    const client = new FakeOpenRouterClient();
    // Script model 0 with multiple token chunks to test accumulation
    client.script(COUNCIL_MODELS[0], ['Some ans', 'wer text. ', 'Confidence: 80%']);
    client.script(COUNCIL_MODELS[1], ['Single token response. Confidence: 60%']);
    client.script(COUNCIL_MODELS[2], ['Another ', 'multi-token ', 'response. Confidence: 70%']);
    client.script(COUNCIL_MODELS[3], ['Last model. Confidence: 75%']);
    const store = new SessionStore(':memory:');
    store.createSession('s1', 'prompt');
    const orchestrator = new CouncilOrchestrator(client, store, new RecordingEventSink());

    const result = await orchestrator.runRound1('s1', 'prompt');

    // Verify model 0 with 3 tokens accumulated correctly
    const answer0 = result.answers.find((a) => a.model === COUNCIL_MODELS[0]);
    expect(answer0?.status).toBe('ok');
    expect(answer0?.text).toBe('Some answer text. Confidence: 80%');
    expect(answer0?.confidence).toBe(80);

    // Verify model 2 with 3 tokens accumulated correctly
    const answer2 = result.answers.find((a) => a.model === COUNCIL_MODELS[2]);
    expect(answer2?.status).toBe('ok');
    expect(answer2?.text).toBe('Another multi-token response. Confidence: 70%');
    expect(answer2?.confidence).toBe(70);

    // All answers present and successful
    expect(result.answers).toHaveLength(4);
    expect(result.answers.every((a) => a.status === 'ok')).toBe(true);
  });
});

describe('CouncilOrchestrator.runDebateRound', () => {
  it("gives each model the other three's Round 1 answers and produces a Round 2 result", async () => {
    const client = new FakeOpenRouterClient();
    for (const model of COUNCIL_MODELS) {
      client.script(model, [`r1 from ${model}. Confidence: 50%`]);
      client.script(model, [`r2 from ${model}. Confidence: 70%`]);
    }
    const store = new SessionStore(':memory:');
    store.createSession('s1', 'prompt');
    const orchestrator = new CouncilOrchestrator(client, store, new RecordingEventSink());

    const round1 = await orchestrator.runRound1('s1', 'prompt');
    const round2 = await orchestrator.runDebateRound('s1', 'prompt', 2, [round1]);

    expect(round2.round).toBe(2);
    expect(round2.answers).toHaveLength(4);
    expect(round2.answers[0].confidence).toBe(70);
    expect(store.getSession('s1')?.rounds).toHaveLength(2);

    // Verify cross-model context: Round 2 calls should include other models' Round 1 answers
    const round2Calls = client.calls.slice(4); // First 4 calls are Round 1, next 4 are Round 2
    const model0Round2Call = round2Calls.find((call) => call.model === COUNCIL_MODELS[0]);
    expect(model0Round2Call).toBeDefined();
    const messagesText = JSON.stringify(model0Round2Call?.messages);
    // Verify that another model's Round 1 answer is present in the messages
    expect(messagesText).toContain(`r1 from ${COUNCIL_MODELS[1]}`);
  });
});

describe('CouncilOrchestrator.checkConvergence', () => {
  it('returns true when the synthesizer responds CONVERGED', async () => {
    const client = new FakeOpenRouterClient();
    client.script(SYNTHESIZER_MODEL_ID, ['CONVERGED. Reasoning here.']);
    const store = new SessionStore(':memory:');
    store.createSession('s1', 'prompt');
    const orchestrator = new CouncilOrchestrator(client, store, new RecordingEventSink());

    const rounds = [
      {
        round: 1 as const,
        answers: COUNCIL_MODELS.map((m) => ({ model: m, status: 'ok' as const, text: 'a', confidence: 50 })),
      },
    ];
    const converged = await orchestrator.checkConvergence('s1', 'prompt', rounds);
    expect(converged).toBe(true);
  });

  it('returns false when the synthesizer responds NOT_CONVERGED', async () => {
    const client = new FakeOpenRouterClient();
    client.script(SYNTHESIZER_MODEL_ID, ['NOT_CONVERGED. Still disagreement.']);
    const store = new SessionStore(':memory:');
    store.createSession('s1', 'prompt');
    const orchestrator = new CouncilOrchestrator(client, store, new RecordingEventSink());

    const rounds = [
      {
        round: 1 as const,
        answers: COUNCIL_MODELS.map((m) => ({ model: m, status: 'ok' as const, text: 'a', confidence: 50 })),
      },
    ];
    const converged = await orchestrator.checkConvergence('s1', 'prompt', rounds);
    expect(converged).toBe(false);
  });

  it('retries the synthesizer call on failure before giving up', async () => {
    const client = new FakeOpenRouterClient();
    client.scriptError(SYNTHESIZER_MODEL_ID, new Error('rate limited'));
    client.script(SYNTHESIZER_MODEL_ID, ['CONVERGED. Recovered.']);
    const store = new SessionStore(':memory:');
    store.createSession('s1', 'prompt');
    const orchestrator = new CouncilOrchestrator(client, store, new RecordingEventSink());

    const rounds = [
      {
        round: 1 as const,
        answers: COUNCIL_MODELS.map((m) => ({ model: m, status: 'ok' as const, text: 'a', confidence: 50 })),
      },
    ];
    const converged = await orchestrator.checkConvergence('s1', 'prompt', rounds);
    expect(converged).toBe(true);
  });
});
