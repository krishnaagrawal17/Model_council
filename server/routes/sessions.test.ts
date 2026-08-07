import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createServer, get } from 'http';
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

  it('returns 404 for a session that does not exist (GET /sessions/:id)', async () => {
    const { app } = buildApp();
    const res = await request(app).get('/api/sessions/does-not-exist');
    expect(res.status).toBe(404);
  });

  it('returns session details by id', async () => {
    const { app } = buildApp();
    const created = await request(app).post('/api/sessions').send({ prompt: 'test prompt' });
    const res = await request(app).get(`/api/sessions/${created.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.body.id);
    expect(res.body.prompt).toBe('test prompt');
    expect(res.body.status).toBeTypeOf('string');
  });

  it('rejects a retry for an unknown model', async () => {
    const { app } = buildApp();
    const created = await request(app).post('/api/sessions').send({ prompt: 'test prompt' });
    const res = await request(app).post(`/api/sessions/${created.body.id}/retry/not-a-model?round=1`);
    expect(res.status).toBe(400);
  });

  it('rejects a retry with invalid round parameter', async () => {
    const { app } = buildApp();
    const created = await request(app).post('/api/sessions').send({ prompt: 'test prompt' });
    const res = await request(app).post(
      `/api/sessions/${created.body.id}/retry/anthropic%2Fclaude-sonnet-5?round=5`
    );
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('round must be 1, 2, or 3');
  });

  it('rejects a retry with missing round parameter', async () => {
    const { app } = buildApp();
    const created = await request(app).post('/api/sessions').send({ prompt: 'test prompt' });
    const res = await request(app).post(`/api/sessions/${created.body.id}/retry/anthropic%2Fclaude-sonnet-5`);
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('round must be 1, 2, or 3');
  });

  it('returns 404 for retry on unknown session', async () => {
    const { app } = buildApp();
    const res = await request(app).post(
      `/api/sessions/does-not-exist/retry/anthropic%2Fclaude-sonnet-5?round=1`
    );
    expect(res.status).toBe(404);
  });

  it('returns 404 for retry on a round that does not exist', async () => {
    const { app, store } = buildApp();
    const sessionId = 'session-r1-only';
    // Manually create a session with only round 1 to test retrying a non-existent round 2
    store.createSession(sessionId, 'test');
    store.appendRound(sessionId, { round: 1, answers: [] });
    const res = await request(app).post(
      `/api/sessions/${sessionId}/retry/anthropic%2Fclaude-sonnet-5?round=2`
    );
    expect(res.status).toBe(404);
  });

  it('returns 404 when requesting stream for unknown session', async () => {
    const { app } = buildApp();
    const res = await request(app).get('/api/sessions/does-not-exist/stream');
    expect(res.status).toBe(404);
  });

  it('returns 200 with event-stream headers when requesting stream for known session', async () => {
    const { app } = buildApp();
    const created = await request(app).post('/api/sessions').send({ prompt: 'test prompt' });

    // Use Node's HTTP for direct control over streaming response
    return new Promise<void>((resolve, reject) => {
      const server = createServer(app);
      server.listen(0, () => {
        const addr = server.address();
        if (!addr || typeof addr === 'string') return reject(new Error('Invalid server address'));

        const req = get(
          {
            hostname: 'localhost',
            port: addr.port,
            path: `/api/sessions/${created.body.id}/stream`,
          },
          (res) => {
            expect(res.statusCode).toBe(200);
            expect(res.headers['content-type']).toContain('text/event-stream');
            res.destroy(); // Close stream without waiting for it to end
            server.close(() => resolve());
          }
        );
        req.on('error', reject);
        setTimeout(() => {
          req.destroy();
          server.close(() => reject(new Error('Request timeout')));
        }, 1000);
      });
    });
  });

  it('returns 404 when exporting markdown for unknown session', async () => {
    const { app } = buildApp();
    const res = await request(app).get('/api/sessions/does-not-exist/export.md');
    expect(res.status).toBe(404);
  });

  it('exports session as markdown with correct headers', async () => {
    const { app } = buildApp();
    const created = await request(app).post('/api/sessions').send({ prompt: 'test prompt' });
    const res = await request(app).get(`/api/sessions/${created.body.id}/export.md`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/markdown');
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.headers['content-disposition']).toContain(`session-${created.body.id}.md`);
    expect(res.text).toContain('test prompt');
  });
});
