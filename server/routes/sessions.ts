import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import type { SessionStore } from '../db/store';
import type { CouncilOrchestrator } from '../council/orchestrator';
import type { SseHub } from '../council/sseHub';
import { COUNCIL_MODELS } from '../../shared/types';
import type { CouncilModelId } from '../../shared/types';
import { sessionToMarkdown } from './markdown';

export function createSessionsRouter(store: SessionStore, orchestrator: CouncilOrchestrator, sseHub: SseHub): Router {
  const router = Router();

  router.post('/sessions', (req, res) => {
    const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
    if (!prompt) {
      res.status(400).json({ error: 'prompt is required' });
      return;
    }
    const id = randomUUID();
    store.createSession(id, prompt);
    orchestrator.run(id, prompt).catch(() => {
      /* failures are already persisted to the session by the orchestrator */
    });
    res.status(201).json({ id });
  });

  router.get('/sessions/:id/stream', (req, res) => {
    const session = store.getSession(req.params.id);
    if (!session) {
      res.status(404).end();
      return;
    }
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    sseHub.subscribe(req.params.id, res);
  });

  router.post('/sessions/:id/retry/:model', async (req, res) => {
    const model = req.params.model as CouncilModelId;
    if (!COUNCIL_MODELS.includes(model)) {
      res.status(400).json({ error: 'unknown model' });
      return;
    }
    const round = Number(req.query.round);
    if (![1, 2, 3].includes(round)) {
      res.status(400).json({ error: 'round must be 1, 2, or 3' });
      return;
    }
    try {
      const answer = await orchestrator.retryModel(req.params.id, round as 1 | 2 | 3, model);
      res.json(answer);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'retry failed';
      if (message.includes('not found')) {
        res.status(404).json({ error: message });
      } else {
        res.status(500).json({ error: message });
      }
    }
  });

  router.get('/sessions', (_req, res) => {
    res.json(store.listSessions());
  });

  router.get('/sessions/:id', (req, res) => {
    const session = store.getSession(req.params.id);
    if (!session) {
      res.status(404).end();
      return;
    }
    res.json(session);
  });

  router.get('/sessions/:id/export.md', (req, res) => {
    const session = store.getSession(req.params.id);
    if (!session) {
      res.status(404).end();
      return;
    }
    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', `attachment; filename="session-${session.id}.md"`);
    res.send(sessionToMarkdown(session));
  });

  return router;
}
