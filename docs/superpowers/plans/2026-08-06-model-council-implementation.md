# Model Council Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local web app that runs a prompt through a council of four LLMs (via OpenRouter), lets them debate across up to three rounds, and has a synthesizer model produce a final verdict with a per-model agreement/confidence table — streamed live, persisted, and exportable as Markdown.

**Architecture:** Node/Express backend orchestrates concurrent streaming calls to OpenRouter and multiplexes every model's tokens onto one Server-Sent Events connection per session; a React/Vite/TypeScript frontend renders the live debate and reads/writes session state through a small JSON API. SQLite (`better-sqlite3`) persists sessions as a single local file.

**Tech Stack:** TypeScript, Node.js, Express, React 18, Vite, `better-sqlite3`, Vitest, `@testing-library/react`, `supertest`, `tsx`, `concurrently`.

## Global Constraints

- All models are called through OpenRouter using these exact IDs — council: `anthropic/claude-sonnet-5`, `openai/gpt-5.6-luna`, `x-ai/grok-latest`, `google/gemini-3.5-flash-lite`; synthesizer: `anthropic/claude-opus-5`.
- Debate rounds show real model names to each other — never anonymize.
- Hard cap of 3 rounds. Round 3 only runs if the synthesizer's convergence check after Round 2 reports `NOT_CONVERGED`.
- A council model that errors or times out is marked `no_response` for that round, excluded from the context built for later rounds, and never blocks the round from completing.
- Synthesizer calls (convergence check, final synthesis) get automatic retry with backoff on failure — there is no verdict without them, unlike a single council model's answer.
- Automated tests never call real OpenRouter — always use `FakeOpenRouterClient`. One real end-to-end smoke test against live OpenRouter is a manual, documented step run once during implementation (Task 17), not part of `npm test`.
- Persistence is a single local SQLite file via `better-sqlite3` — no external database server.
- Single local user; no authentication anywhere in the app.
- Everything (code, config, docs, git history) lives inside `model_council/`; nothing is created or modified outside it.

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Create: `.env.example`
- Create: `.gitignore` (append to existing if present)
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `server/app.ts`
- Create: `server/index.ts`
- Test: `src/App.test.tsx`
- Test: `server/app.test.ts`

**Interfaces:**
- Produces: `createApp(): express.Express` (health check only for now — gains real dependencies in Task 17), `App()` React component rendering the text "Model Council".

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "model-council",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "concurrently \"npm:dev:server\" \"npm:dev:client\"",
    "dev:server": "tsx watch server/index.ts",
    "dev:client": "vite",
    "build": "vite build",
    "test": "vitest run"
  },
  "dependencies": {
    "express": "^4.19.2",
    "better-sqlite3": "^11.3.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "typescript": "^5.5.4",
    "vite": "^5.4.0",
    "@vitejs/plugin-react": "^4.3.1",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@types/express": "^4.17.21",
    "@types/better-sqlite3": "^7.6.11",
    "@types/node": "^22.5.0",
    "@types/supertest": "^6.0.2",
    "vitest": "^2.0.5",
    "jsdom": "^25.0.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.4.8",
    "supertest": "^7.0.0",
    "tsx": "^4.19.0",
    "concurrently": "^8.2.2"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`
Expected: installs without errors, creates `node_modules/` and `package-lock.json`.

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM"],
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true
  },
  "include": ["src", "server", "shared", "vitest.config.ts", "vite.config.ts"]
}
```

- [ ] **Step 4: Create `vite.config.ts`**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
```

- [ ] **Step 5: Create `vitest.config.ts` and `vitest.setup.ts`**

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
  },
});
```

`vitest.setup.ts`:
```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 6: Create `.env.example` and update `.gitignore`**

`.env.example`:
```
OPENROUTER_API_KEY=
PORT=3001
```

Append to `.gitignore`:
```
node_modules
dist
*.sqlite
.env
```

- [ ] **Step 7: Create the Vite entry point**

`index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Model Council</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/main.tsx`:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

`src/App.tsx`:
```tsx
export function App() {
  return <div>Model Council</div>;
}
```

- [ ] **Step 8: Write the failing tests**

`src/App.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from './App';

describe('App', () => {
  it('renders the app title', () => {
    render(<App />);
    expect(screen.getByText('Model Council')).toBeInTheDocument();
  });
});
```

`server/app.ts`:
```ts
import express from 'express';

export function createApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  return app;
}
```

`server/index.ts`:
```ts
import { createApp } from './app';

const port = Number(process.env.PORT ?? 3001);
createApp().listen(port, () => {
  console.log(`Model Council server listening on port ${port}`);
});
```

`server/app.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from './app';

