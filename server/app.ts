// server/app.ts
import express from 'express';
import type { SessionStore } from './db/store';
import type { CouncilOrchestrator } from './council/orchestrator';
import type { SseHub } from './council/sseHub';
import { createSessionsRouter } from './routes/sessions';

export interface AppDeps {
  store: SessionStore;
  orchestrator: CouncilOrchestrator;
  sseHub: SseHub;
}

export function createApp(deps: AppDeps): express.Express {
  const app = express();
  app.use(express.json());
  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api', createSessionsRouter(deps.store, deps.orchestrator, deps.sseHub));
  return app;
}
