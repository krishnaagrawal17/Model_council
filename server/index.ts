import 'dotenv/config';
import { createApp } from './app';
import { SessionStore } from './db/store';
import { SseHub } from './council/sseHub';
import { CouncilOrchestrator } from './council/orchestrator';
import { RealOpenRouterClient } from './openrouter/client';

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) {
  throw new Error('OPENROUTER_API_KEY is required. Copy .env.example to .env and fill it in.');
}

const store = new SessionStore(process.env.DB_PATH ?? 'model-council.sqlite');
const sseHub = new SseHub();
const client = new RealOpenRouterClient(apiKey);
const orchestrator = new CouncilOrchestrator(client, store, sseHub);
const app = createApp({ store, orchestrator, sseHub });

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => {
  console.log(`Model Council server listening on port ${port}`);
});
