import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { SessionStore } from '../db/store';
import { SseHub } from '../council/sseHub';
import { CouncilOrchestrator } from '../council/orchestrator';
import { FakeOpenRouterClient } from '../openrouter/client';
import { createSessionsRouter } from './sessions';
import { COUNCIL_MODELS } from '../../shared/types';

function buildApp() {
  const store = new SessionStore(':memory:');
  const client = new FakeOpenRouterClient();
  for (const model of COUNCIL_MODELS) client.script(model, ['answer. Confidence: 70%']);
  const sseHub = new SseHub();
  const orchestrator = new CouncilOrchestrator(client, store, sseHub);
  const app = express();
  app.use(express.json());
  app.use('/api', createSessionsRouter(store, orchestrator, sseHub));
  return { app, store };
}

describe('sessions routes', () => {
  it('creates a session and returns its id', async () => {
    const { app } = buildApp();
    const res = await request(app).post('/api/sessions').send({ prompt: 'test prompt' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeTypeOf('string');
  });

  it('rejects an empty prompt', async () => {
    const { app } = buildApp();
    const res = await request(app).post('/api/sessions').send({ prompt: '   ' });
    expect(res.status).toBe(400);
  });

  it('lists sessions after creation', async () => {
    const { app } = buildApp();
    await request(app).post('/api/sessions').send({ prompt: 'test prompt' });
    const res = await request(app).get('/api/sessions');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it('returns 404 for a session that does not exist', async () => {
    const { app } = buildApp();
    const res = await request(app).get('/api/sessions/does-not-exist');
    expect(res.status).toBe(404);
  });

  it('rejects a retry for an unknown model', async () => {
    const { app } = buildApp();
    const created = await request(app).post('/api/sessions').send({ prompt: 'test prompt' });
    const res = await request(app).post(`/api/sessions/${created.body.id}/retry/not-a-model?round=1`);
    expect(res.status).toBe(400);
  });
});
