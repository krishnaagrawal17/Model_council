import { describe, it, expect } from 'vitest';
import { CouncilOrchestrator } from './orchestrator';
import { FakeOpenRouterClient } from '../openrouter/client';
import { SessionStore } from '../db/store';
import { COUNCIL_MODELS } from '../../shared/types';
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

    const failed = result.answers.find((a) => a.model === COUNCIL_MODELS[1]);
    expect(failed?.status).toBe('no_response');
    expect(events.events.some((e) => e.type === 'model_error' && e.model === COUNCIL_MODELS[1])).toBe(true);
  });
});
