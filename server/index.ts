import 'dotenv/config';
import { createApp } from './app';
import { SessionStore } from './db/store';
import { SseHub } from './council/sseHub';
import { CouncilOrchestrator } from './council/orchestrator';
import { RealOpenRouterClient } from './openrouter/client';
import { ensureApiKey, stdinPrompter } from './config/apiKey';

async function main() {
  const apiKey = await ensureApiKey(process.env, stdinPrompter, '.env');

  const store = new SessionStore(process.env.DB_PATH ?? 'model-council.sqlite');
  const sseHub = new SseHub();
  const client = new RealOpenRouterClient(apiKey);
  const orchestrator = new CouncilOrchestrator(client, store, sseHub);
  const app = createApp({ store, orchestrator, sseHub });

  const port = Number(process.env.PORT ?? 3001);
  app.listen(port, () => {
    console.log(`Model Council server listening on port ${port}`);
  });
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