describe('createApp', () => {
  it('responds to a health check', async () => {
    const res = await request(createApp()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
```

- [ ] **Step 9: Run the tests**

Run: `npm test`
Expected: PASS (both `App` and `createApp` tests green — this task has no red/green cycle since the implementation was written alongside the test; confirm both pass together).

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts vitest.config.ts vitest.setup.ts .env.example .gitignore index.html src/main.tsx src/App.tsx src/App.test.tsx server/app.ts server/index.ts server/app.test.ts
git commit -m "chore: scaffold project (Vite/React frontend, Express backend, Vitest)"
```

---

### Task 2: Shared Types & Model Roster

**Files:**
- Create: `shared/types.ts`
- Test: `shared/types.test.ts`

**Interfaces:**
- Produces: `CouncilModelId`, `SYNTHESIZER_MODEL_ID`, `COUNCIL_MODELS`, `MODEL_LABELS`, `ChatMessage`, `ModelAnswerStatus`, `ModelAnswer`, `RoundResult`, `AgreementStatus`, `VerdictRow`, `SessionStatus`, `Session`, `CouncilEvent` — the shared contract every later task imports from `shared/types`.

- [ ] **Step 1: Write the failing test**

```ts
// shared/types.test.ts
import { describe, it, expect } from 'vitest';
import { COUNCIL_MODELS, MODEL_LABELS, SYNTHESIZER_MODEL_ID } from './types';

describe('model roster', () => {
  it('has exactly four council models, each with a label', () => {
    expect(COUNCIL_MODELS).toHaveLength(4);
    for (const model of COUNCIL_MODELS) {
      expect(MODEL_LABELS[model]).toBeTruthy();
    }
  });

  it('does not include the synthesizer in the council roster', () => {
    expect(COUNCIL_MODELS).not.toContain(SYNTHESIZER_MODEL_ID);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run shared/types.test.ts`
Expected: FAIL with "Cannot find module './types'" (file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

```ts
// shared/types.ts
export type CouncilModelId =
  | 'anthropic/claude-sonnet-5'
  | 'openai/gpt-5.6-luna'
  | 'x-ai/grok-latest'
  | 'google/gemini-3.5-flash-lite';

export const SYNTHESIZER_MODEL_ID = 'anthropic/claude-opus-5' as const;

export const COUNCIL_MODELS: CouncilModelId[] = [
  'anthropic/claude-sonnet-5',
  'openai/gpt-5.6-luna',
  'x-ai/grok-latest',
  'google/gemini-3.5-flash-lite',
];

export const MODEL_LABELS: Record<CouncilModelId, string> = {
  'anthropic/claude-sonnet-5': 'Claude Sonnet 5',
  'openai/gpt-5.6-luna': 'GPT-5.6 Luna',
  'x-ai/grok-latest': 'Grok latest',
  'google/gemini-3.5-flash-lite': 'Gemini 3.5 Flash Lite',
};

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export type ModelAnswerStatus = 'ok' | 'no_response';

export interface ModelAnswer {
  model: CouncilModelId;
  status: ModelAnswerStatus;
  text: string;
  confidence: number | null;
}

export interface RoundResult {
  round: 1 | 2 | 3;
  answers: ModelAnswer[];
}

export type AgreementStatus = 'agree' | 'disagree' | 'partial';

export interface VerdictRow {
  model: CouncilModelId;
  finalPosition: string;
  agreement: AgreementStatus;
  confidence: number | null;
}

export type SessionStatus = 'running' | 'complete' | 'error';

export interface Session {
  id: string;
  prompt: string;
  status: SessionStatus;
  rounds: RoundResult[];
  verdictText: string | null;
  verdictTable: VerdictRow[] | null;
  createdAt: string;
  errorMessage: string | null;
}

export type CouncilEvent =
  | { type: 'round_start'; round: 1 | 2 | 3 }
  | { type: 'token'; phase: 1 | 2 | 3 | 'synthesis'; model: CouncilModelId | 'synthesizer'; token: string }
  | { type: 'model_error'; round: 1 | 2 | 3; model: CouncilModelId; message: string }
  | { type: 'round_complete'; round: 1 | 2 | 3; result: RoundResult }
  | { type: 'synthesis_start' }
  | { type: 'session_complete'; verdictText: string; verdictTable: VerdictRow[] }
  | { type: 'session_error'; message: string };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run shared/types.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add shared/types.ts shared/types.test.ts
git commit -m "feat: add shared types and confirmed OpenRouter model roster"
```

---

### Task 3: OpenRouter Client

**Files:**
- Create: `server/openrouter/client.ts`
- Test: `server/openrouter/client.test.ts`

**Interfaces:**
- Consumes: `ChatMessage` from `shared/types`.
- Produces: `OpenRouterClient` interface with `streamChatCompletion(model: string, messages: ChatMessage[]): AsyncGenerator<string, void, unknown>`; `RealOpenRouterClient` (real fetch-based implementation); `FakeOpenRouterClient` with `script(model, tokens: string[])` and `scriptError(model, error: Error)` (queued per model, consumed in call order — used by every later test that needs a scripted model response).

- [ ] **Step 1: Write the failing tests**

```ts
// server/openrouter/client.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { RealOpenRouterClient, FakeOpenRouterClient } from './client';

function chunksToStream(chunks: string[]) {
  const encoder = new TextEncoder();
  let i = 0;
  return {
    getReader() {
      return {
        read: async () => {
          if (i >= chunks.length) return { done: true, value: undefined };
          const value = encoder.encode(chunks[i]);
          i += 1;
          return { done: false, value };
        },
      };
    },
  };
}

describe('RealOpenRouterClient', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('yields content deltas parsed from SSE chunks', async () => {
    const sse = [
      'data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"lo"}}]}\n\n',
      'data: [DONE]\n\n',
    ].join('');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, body: chunksToStream([sse]) }),
    );

    const client = new RealOpenRouterClient('test-key');
    const tokens: string[] = [];
    for await (const token of client.streamChatCompletion('some/model', [{ role: 'user', content: 'hi' }])) {
      tokens.push(token);
    }
    expect(tokens).toEqual(['Hel', 'lo']);
  });

  it('throws when the response is not ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500, statusText: 'Server Error', body: null }),
    );
    const client = new RealOpenRouterClient('test-key');
    await expect(async () => {
      for await (const _token of client.streamChatCompletion('some/model', [])) {
        // draining the generator to trigger the throw
      }
    }).rejects.toThrow('OpenRouter request failed: 500 Server Error');
  });
});

describe('FakeOpenRouterClient', () => {
  it('yields the scripted tokens for a model', async () => {
    const client = new FakeOpenRouterClient();
    client.script('some/model', ['a', 'b', 'c']);
    const tokens: string[] = [];
    for await (const token of client.streamChatCompletion('some/model', [])) {
      tokens.push(token);
    }
    expect(tokens).toEqual(['a', 'b', 'c']);
  });

  it('consumes queued scripts in order across repeated calls to the same model', async () => {
    const client = new FakeOpenRouterClient();
    client.script('some/model', ['first']);
    client.script('some/model', ['second']);

    const firstCall: string[] = [];
    for await (const token of client.streamChatCompletion('some/model', [])) firstCall.push(token);
    const secondCall: string[] = [];
    for await (const token of client.streamChatCompletion('some/model', [])) secondCall.push(token);

    expect(firstCall).toEqual(['first']);
    expect(secondCall).toEqual(['second']);
  });

  it('throws the scripted error for a model', async () => {
    const client = new FakeOpenRouterClient();
    client.scriptError('some/model', new Error('boom'));
    await expect(async () => {
      for await (const _token of client.streamChatCompletion('some/model', [])) {
        // draining the generator to trigger the throw
      }
    }).rejects.toThrow('boom');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run server/openrouter/client.test.ts`
Expected: FAIL with "Cannot find module './client'".

- [ ] **Step 3: Write the implementation**

```ts
// server/openrouter/client.ts
import type { ChatMessage } from '../../shared/types';

export interface OpenRouterClient {
  streamChatCompletion(model: string, messages: ChatMessage[]): AsyncGenerator<string, void, unknown>;
}

export class RealOpenRouterClient implements OpenRouterClient {
  constructor(private apiKey: string) {}

  async *streamChatCompletion(model: string, messages: ChatMessage[]): AsyncGenerator<string, void, unknown> {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, messages, stream: true }),
    });

    if (!response.ok || !response.body) {
      throw new Error(`OpenRouter request failed: ${response.status} ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice('data: '.length).trim();
        if (data === '[DONE]') return;
        const parsed = JSON.parse(data);
        const delta: string | undefined = parsed.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      }
    }
  }
}

export class FakeOpenRouterClient implements OpenRouterClient {
  private queues = new Map<string, (string[] | Error)[]>();

  script(model: string, tokens: string[]): void {
    const queue = this.queues.get(model) ?? [];
    queue.push(tokens);
    this.queues.set(model, queue);
  }

  scriptError(model: string, error: Error): void {
    const queue = this.queues.get(model) ?? [];
    queue.push(error);
    this.queues.set(model, queue);
  }

  async *streamChatCompletion(model: string): AsyncGenerator<string, void, unknown> {
    const queue = this.queues.get(model);
    const next = queue?.shift();
    if (!next) throw new Error(`No script configured for model: ${model}`);
    if (next instanceof Error) throw next;
    for (const token of next) yield token;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/openrouter/client.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/openrouter/client.ts server/openrouter/client.test.ts
git commit -m "feat: add OpenRouter streaming client with a scriptable fake for tests"
```

---

### Task 4: Session Store (SQLite)

**Files:**
- Create: `server/db/store.ts`
- Test: `server/db/store.test.ts`

**Interfaces:**
- Consumes: `Session`, `RoundResult`, `VerdictRow` from `shared/types`.
- Produces: `SessionStore` with `createSession(id, prompt)`, `appendRound(id, result)`, `setVerdict(id, verdictText, verdictTable)`, `setError(id, message)`, `getSession(id): Session | null`, `listSessions(): Session[]`.

- [ ] **Step 1: Write the failing test**

```ts
// server/db/store.test.ts
import { describe, it, expect } from 'vitest';
import { SessionStore } from './store';

describe('SessionStore', () => {
  it('creates a session and retrieves it with defaults', () => {
    const store = new SessionStore(':memory:');
    store.createSession('s1', 'Is this a good idea?');
    const session = store.getSession('s1');
    expect(session).toMatchObject({
      id: 's1',
      prompt: 'Is this a good idea?',
      status: 'running',
      rounds: [],
      verdictText: null,
      verdictTable: null,
      errorMessage: null,
    });
  });

  it('appends rounds in order', () => {
    const store = new SessionStore(':memory:');
    store.createSession('s1', 'prompt');
    store.appendRound('s1', { round: 1, answers: [] });
    store.appendRound('s1', { round: 2, answers: [] });
    const session = store.getSession('s1');
    expect(session?.rounds.map((r) => r.round)).toEqual([1, 2]);
  });

  it('sets the verdict and marks the session complete', () => {
    const store = new SessionStore(':memory:');
    store.createSession('s1', 'prompt');
    store.setVerdict('s1', 'Final answer', [
      { model: 'anthropic/claude-sonnet-5', finalPosition: 'x', agreement: 'agree', confidence: 90 },
    ]);
    const session = store.getSession('s1');
    expect(session?.status).toBe('complete');
    expect(session?.verdictText).toBe('Final answer');
    expect(session?.verdictTable).toHaveLength(1);
  });

  it('sets an error and marks the session errored', () => {
    const store = new SessionStore(':memory:');
    store.createSession('s1', 'prompt');
    store.setError('s1', 'synthesizer failed');
    const session = store.getSession('s1');
    expect(session?.status).toBe('error');
    expect(session?.errorMessage).toBe('synthesizer failed');
  });

  it('lists sessions newest first', () => {
    const store = new SessionStore(':memory:');
    store.createSession('s1', 'first');
    store.createSession('s2', 'second');
    const sessions = store.listSessions();
    expect(sessions.map((s) => s.id)).toEqual(['s2', 's1']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/db/store.test.ts`
Expected: FAIL with "Cannot find module './store'".

- [ ] **Step 3: Write the implementation**

```ts
// server/db/store.ts
import Database from 'better-sqlite3';
import type { Session, RoundResult, VerdictRow } from '../../shared/types';

export class SessionStore {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        prompt TEXT NOT NULL,
        status TEXT NOT NULL,
        rounds_json TEXT NOT NULL,
        verdict_text TEXT,
        verdict_table_json TEXT,
        error_message TEXT,
        created_at TEXT NOT NULL
      )
    `);
  }

  createSession(id: string, prompt: string): void {
    this.db
      .prepare(
        `INSERT INTO sessions (id, prompt, status, rounds_json, verdict_text, verdict_table_json, error_message, created_at)
         VALUES (?, ?, 'running', '[]', NULL, NULL, NULL, ?)`,
      )
      .run(id, prompt, new Date().toISOString());
  }

  appendRound(id: string, result: RoundResult): void {
    const session = this.getSession(id);
    if (!session) throw new Error(`Session not found: ${id}`);
    const rounds = [...session.rounds, result];
    this.db.prepare(`UPDATE sessions SET rounds_json = ? WHERE id = ?`).run(JSON.stringify(rounds), id);
  }

  setVerdict(id: string, verdictText: string, verdictTable: VerdictRow[]): void {
    this.db
      .prepare(`UPDATE sessions SET status = 'complete', verdict_text = ?, verdict_table_json = ? WHERE id = ?`)
      .run(verdictText, JSON.stringify(verdictTable), id);
  }

  setError(id: string, message: string): void {
    this.db.prepare(`UPDATE sessions SET status = 'error', error_message = ? WHERE id = ?`).run(message, id);
  }

  getSession(id: string): Session | null {
    const row = this.db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(id) as any;
    if (!row) return null;
    return rowToSession(row);
  }

  listSessions(): Session[] {
    const rows = this.db.prepare(`SELECT * FROM sessions ORDER BY created_at DESC`).all() as any[];
    return rows.map(rowToSession);
  }
}

function rowToSession(row: any): Session {
  return {
    id: row.id,
    prompt: row.prompt,
    status: row.status,
    rounds: JSON.parse(row.rounds_json),
    verdictText: row.verdict_text,
    verdictTable: row.verdict_table_json ? JSON.parse(row.verdict_table_json) : null,
    createdAt: row.created_at,
    errorMessage: row.error_message,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/db/store.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/db/store.ts server/db/store.test.ts
git commit -m "feat: add SQLite-backed SessionStore"
```

---

### Task 5: Prompt Builders & Response Parsers

**Files:**
- Create: `server/council/prompts.ts`
- Test: `server/council/prompts.test.ts`

**Interfaces:**
- Consumes: `ChatMessage`, `CouncilModelId`, `MODEL_LABELS`, `COUNCIL_MODELS`, `RoundResult`, `VerdictRow` from `shared/types`.
- Produces: `buildRound1Messages(prompt)`, `buildDebateRoundMessages(prompt, selfModel, priorRounds)`, `buildConvergenceCheckMessages(prompt, rounds)`, `buildFinalSynthesisMessages(prompt, rounds)`, `parseConfidence(text): number | null`, `parseVerdictTable(synthesisText, rounds): VerdictRow[]` — consumed by `CouncilOrchestrator` starting Task 6.

- [ ] **Step 1: Write the failing test**

```ts
// server/council/prompts.test.ts
import { describe, it, expect } from 'vitest';
import {
  buildRound1Messages,
  buildDebateRoundMessages,
  buildConvergenceCheckMessages,
  buildFinalSynthesisMessages,
  parseConfidence,
  parseVerdictTable,
} from './prompts';
import { COUNCIL_MODELS, MODEL_LABELS } from '../../shared/types';
import type { RoundResult } from '../../shared/types';

describe('buildRound1Messages', () => {
  it('asks the model to answer independently and state a confidence', () => {
    const messages = buildRound1Messages('Should we ship this?');
    expect(messages[messages.length - 1]).toEqual({ role: 'user', content: 'Should we ship this?' });
    expect(messages.some((m) => m.content.includes('Confidence'))).toBe(true);
  });
});

describe('buildDebateRoundMessages', () => {
  it("includes the other models' latest answers by name, excluding the model's own", () => {
    const round1: RoundResult = {
      round: 1,
      answers: COUNCIL_MODELS.map((model, i) => ({
        model,
        status: 'ok',
        text: `answer-${i}`,
        confidence: 50,
      })),
    };
    const self = COUNCIL_MODELS[0];
    const messages = buildDebateRoundMessages('prompt', self, [round1]);
    const combined = messages.map((m) => m.content).join('\n');
    expect(combined).not.toContain('answer-0');
    expect(combined).toContain(MODEL_LABELS[COUNCIL_MODELS[1]]);
    expect(combined).toContain('answer-1');
  });

  it('excludes models that had no_response in the latest round', () => {
    const round1: RoundResult = {
      round: 1,
      answers: [
        { model: COUNCIL_MODELS[0], status: 'ok', text: 'self', confidence: 50 },
        { model: COUNCIL_MODELS[1], status: 'no_response', text: '', confidence: null },
      ],
    };
    const messages = buildDebateRoundMessages('prompt', COUNCIL_MODELS[0], [round1]);
    const combined = messages.map((m) => m.content).join('\n');
    expect(combined).not.toContain(MODEL_LABELS[COUNCIL_MODELS[1]]);
  });
});

describe('buildConvergenceCheckMessages and buildFinalSynthesisMessages', () => {
  it('include the full transcript across all provided rounds', () => {
    const rounds: RoundResult[] = [
      { round: 1, answers: [{ model: COUNCIL_MODELS[0], status: 'ok', text: 'r1 answer', confidence: 50 }] },
      { round: 2, answers: [{ model: COUNCIL_MODELS[0], status: 'ok', text: 'r2 answer', confidence: 60 }] },
    ];
    const convergence = buildConvergenceCheckMessages('prompt', rounds).map((m) => m.content).join('\n');
    expect(convergence).toContain('r1 answer');
    expect(convergence).toContain('r2 answer');

    const synthesis = buildFinalSynthesisMessages('prompt', rounds).map((m) => m.content).join('\n');
    expect(synthesis).toContain('r1 answer');
    expect(synthesis).toContain('r2 answer');
  });
});

describe('parseConfidence', () => {
  it('extracts a confidence percentage from trailing text', () => {
    expect(parseConfidence('Some answer.\nConfidence: 85%')).toBe(85);
  });

  it('returns null when no confidence line is present', () => {
    expect(parseConfidence('Some answer with no confidence line.')).toBeNull();
  });

  it('clamps out-of-range values into 0-100', () => {
    expect(parseConfidence('Confidence: 150%')).toBe(100);
  });
});

describe('parseVerdictTable', () => {
  it('parses agreement rows and attaches each model\'s final-round position and confidence', () => {
    const rounds: RoundResult[] = [
      {
        round: 2,
        answers: COUNCIL_MODELS.map((model) => ({ model, status: 'ok', text: `final-${model}`, confidence: 77 })),
      },
    ];
    const verdictLines = COUNCIL_MODELS.map((m) => `${MODEL_LABELS[m]} | agree`).join('\n');
    const text = `Verdict text here.\n\nVERDICT_TABLE:\n${verdictLines}`;
    const table = parseVerdictTable(text, rounds);
    expect(table).toHaveLength(4);
    expect(table[0].agreement).toBe('agree');
    expect(table[0].confidence).toBe(77);
    expect(table[0].finalPosition).toBe(`final-${COUNCIL_MODELS[0]}`);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/council/prompts.test.ts`
Expected: FAIL with "Cannot find module './prompts'".

- [ ] **Step 3: Write the implementation**

```ts
// server/council/prompts.ts
import { COUNCIL_MODELS, MODEL_LABELS } from '../../shared/types';
import type { ChatMessage, CouncilModelId, RoundResult, VerdictRow } from '../../shared/types';

const CONFIDENCE_INSTRUCTION =
  'End your answer with a line in exactly this format: "Confidence: N%" where N is 0-100.';

export function buildRound1Messages(prompt: string): ChatMessage[] {
  return [
    {
      role: 'system',
      content: `Answer the following question with your own independent reasoning. ${CONFIDENCE_INSTRUCTION}`,
    },
    { role: 'user', content: prompt },
  ];
}

export function buildDebateRoundMessages(
  prompt: string,
  selfModel: CouncilModelId,
  priorRounds: RoundResult[],
): ChatMessage[] {
  const latestRound = priorRounds[priorRounds.length - 1];
  const others = latestRound.answers.filter((a) => a.model !== selfModel && a.status === 'ok');
  const othersText = others.map((a) => `${MODEL_LABELS[a.model]} said:\n${a.text}`).join('\n\n');
  return [
    {
      role: 'system',
      content:
        'You are debating with other AI models on the question below. Consider their reasoning, then state ' +
        `whether you agree, disagree, or partially agree, and why. You may revise your position or hold it. ${CONFIDENCE_INSTRUCTION}`,
    },
    { role: 'user', content: `Question: ${prompt}` },
    { role: 'user', content: `Other models' answers:\n\n${othersText}` },
  ];
}

function fullTranscript(rounds: RoundResult[]): string {
  return rounds
    .map((r) =>
      r.answers
        .filter((a) => a.status === 'ok')
        .map((a) => `[Round ${r.round}] ${MODEL_LABELS[a.model]}: ${a.text}`)
        .join('\n'),
    )
    .join('\n\n');
}

export function buildConvergenceCheckMessages(prompt: string, rounds: RoundResult[]): ChatMessage[] {
  return [
    {
      role: 'system',
      content:
        'You are judging whether a panel of AI models has converged on the question below. Respond with exactly ' +
        'one line: "CONVERGED" or "NOT_CONVERGED", followed by one sentence of reasoning.',
    },
    { role: 'user', content: `Question: ${prompt}\n\nDebate transcript:\n${fullTranscript(rounds)}` },
  ];
}

export function buildFinalSynthesisMessages(prompt: string, rounds: RoundResult[]): ChatMessage[] {
  return [
    {
      role: 'system',
      content:
        'You are the synthesizer for a council of AI models. Write a final verdict answering the question, ' +
        'drawing on the debate transcript below. After your verdict, include a section starting with exactly ' +
        '"VERDICT_TABLE:" followed by one line per model in the format ' +
        '"<Model Name> | agree|disagree|partial" reflecting whether that model\'s final position agrees with your verdict.',
    },
    { role: 'user', content: `Question: ${prompt}\n\nDebate transcript:\n${fullTranscript(rounds)}` },
  ];
}

export function parseConfidence(text: string): number | null {
  const match = text.match(/Confidence:\s*(\d{1,3})%/i);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : null;
}

export function parseVerdictTable(synthesisText: string, rounds: RoundResult[]): VerdictRow[] {
  const marker = 'VERDICT_TABLE:';
  const idx = synthesisText.indexOf(marker);
  const tableSection = idx >= 0 ? synthesisText.slice(idx + marker.length) : '';
  const lastRound = rounds[rounds.length - 1];
  const labelToModel = new Map(COUNCIL_MODELS.map((m) => [MODEL_LABELS[m], m]));

  const rows: VerdictRow[] = [];
  for (const line of tableSection.split('\n')) {
    const match = line.match(/^\s*([A-Za-z0-9 .\-]+?)\s*\|\s*(agree|disagree|partial)\s*$/i);
    if (!match) continue;
    const model = labelToModel.get(match[1].trim());
    if (!model) continue;
    const answer = lastRound.answers.find((a) => a.model === model);
    rows.push({
      model,
      finalPosition: answer?.text ?? '',
      agreement: match[2].toLowerCase() as VerdictRow['agreement'],
      confidence: answer?.confidence ?? null,
    });
  }
  return rows;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/council/prompts.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/council/prompts.ts server/council/prompts.test.ts
git commit -m "feat: add round prompt builders and confidence/verdict parsers"
```

---

### Task 6: Council Orchestrator — Round 1

**Files:**
- Create: `server/council/orchestrator.ts`
- Test: `server/council/orchestrator.test.ts`

**Interfaces:**
- Consumes: `OpenRouterClient`, `FakeOpenRouterClient` from `server/openrouter/client`; `SessionStore` from `server/db/store`; `buildRound1Messages`, `parseConfidence` from `server/council/prompts`; `COUNCIL_MODELS`, `CouncilModelId`, `CouncilEvent`, `ModelAnswer`, `RoundResult` from `shared/types`.
- Produces: `CouncilEventSink` interface (`emit(sessionId, event)`); `CouncilOrchestrator` class with `runRound1(sessionId, prompt): Promise<RoundResult>` and a private `runModelTurn` used by every later orchestrator task.

- [ ] **Step 1: Write the failing test**

```ts
// server/council/orchestrator.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/council/orchestrator.test.ts`
Expected: FAIL with "Cannot find module './orchestrator'".

- [ ] **Step 3: Write the implementation**

```ts
// server/council/orchestrator.ts
import type { OpenRouterClient } from '../openrouter/client';
import type { SessionStore } from '../db/store';
import { COUNCIL_MODELS } from '../../shared/types';
import type { CouncilEvent, CouncilModelId, ModelAnswer, RoundResult, ChatMessage } from '../../shared/types';
import { buildRound1Messages, parseConfidence } from './prompts';

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
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/council/orchestrator.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/council/orchestrator.ts server/council/orchestrator.test.ts
git commit -m "feat: run independent Round 1 across all four council models"
```

---

### Task 7: Council Orchestrator — Debate Rounds (2 & 3)

**Files:**
- Modify: `server/council/orchestrator.ts`
- Modify: `server/council/orchestrator.test.ts`

**Interfaces:**
- Consumes: `buildDebateRoundMessages` from `server/council/prompts`.
- Produces: `CouncilOrchestrator.runDebateRound(sessionId, prompt, round: 2 | 3, priorRounds): Promise<RoundResult>`, reused by `run()` in Task 9 for both Round 2 and Round 3.

- [ ] **Step 1: Write the failing test**

Append to `server/council/orchestrator.test.ts`:

```ts
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
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/council/orchestrator.test.ts`
Expected: FAIL with "orchestrator.runDebateRound is not a function".

- [ ] **Step 3: Add the implementation**

Add to `server/council/orchestrator.ts` (inside the `CouncilOrchestrator` class, and update the import line):

```ts
import { buildRound1Messages, buildDebateRoundMessages, parseConfidence } from './prompts';
```

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/council/orchestrator.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/council/orchestrator.ts server/council/orchestrator.test.ts
git commit -m "feat: run debate rounds (2 and 3) with cross-model context"
```

---

### Task 8: Council Orchestrator — Convergence Check & Synthesizer Retry

**Files:**
- Modify: `server/council/orchestrator.ts`
- Modify: `server/council/orchestrator.test.ts`

**Interfaces:**
- Consumes: `buildConvergenceCheckMessages` from `server/council/prompts`; `SYNTHESIZER_MODEL_ID` from `shared/types`.
- Produces: `CouncilOrchestrator.checkConvergence(sessionId, prompt, rounds): Promise<boolean>` and a private `callSynthesizerWithRetry(sessionId, messages, purpose)` reused by final synthesis in Task 9.

- [ ] **Step 1: Write the failing test**

Append to `server/council/orchestrator.test.ts`:

```ts
import { SYNTHESIZER_MODEL_ID } from '../../shared/types';

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/council/orchestrator.test.ts`
Expected: FAIL with "orchestrator.checkConvergence is not a function".

- [ ] **Step 3: Add the implementation**

Add to `server/council/orchestrator.ts` (update imports and add methods to the class):

```ts
import { COUNCIL_MODELS, SYNTHESIZER_MODEL_ID } from '../../shared/types';
import { buildRound1Messages, buildDebateRoundMessages, buildConvergenceCheckMessages, parseConfidence } from './prompts';
```

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/council/orchestrator.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/council/orchestrator.ts server/council/orchestrator.test.ts
git commit -m "feat: add synthesizer convergence check with retry-with-backoff"
```

---

### Task 9: Council Orchestrator — Final Synthesis & Full `run()` Wiring

**Files:**
- Modify: `server/council/orchestrator.ts`
- Modify: `server/council/orchestrator.test.ts`

**Interfaces:**
- Consumes: `buildFinalSynthesisMessages`, `parseVerdictTable` from `server/council/prompts`.
- Produces: `CouncilOrchestrator.synthesize(sessionId, prompt, rounds): Promise<void>` and `CouncilOrchestrator.run(sessionId, prompt): Promise<void>` — the single entry point used by the `POST /sessions` route in Task 12.

- [ ] **Step 1: Write the failing test**

Append to `server/council/orchestrator.test.ts`:

```ts
import { MODEL_LABELS } from '../../shared/types';

describe('CouncilOrchestrator.run', () => {
  it('produces a verdict after 2 rounds when the synthesizer detects convergence', async () => {
    const client = new FakeOpenRouterClient();
    for (const model of COUNCIL_MODELS) {
      client.script(model, [`r1 answer from ${model}. Confidence: 70%`]);
      client.script(model, [`r2 answer from ${model}. Confidence: 80%`]);
    }
    client.script(SYNTHESIZER_MODEL_ID, ['CONVERGED. The council agrees.']);
    const verdictLines = COUNCIL_MODELS.map((m) => `${MODEL_LABELS[m]} | agree`).join('\n');
    client.script(SYNTHESIZER_MODEL_ID, [`Final verdict text.\n\nVERDICT_TABLE:\n${verdictLines}`]);

    const store = new SessionStore(':memory:');
    store.createSession('s1', 'prompt');
    const orchestrator = new CouncilOrchestrator(client, store, new RecordingEventSink());

    await orchestrator.run('s1', 'prompt');

    const session = store.getSession('s1')!;
    expect(session.status).toBe('complete');
    expect(session.rounds).toHaveLength(2);
    expect(session.verdictTable).toHaveLength(4);
  });

  it('runs a third round when the synthesizer reports no convergence, then still produces a verdict', async () => {
    const client = new FakeOpenRouterClient();
    for (const model of COUNCIL_MODELS) {
      client.script(model, [`r1 from ${model}. Confidence: 60%`]);
      client.script(model, [`r2 from ${model}. Confidence: 60%`]);
      client.script(model, [`r3 from ${model}. Confidence: 90%`]);
    }
    client.script(SYNTHESIZER_MODEL_ID, ['NOT_CONVERGED. Still disagreement.']);
    const verdictLines = COUNCIL_MODELS.map((m) => `${MODEL_LABELS[m]} | partial`).join('\n');
    client.script(SYNTHESIZER_MODEL_ID, [`Final verdict text.\n\nVERDICT_TABLE:\n${verdictLines}`]);

    const store = new SessionStore(':memory:');
    store.createSession('s2', 'prompt');
    const orchestrator = new CouncilOrchestrator(client, store, new RecordingEventSink());

    await orchestrator.run('s2', 'prompt');

    const session = store.getSession('s2')!;
    expect(session.rounds).toHaveLength(3);
    expect(session.status).toBe('complete');
  });

  it('marks the session as errored if the synthesizer never recovers', async () => {
    const client = new FakeOpenRouterClient();
    for (const model of COUNCIL_MODELS) {
      client.script(model, [`r1 from ${model}. Confidence: 60%`]);
      client.script(model, [`r2 from ${model}. Confidence: 60%`]);
    }
    client.scriptError(SYNTHESIZER_MODEL_ID, new Error('down'));
    client.scriptError(SYNTHESIZER_MODEL_ID, new Error('down'));
    client.scriptError(SYNTHESIZER_MODEL_ID, new Error('down'));

    const store = new SessionStore(':memory:');
    store.createSession('s3', 'prompt');
    const orchestrator = new CouncilOrchestrator(client, store, new RecordingEventSink());

    await orchestrator.run('s3', 'prompt');

    const session = store.getSession('s3')!;
    expect(session.status).toBe('error');
    expect(session.errorMessage).toContain('down');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/council/orchestrator.test.ts`
Expected: FAIL with "orchestrator.run is not a function".

- [ ] **Step 3: Add the implementation**

Add to `server/council/orchestrator.ts` (update imports and add methods to the class):

```ts
import {
  buildRound1Messages,
  buildDebateRoundMessages,
  buildConvergenceCheckMessages,
  buildFinalSynthesisMessages,
  parseConfidence,
  parseVerdictTable,
} from './prompts';
```

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/council/orchestrator.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/council/orchestrator.ts server/council/orchestrator.test.ts
git commit -m "feat: wire full council run — rounds, convergence gate, final synthesis"
```

---

### Task 10: Per-Model Retry

**Files:**
- Modify: `server/council/orchestrator.ts`
- Modify: `server/council/orchestrator.test.ts`
- Modify: `server/db/store.ts`
- Modify: `server/db/store.test.ts`

**Interfaces:**
- Produces: `SessionStore.replaceRound(id, result: RoundResult)`; `CouncilOrchestrator.retryModel(sessionId, round, model): Promise<ModelAnswer>` — consumed by the retry route in Task 12.

- [ ] **Step 1: Write the failing tests**

Append to `server/db/store.test.ts`:

```ts
it('replaces one round in place without disturbing other rounds', () => {
  const store = new SessionStore(':memory:');
  store.createSession('s1', 'prompt');
  store.appendRound('s1', { round: 1, answers: [] });
  store.appendRound('s1', { round: 2, answers: [] });

  store.replaceRound('s1', {
    round: 1,
    answers: [{ model: 'anthropic/claude-sonnet-5', status: 'ok', text: 'updated', confidence: 90 }],
  });

  const rounds = store.getSession('s1')?.rounds;
  expect(rounds).toHaveLength(2);
  expect(rounds?.find((r) => r.round === 1)?.answers[0].text).toBe('updated');
  expect(rounds?.find((r) => r.round === 2)?.answers).toEqual([]);
});
```

Append to `server/council/orchestrator.test.ts`:

```ts
describe('CouncilOrchestrator.retryModel', () => {
  it('replaces a single model answer for a round without touching the others', async () => {
    const client = new FakeOpenRouterClient();
    for (const model of COUNCIL_MODELS) client.script(model, ['first try. Confidence: 40%']);
    const store = new SessionStore(':memory:');
    store.createSession('s1', 'prompt');
    const orchestrator = new CouncilOrchestrator(client, store, new RecordingEventSink());
    await orchestrator.runRound1('s1', 'prompt');

    client.script(COUNCIL_MODELS[1], ['second try. Confidence: 90%']);
    const updated = await orchestrator.retryModel('s1', 1, COUNCIL_MODELS[1]);

    expect(updated.text).toBe('second try. Confidence: 90%');
    const round = store.getSession('s1')?.rounds.find((r) => r.round === 1);
    expect(round?.answers.find((a) => a.model === COUNCIL_MODELS[1])?.text).toBe('second try. Confidence: 90%');
    expect(round?.answers.find((a) => a.model === COUNCIL_MODELS[0])?.text).toBe('first try. Confidence: 40%');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run server/db/store.test.ts server/council/orchestrator.test.ts`
Expected: FAIL — `store.replaceRound is not a function`, then `orchestrator.retryModel is not a function`.

- [ ] **Step 3: Add the implementations**

Add to `server/db/store.ts` (inside `SessionStore`):

```ts
  replaceRound(id: string, result: RoundResult): void {
    const session = this.getSession(id);
    if (!session) throw new Error(`Session not found: ${id}`);
    const rounds = session.rounds.map((r) => (r.round === result.round ? result : r));
    this.db.prepare(`UPDATE sessions SET rounds_json = ? WHERE id = ?`).run(JSON.stringify(rounds), id);
  }
```

Add to `server/council/orchestrator.ts` (inside `CouncilOrchestrator`):

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/db/store.test.ts server/council/orchestrator.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/db/store.ts server/db/store.test.ts server/council/orchestrator.ts server/council/orchestrator.test.ts
git commit -m "feat: add manual per-model retry for a completed round"
```

---

### Task 11: SSE Hub

**Files:**
- Create: `server/council/sseHub.ts`
- Test: `server/council/sseHub.test.ts`

**Interfaces:**
- Consumes: `CouncilEvent` from `shared/types`; implements `CouncilEventSink` from `server/council/orchestrator`.
- Produces: `SseHub` with `subscribe(sessionId, res)` and `emit(sessionId, event)` — passed into `CouncilOrchestrator` and mounted by the routes in Task 12.

- [ ] **Step 1: Write the failing test**

```ts
// server/council/sseHub.test.ts
import { describe, it, expect } from 'vitest';
import { SseHub } from './sseHub';

class FakeResponse {
  written: string[] = [];
  private closeHandler: (() => void) | null = null;
  write(chunk: string) {
    this.written.push(chunk);
  }
  on(event: string, handler: () => void) {
    if (event === 'close') this.closeHandler = handler;
  }
  close() {
    this.closeHandler?.();
  }
}

describe('SseHub', () => {
  it('delivers events only to subscribers of that session', () => {
    const hub = new SseHub();
    const resA = new FakeResponse();
    const resB = new FakeResponse();
    hub.subscribe('a', resA as any);
    hub.subscribe('b', resB as any);

    hub.emit('a', { type: 'round_start', round: 1 });

    expect(resA.written).toHaveLength(1);
    expect(resA.written[0]).toContain('"type":"round_start"');
    expect(resB.written).toHaveLength(0);
  });

  it('stops delivering to a subscriber after it closes', () => {
    const hub = new SseHub();
    const res = new FakeResponse();
    hub.subscribe('a', res as any);
    res.close();

    hub.emit('a', { type: 'round_start', round: 1 });

    expect(res.written).toHaveLength(0);
  });

  it('does nothing when emitting to a session with no subscribers', () => {
    const hub = new SseHub();
    expect(() => hub.emit('nobody', { type: 'round_start', round: 1 })).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/council/sseHub.test.ts`
Expected: FAIL with "Cannot find module './sseHub'".

- [ ] **Step 3: Write the implementation**

```ts
// server/council/sseHub.ts
import type { Response } from 'express';
import type { CouncilEvent } from '../../shared/types';
import type { CouncilEventSink } from './orchestrator';

export class SseHub implements CouncilEventSink {
  private subscribers = new Map<string, Set<Response>>();

  subscribe(sessionId: string, res: Response): void {
    const set = this.subscribers.get(sessionId) ?? new Set<Response>();
    set.add(res);
    this.subscribers.set(sessionId, set);
    res.on('close', () => {
      this.subscribers.get(sessionId)?.delete(res);
    });
  }

  emit(sessionId: string, event: CouncilEvent): void {
    const set = this.subscribers.get(sessionId);
    if (!set) return;
    const payload = `data: ${JSON.stringify(event)}\n\n`;
    for (const res of set) {
      res.write(payload);
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/council/sseHub.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/council/sseHub.ts server/council/sseHub.test.ts
git commit -m "feat: add SseHub to multiplex council events onto per-session SSE connections"
```

---

### Task 12: Express Routes & Markdown Export

**Files:**
- Create: `server/routes/markdown.ts`
- Create: `server/routes/sessions.ts`
- Test: `server/routes/markdown.test.ts`
- Test: `server/routes/sessions.test.ts`

**Interfaces:**
- Consumes: `SessionStore`, `CouncilOrchestrator`, `SseHub`, `COUNCIL_MODELS`, `CouncilModelId`, `MODEL_LABELS`, `Session` from earlier tasks.
- Produces: `sessionToMarkdown(session): string`; `createSessionsRouter(store, orchestrator, sseHub): express.Router` — mounted by `server/app.ts` in Task 17.

- [ ] **Step 1: Write the failing tests**

```ts
// server/routes/markdown.test.ts
import { describe, it, expect } from 'vitest';
import { sessionToMarkdown } from './markdown';
import type { Session } from '../../shared/types';

describe('sessionToMarkdown', () => {
  it('serializes prompt, rounds, and the verdict table', () => {
    const session: Session = {
      id: 's1',
      prompt: 'Should we ship this?',
      status: 'complete',
      rounds: [
        {
          round: 1,
          answers: [{ model: 'anthropic/claude-sonnet-5', status: 'ok', text: 'Yes, ship it.', confidence: 80 }],
        },
      ],
      verdictText: 'Final verdict: ship it.',
      verdictTable: [
        { model: 'anthropic/claude-sonnet-5', finalPosition: 'Yes, ship it.', agreement: 'agree', confidence: 80 },
      ],
      createdAt: new Date().toISOString(),
      errorMessage: null,
    };

    const markdown = sessionToMarkdown(session);

    expect(markdown).toContain('Should we ship this?');
    expect(markdown).toContain('Claude Sonnet 5');
    expect(markdown).toContain('Yes, ship it.');
    expect(markdown).toContain('Final verdict: ship it.');
    expect(markdown).toContain('agree');
  });

  it('shows "No response" for a model that failed in a round', () => {
    const session: Session = {
      id: 's1',
      prompt: 'prompt',
      status: 'running',
      rounds: [{ round: 1, answers: [{ model: 'openai/gpt-5.6-luna', status: 'no_response', text: '', confidence: null }] }],
      verdictText: null,
      verdictTable: null,
      createdAt: new Date().toISOString(),
      errorMessage: null,
    };
    expect(sessionToMarkdown(session)).toContain('No response');
  });
});
```

```ts
// server/routes/sessions.test.ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run server/routes/markdown.test.ts server/routes/sessions.test.ts`
Expected: FAIL with "Cannot find module './markdown'" / "Cannot find module './sessions'".

- [ ] **Step 3: Write the implementations**

```ts
// server/routes/markdown.ts
import { MODEL_LABELS } from '../../shared/types';
import type { Session } from '../../shared/types';

export function sessionToMarkdown(session: Session): string {
  const lines: string[] = [`# Model Council Session`, '', `**Prompt:** ${session.prompt}`, ''];

  for (const round of session.rounds) {
    lines.push(`## Round ${round.round}`, '');
    for (const answer of round.answers) {
      lines.push(`### ${MODEL_LABELS[answer.model]}`, '');
      lines.push(answer.status === 'ok' ? answer.text : '_No response_');
      if (answer.confidence !== null) lines.push('', `Confidence: ${answer.confidence}%`);
      lines.push('');
    }
  }

  if (session.verdictText) {
    lines.push('## Verdict', '', session.verdictText, '');
  }

  if (session.verdictTable) {
    lines.push('## Verdict Table', '', '| Model | Agreement | Confidence |', '|---|---|---|');
    for (const row of session.verdictTable) {
      lines.push(`| ${MODEL_LABELS[row.model]} | ${row.agreement} | ${row.confidence ?? '—'}% |`);
    }
  }

  return lines.join('\n');
}
```

```ts
// server/routes/sessions.ts
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
      res.status(404).json({ error: err instanceof Error ? err.message : 'retry failed' });
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/routes/markdown.test.ts server/routes/sessions.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/routes/markdown.ts server/routes/sessions.ts server/routes/markdown.test.ts server/routes/sessions.test.ts
git commit -m "feat: add sessions API routes and Markdown export"
```

---

### Task 13: Frontend — API Client & Live Stream Hook

**Files:**
- Create: `src/api.ts`
- Create: `src/hooks/useCouncilStream.ts`
- Test: `src/hooks/useCouncilStream.test.ts`

**Interfaces:**
- Consumes: `CouncilEvent`, `RoundResult`, `VerdictRow`, `Session` from `shared/types`.
- Produces: `createSession`, `fetchSession`, `fetchHistory`, `retryModel` (API client); `useCouncilStream(sessionId): CouncilStreamState`; `sessionToStreamState(session): CouncilStreamState` — consumed by `CouncilBoard`/`VerdictTable` (Tasks 14-15) and `App` (Task 16).

- [ ] **Step 1: Write the failing test**

```ts
// src/hooks/useCouncilStream.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCouncilStream } from './useCouncilStream';

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  onmessage: ((event: { data: string }) => void) | null = null;
  constructor(public url: string) {
    FakeEventSource.instances.push(this);
  }
  close() {}
  emit(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }
}

beforeEach(() => {
  FakeEventSource.instances = [];
  vi.stubGlobal('EventSource', FakeEventSource as any);
});

describe('useCouncilStream', () => {
  it('accumulates tokens per model within a round as they stream in', () => {
    const { result } = renderHook(() => useCouncilStream('session-1'));
    const source = FakeEventSource.instances[0];

    act(() => {
      source.emit({ type: 'token', phase: 1, model: 'anthropic/claude-sonnet-5', token: 'Hel' });
      source.emit({ type: 'token', phase: 1, model: 'anthropic/claude-sonnet-5', token: 'lo' });
    });

    expect(result.current.roundsInProgress[1]['anthropic/claude-sonnet-5']).toBe('Hello');
  });

  it('records a completed round and marks status complete on session_complete', () => {
    const { result } = renderHook(() => useCouncilStream('session-1'));
    const source = FakeEventSource.instances[0];

    act(() => {
      source.emit({
        type: 'round_complete',
        round: 1,
        result: { round: 1, answers: [{ model: 'anthropic/claude-sonnet-5', status: 'ok', text: 'Hello', confidence: 80 }] },
      });
      source.emit({ type: 'session_complete', verdictText: 'Final answer', verdictTable: [] });
    });

    expect(result.current.completedRounds).toHaveLength(1);
    expect(result.current.status).toBe('complete');
    expect(result.current.verdictText).toBe('Final answer');
  });

  it('records a model_error without marking the session errored', () => {
    const { result } = renderHook(() => useCouncilStream('session-1'));
    const source = FakeEventSource.instances[0];

    act(() => {
      source.emit({ type: 'model_error', round: 1, model: 'openai/gpt-5.6-luna', message: 'timeout' });
    });

    expect(result.current.errors).toHaveLength(1);
    expect(result.current.status).toBe('running');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/useCouncilStream.test.ts`
Expected: FAIL with "Cannot find module './useCouncilStream'".

- [ ] **Step 3: Write the implementation**

```ts
// src/api.ts
import type { Session } from '../shared/types';

export async function createSession(prompt: string): Promise<{ id: string }> {
  const res = await fetch('/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  if (!res.ok) throw new Error('Failed to create session');
  return res.json();
}

export async function fetchSession(id: string): Promise<Session> {
  const res = await fetch(`/api/sessions/${id}`);
  if (!res.ok) throw new Error('Failed to load session');
  return res.json();
}

export async function fetchHistory(): Promise<Session[]> {
  const res = await fetch('/api/sessions');
  if (!res.ok) throw new Error('Failed to load history');
  return res.json();
}

export async function retryModel(sessionId: string, round: number, model: string) {
  const res = await fetch(`/api/sessions/${sessionId}/retry/${model}?round=${round}`, { method: 'POST' });
  if (!res.ok) throw new Error('Retry failed');
  return res.json();
}
```

```ts
// src/hooks/useCouncilStream.ts
import { useEffect, useState } from 'react';
import type { CouncilEvent, RoundResult, Session, VerdictRow } from '../../shared/types';

export interface CouncilStreamState {
  roundsInProgress: Record<number, Record<string, string>>;
  completedRounds: RoundResult[];
  verdictText: string | null;
  verdictTable: VerdictRow[] | null;
  errors: { round: number; model: string; message: string }[];
  status: 'running' | 'complete' | 'error';
}

const initialState: CouncilStreamState = {
  roundsInProgress: {},
  completedRounds: [],
  verdictText: null,
  verdictTable: null,
  errors: [],
  status: 'running',
};

export function useCouncilStream(sessionId: string | null): CouncilStreamState {
  const [state, setState] = useState<CouncilStreamState>(initialState);

  useEffect(() => {
    if (!sessionId) return;
    setState(initialState);
    const source = new EventSource(`/api/sessions/${sessionId}/stream`);

    source.onmessage = (event) => {
      const parsed: CouncilEvent = JSON.parse(event.data);
      setState((prev) => applyEvent(prev, parsed));
    };

    return () => {
      source.close();
    };
  }, [sessionId]);

  return state;
}

export function sessionToStreamState(session: Session): CouncilStreamState {
  return {
    roundsInProgress: {},
    completedRounds: session.rounds,
    verdictText: session.verdictText,
    verdictTable: session.verdictTable,
    errors: [],
    status: session.status,
  };
}

function applyEvent(prev: CouncilStreamState, event: CouncilEvent): CouncilStreamState {
  switch (event.type) {
    case 'token': {
      const phaseKey = typeof event.phase === 'number' ? event.phase : 0;
      const roundTokens = { ...(prev.roundsInProgress[phaseKey] ?? {}) };
      roundTokens[event.model] = (roundTokens[event.model] ?? '') + event.token;
      return { ...prev, roundsInProgress: { ...prev.roundsInProgress, [phaseKey]: roundTokens } };
    }
    case 'round_complete':
      return { ...prev, completedRounds: [...prev.completedRounds, event.result] };
    case 'model_error':
      return { ...prev, errors: [...prev.errors, { round: event.round, model: event.model, message: event.message }] };
    case 'session_complete':
      return { ...prev, status: 'complete', verdictText: event.verdictText, verdictTable: event.verdictTable };
    case 'session_error':
      return { ...prev, status: 'error' };
    default:
      return prev;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/hooks/useCouncilStream.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/api.ts src/hooks/useCouncilStream.ts src/hooks/useCouncilStream.test.ts
git commit -m "feat: add API client and live SSE stream hook"
```

---

### Task 14: Frontend — PromptForm & CouncilBoard

**Files:**
- Create: `src/components/PromptForm.tsx`
- Create: `src/components/CouncilBoard.tsx`
- Test: `src/components/PromptForm.test.tsx`
- Test: `src/components/CouncilBoard.test.tsx`

**Interfaces:**
- Consumes: `CouncilStreamState` from `src/hooks/useCouncilStream`; `COUNCIL_MODELS`, `MODEL_LABELS` from `shared/types`.
- Produces: `PromptForm({ onSubmit, disabled })`; `CouncilBoard({ stream })` — both consumed by `App` in Task 16.

- [ ] **Step 1: Write the failing tests**

```tsx
// src/components/PromptForm.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PromptForm } from './PromptForm';

describe('PromptForm', () => {
  it('calls onSubmit with the trimmed prompt', () => {
    const onSubmit = vi.fn();
    render(<PromptForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByPlaceholderText('Ask the council...'), { target: { value: '  hello  ' } });
    fireEvent.click(screen.getByText('Convene Council'));

    expect(onSubmit).toHaveBeenCalledWith('hello');
  });

  it('does not submit an empty prompt', () => {
    const onSubmit = vi.fn();
    render(<PromptForm onSubmit={onSubmit} />);
    fireEvent.click(screen.getByText('Convene Council'));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
```

```tsx
// src/components/CouncilBoard.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CouncilBoard } from './CouncilBoard';
import { COUNCIL_MODELS } from '../../shared/types';
import type { CouncilStreamState } from '../hooks/useCouncilStream';

const emptyStream: CouncilStreamState = {
  roundsInProgress: {},
  completedRounds: [],
  verdictText: null,
  verdictTable: null,
  errors: [],
  status: 'running',
};

describe('CouncilBoard', () => {
  it('renders in-progress tokens for a round that has started', () => {
    render(
      <CouncilBoard stream={{ ...emptyStream, roundsInProgress: { 1: { [COUNCIL_MODELS[0]]: 'Partial ans' } } }} />,
    );
    expect(screen.getByText('Round 1')).toBeInTheDocument();
    expect(screen.getByText('Partial ans')).toBeInTheDocument();
  });

  it('shows "No response" for a model marked no_response in a completed round', () => {
    render(
      <CouncilBoard
        stream={{
          ...emptyStream,
          completedRounds: [
            {
              round: 1,
              answers: COUNCIL_MODELS.map((model, i) => ({
                model,
                status: i === 0 ? 'no_response' : 'ok',
                text: i === 0 ? '' : 'answer',
                confidence: i === 0 ? null : 50,
              })),
            },
          ],
        }}
      />,
    );
    expect(screen.getByText('No response')).toBeInTheDocument();
  });

  it('renders nothing for a round that has not started', () => {
    render(<CouncilBoard stream={emptyStream} />);
    expect(screen.queryByText('Round 1')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/PromptForm.test.tsx src/components/CouncilBoard.test.tsx`
Expected: FAIL with "Cannot find module './PromptForm'" / "Cannot find module './CouncilBoard'".

- [ ] **Step 3: Write the implementations**

```tsx
// src/components/PromptForm.tsx
import { useState } from 'react';

export interface PromptFormProps {
  onSubmit: (prompt: string) => void;
  disabled?: boolean;
}

export function PromptForm({ onSubmit, disabled }: PromptFormProps) {
  const [value, setValue] = useState('');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = value.trim();
        if (!trimmed) return;
        onSubmit(trimmed);
      }}
    >
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Ask the council..."
        disabled={disabled}
      />
      <button type="submit" disabled={disabled || value.trim() === ''}>
        Convene Council
      </button>
    </form>
  );
}
```

```tsx
// src/components/CouncilBoard.tsx
import { COUNCIL_MODELS, MODEL_LABELS } from '../../shared/types';
import type { CouncilStreamState } from '../hooks/useCouncilStream';

export function CouncilBoard({ stream }: { stream: CouncilStreamState }) {
  const rounds = [1, 2, 3] as const;
  return (
    <div>
      {rounds.map((round) => {
        const inProgress = stream.roundsInProgress[round];
        const completed = stream.completedRounds.find((r) => r.round === round);
        if (!inProgress && !completed) return null;
        return (
          <section key={round} aria-label={`Round ${round}`}>
            <h2>Round {round}</h2>
            {COUNCIL_MODELS.map((model) => {
              const completedAnswer = completed?.answers.find((a) => a.model === model);
              const text = completedAnswer?.text ?? inProgress?.[model] ?? '';
              const failed = completedAnswer?.status === 'no_response';
              return (
                <article key={model} aria-label={MODEL_LABELS[model]}>
                  <h3>{MODEL_LABELS[model]}</h3>
                  <p>{failed ? 'No response' : text}</p>
                </article>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/PromptForm.test.tsx src/components/CouncilBoard.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/PromptForm.tsx src/components/CouncilBoard.tsx src/components/PromptForm.test.tsx src/components/CouncilBoard.test.tsx
git commit -m "feat: add PromptForm and live CouncilBoard components"
```

---

### Task 15: Frontend — VerdictTable & ExportButton

**Files:**
- Create: `src/components/VerdictTable.tsx`
- Create: `src/components/ExportButton.tsx`
- Test: `src/components/VerdictTable.test.tsx`
- Test: `src/components/ExportButton.test.tsx`

**Interfaces:**
- Consumes: `VerdictRow`, `MODEL_LABELS` from `shared/types`.
- Produces: `VerdictTable({ verdictText, rows })`; `ExportButton({ sessionId })` — both consumed by `App` in Task 16.

- [ ] **Step 1: Write the failing tests**

```tsx
// src/components/VerdictTable.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VerdictTable } from './VerdictTable';

describe('VerdictTable', () => {
  it('renders the verdict text and one row per model', () => {
    render(
      <VerdictTable
        verdictText="Final verdict: ship it."
        rows={[
          { model: 'anthropic/claude-sonnet-5', finalPosition: 'Ship it', agreement: 'agree', confidence: 85 },
          { model: 'openai/gpt-5.6-luna', finalPosition: 'Wait', agreement: 'disagree', confidence: 60 },
        ]}
      />,
    );
    expect(screen.getByText('Final verdict: ship it.')).toBeInTheDocument();
    expect(screen.getByText('Claude Sonnet 5')).toBeInTheDocument();
    expect(screen.getByText('agree')).toBeInTheDocument();
    expect(screen.getByText('85%')).toBeInTheDocument();
  });

  it('renders an em dash for a model with no confidence value', () => {
    render(
      <VerdictTable
        verdictText="Verdict"
        rows={[{ model: 'anthropic/claude-sonnet-5', finalPosition: '', agreement: 'partial', confidence: null }]}
      />,
    );
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
```

```tsx
// src/components/ExportButton.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExportButton } from './ExportButton';

describe('ExportButton', () => {
  it('links to the export endpoint for the given session', () => {
    render(<ExportButton sessionId="abc123" />);
    const link = screen.getByText('Export Markdown') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/api/sessions/abc123/export.md');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/VerdictTable.test.tsx src/components/ExportButton.test.tsx`
Expected: FAIL with "Cannot find module './VerdictTable'" / "Cannot find module './ExportButton'".

- [ ] **Step 3: Write the implementations**

```tsx
// src/components/VerdictTable.tsx
import { MODEL_LABELS } from '../../shared/types';
import type { VerdictRow } from '../../shared/types';

export function VerdictTable({ verdictText, rows }: { verdictText: string; rows: VerdictRow[] }) {
  return (
    <div>
      <h2>Verdict</h2>
      <p>{verdictText}</p>
      <table>
        <thead>
          <tr>
            <th>Model</th>
            <th>Agreement</th>
            <th>Confidence</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.model}>
              <td>{MODEL_LABELS[row.model]}</td>
              <td>{row.agreement}</td>
              <td>{row.confidence !== null ? `${row.confidence}%` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

```tsx
// src/components/ExportButton.tsx
export function ExportButton({ sessionId }: { sessionId: string }) {
  return (
    <a href={`/api/sessions/${sessionId}/export.md`} download>
      Export Markdown
    </a>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/VerdictTable.test.tsx src/components/ExportButton.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/VerdictTable.tsx src/components/ExportButton.tsx src/components/VerdictTable.test.tsx src/components/ExportButton.test.tsx
git commit -m "feat: add VerdictTable and Markdown ExportButton components"
```

---

### Task 16: Frontend — History & App Composition

**Files:**
- Create: `src/components/HistoryList.tsx`
- Test: `src/components/HistoryList.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

**Interfaces:**
- Consumes: `fetchHistory`, `fetchSession`, `createSession` from `src/api`; `useCouncilStream`, `sessionToStreamState` from `src/hooks/useCouncilStream`; `PromptForm`, `CouncilBoard`, `VerdictTable`, `ExportButton` from earlier tasks.
- Produces: `HistoryList({ onSelect })`; the final `App()` composition.

- [ ] **Step 1: Write the failing tests**

```tsx
// src/components/HistoryList.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { HistoryList } from './HistoryList';
import * as api from '../api';

describe('HistoryList', () => {
  it('lists past sessions by prompt and calls onSelect when clicked', async () => {
    vi.spyOn(api, 'fetchHistory').mockResolvedValue([
      { id: 's1', prompt: 'First question', status: 'complete', rounds: [], verdictText: null, verdictTable: null, createdAt: '', errorMessage: null },
    ]);
    const onSelect = vi.fn();
    render(<HistoryList onSelect={onSelect} />);

    await waitFor(() => expect(screen.getByText('First question')).toBeInTheDocument());
    fireEvent.click(screen.getByText('First question'));

    expect(onSelect).toHaveBeenCalledWith('s1');
  });
});
```

```tsx
// src/App.test.tsx (replaces the scaffolding version from Task 1)
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from './App';
import * as api from './api';

beforeEach(() => {
  vi.spyOn(api, 'fetchHistory').mockResolvedValue([]);
});

describe('App', () => {
  it('renders the prompt form and history section', () => {
    render(<App />);
    expect(screen.getByPlaceholderText('Ask the council...')).toBeInTheDocument();
    expect(screen.getByText('History')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/HistoryList.test.tsx src/App.test.tsx`
Expected: FAIL — "Cannot find module './HistoryList'", and `App.test.tsx` fails because `App` doesn't render a prompt form yet.

- [ ] **Step 3: Write the implementations**

```tsx
// src/components/HistoryList.tsx
import { useEffect, useState } from 'react';
import { fetchHistory } from '../api';
import type { Session } from '../../shared/types';

export function HistoryList({ onSelect }: { onSelect: (id: string) => void }) {
  const [sessions, setSessions] = useState<Session[]>([]);

  useEffect(() => {
    fetchHistory().then(setSessions);
  }, []);

  return (
    <ul>
      {sessions.map((s) => (
        <li key={s.id}>
          <button onClick={() => onSelect(s.id)}>{s.prompt}</button>
        </li>
      ))}
    </ul>
  );
}
```

```tsx
// src/App.tsx
import { useState } from 'react';
import { PromptForm } from './components/PromptForm';
import { CouncilBoard } from './components/CouncilBoard';
import { VerdictTable } from './components/VerdictTable';
import { ExportButton } from './components/ExportButton';
import { HistoryList } from './components/HistoryList';
import { useCouncilStream, sessionToStreamState } from './hooks/useCouncilStream';
import { createSession, fetchSession } from './api';
import type { Session } from '../shared/types';

export function App() {
  const [liveSessionId, setLiveSessionId] = useState<string | null>(null);
  const [historySession, setHistorySession] = useState<Session | null>(null);
  const liveStream = useCouncilStream(liveSessionId);
  const stream = historySession ? sessionToStreamState(historySession) : liveStream;
  const activeSessionId = historySession?.id ?? liveSessionId;

  async function handleSubmit(prompt: string) {
    setHistorySession(null);
    const { id } = await createSession(prompt);
    setLiveSessionId(id);
  }

  async function handleSelectHistory(id: string) {
    setLiveSessionId(null);
    const session = await fetchSession(id);
    setHistorySession(session);
  }

  return (
    <div>
      <h1>Model Council</h1>
      <PromptForm onSubmit={handleSubmit} disabled={stream.status === 'running' && activeSessionId !== null} />
      {activeSessionId && <CouncilBoard stream={stream} />}
      {stream.status === 'complete' && stream.verdictText && stream.verdictTable && (
        <>
          <VerdictTable verdictText={stream.verdictText} rows={stream.verdictTable} />
          <ExportButton sessionId={activeSessionId!} />
        </>
      )}
      <h2>History</h2>
      <HistoryList onSelect={handleSelectHistory} />
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/HistoryList.test.tsx src/App.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/HistoryList.tsx src/components/HistoryList.test.tsx src/App.tsx src/App.test.tsx
git commit -m "feat: add session history and wire full App composition"
```

---

### Task 17: Server Wiring & Manual OpenRouter Smoke Test

**Files:**
- Modify: `server/app.ts`
- Modify: `server/app.test.ts`
- Modify: `server/index.ts`

**Interfaces:**
- Consumes: everything produced in Tasks 3, 4, 9, 11, 12.
- Produces: final `createApp(deps: { store: SessionStore; orchestrator: CouncilOrchestrator; sseHub: SseHub }): express.Express`, and a running `npm run dev` app.

- [ ] **Step 1: Update the failing test**

Replace `server/app.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/app.test.ts`
Expected: FAIL — `createApp` doesn't accept a `deps` argument yet, and `/api/sessions` is not mounted (404).

- [ ] **Step 3: Update the implementation**

Replace `server/app.ts`:

```ts
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
```

Replace `server/index.ts`:

```ts
// server/index.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/app.test.ts`
Expected: PASS

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: PASS — every test file from Tasks 1-17 green, zero real API calls made.

- [ ] **Step 6: Commit**

```bash
git add server/app.ts server/app.test.ts server/index.ts
git commit -m "feat: wire real dependencies into the Express app"
```

- [ ] **Step 7: Manual one-time real-OpenRouter smoke test (not part of the automated suite)**

1. Copy `.env.example` to `.env` and fill in a real `OPENROUTER_API_KEY`.
2. Run `npm run dev` (starts both the Express server and the Vite dev server).
3. Open the printed Vite URL (default `http://localhost:5173`), submit a real prompt through the UI.
4. Confirm: all four council models stream real tokens live, Round 2 runs, the convergence check fires, the verdict table renders with real agree/disagree/confidence values, and Markdown export downloads a populated file.
5. This costs a few cents in real OpenRouter usage — run it once to confirm the integration works end-to-end, not on every change.

---

## Self-Review Notes

- **Spec coverage:** independent Round 1 (Task 6), named cross-model Round 2/3 (Task 7), auto-triggered Round 3 via convergence check (Tasks 8-9), synthesizer verdict + table (Task 9), per-model graceful degradation + retry (Tasks 6, 10), synthesizer retry-with-backoff (Task 8), live token streaming via SSE (Tasks 11, 13), Markdown export (Task 12), persisted browsable history (Tasks 4, 16), confirmed OpenRouter model roster (Task 2) — every section of the spec maps to a task.
- **Placeholder scan:** no TBD/TODO markers; every step contains complete, real code.
- **Type consistency:** `CouncilEvent`, `RoundResult`, `ModelAnswer`, `VerdictRow`, and `Session` are defined once in `shared/types.ts` (Task 2) and reused verbatim by every later task; `CouncilOrchestrator` method names (`runRound1`, `runDebateRound`, `checkConvergence`, `synthesize`, `run`, `retryModel`) are introduced once per task and referenced identically thereafter; `SessionStore` methods (`createSession`, `appendRound`, `replaceRound`, `setVerdict`, `setError`, `getSession`, `listSessions`) match between Tasks 4/10 and their consumers.
