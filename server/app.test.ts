// server/app.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from './app';
import { SessionStore } from './db/store';
import { SseHub } from './council/sseHub';
import { CouncilOrchestrator } from './council/orchestrator';
import { FakeOpenRouterClient } from './openrouter/client';
import { COUNCIL_MODELS } from '../shared/types';

function buildTestApp() {
  const store = new SessionStore(':memory:');
  const client = new FakeOpenRouterClient();
  for (const model of COUNCIL_MODELS) client.script(model, ['answer. Confidence: 70%']);
  const sseHub = new SseHub();
  const orchestrator = new CouncilOrchestrator(client, store, sseHub);
  return createApp({ store, orchestrator, sseHub });
}

describe('createApp', () => {
  it('responds to a health check', async () => {
    const res = await request(buildTestApp()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('mounts the sessions router under /api', async () => {
    const res = await request(buildTestApp()).post('/api/sessions').send({ prompt: 'test prompt' });
    expect(res.status).toBe(201);
  });
});
