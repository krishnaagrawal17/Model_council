# Model Council — Project Memory

This file lets a fresh session pick up this project without re-deriving context.

**Status: shipped.** All 17 planned implementation tasks, a manual real-API smoke test, and a
full frontend redesign are complete, merged to `main`, and pushed to GitHub at
**https://github.com/krishnaagrawal17/Model_council**. There is no interrupted work to resume —
if you're opening this file to start a new session, you're adding a feature, fixing a bug, or
picking something off "Known follow-up work" below, not continuing a half-finished build.

## What this project is

A local web app: submit a prompt, and a council of four LLMs (via OpenRouter) answer
independently, then debate across up to three rounds, then a fifth model (the synthesizer)
writes a final verdict plus a per-model agree/disagree/confidence table. Everything streams
live, sessions persist, and results export to Markdown.

Full product spec: `docs/superpowers/specs/2026-08-06-model-council-design.md`
Full implementation plan (17 TDD tasks): `docs/superpowers/plans/2026-08-06-model-council-implementation.md`

## Where the code lives

- **Everything is in one repo, one branch now**: `/Users/krishnaagrawal/Claude-Code/model_council/`,
  branch `main`. There is no worktree anymore — the implementation worktree
  (`.worktrees/model-council-implementation`) was merged into `main` and removed on 2026-08-07.
- **Pushed to GitHub**: `origin` = `https://github.com/krishnaagrawal17/Model_council.git`,
  `main` tracks `origin/main`. `git push` from the repo root goes straight to GitHub.
- **Run locally**:
  ```
  cd /Users/krishnaagrawal/Claude-Code/model_council
  npm install
  npm run dev
  ```
  Starts the Express backend (port 3001) and Vite frontend together. First run prompts for
  `OPENROUTER_API_KEY` interactively if `.env` doesn't have one yet — see "Environment".

## Confirmed OpenRouter model roster

(verified against the live catalog on 2026-08-06, and the Grok entry re-verified live on
2026-08-07 after a real bug — reverify if it's been a while)

| Role | Model | OpenRouter ID |
|---|---|---|
| Council | Claude Sonnet 5 | `anthropic/claude-sonnet-5` |
| Council | GPT-5.6 Luna | `openai/gpt-5.6-luna` |
| Council | Grok latest | `~x-ai/grok-latest` — **note the leading `~`**. The bare string `x-ai/grok-latest` (no tilde) is rejected outright with `400: not a valid model ID`. Aliases to `x-ai/grok-4.5`. |
| Council | Gemini 3.5 Flash Lite | `google/gemini-3.5-flash-lite` |
| Synthesizer | Claude Opus 5 | `anthropic/claude-opus-5` |

Estimated real cost per prompt run: **~$0.08 (2 rounds) to ~$0.13 (3 rounds)** — dominated by the
Opus 5 synthesizer re-reading the transcript twice. Automated tests never spend real money.

## Hard constraints (still apply to any future work here)

- **Everything for this project lives inside `model_council/`.** Nothing is ever created or
  modified outside this folder — an explicit, repeated instruction from the user. The parent
  directory (`/Users/krishnaagrawal/Claude-Code/`) contains an unrelated project (`Leadership/`)
  with its own separate git history — do not touch it.
- Debate rounds show real model names to each other — never anonymize.
- Hard cap of 3 rounds; Round 3 only runs if the synthesizer's convergence check after Round 2
  reports `NOT_CONVERGED`.
- A council model that errors/times out is marked `no_response` for that round and never blocks
  the round.
- Synthesizer calls get automatic retry-with-backoff — no verdict without them.
- Automated tests never call real OpenRouter — always `FakeOpenRouterClient`. Manual real-API
  testing is a deliberate, occasional, human-triggered action, not something to run unattended
  or add to CI.
- Single local user, no auth, SQLite only (no external DB).

(Full list: see "Global Constraints" in the plan file.)

## Project history (condensed)

1. **Brainstorming** (`superpowers:brainstorming`) → design spec written using the `create-prd`
   skill (one of 6 PM skills installed from `phuryn/pm-skills`).
2. **Planning** (`superpowers:writing-plans`) → 17-task TDD implementation plan.
3. **Execution** (`superpowers:subagent-driven-development`) — all 17 tasks implemented and
   reviewed. Notable finding: Task 13 had 2 real shipping bugs present in the plan's own brief
   code verbatim (not implementer deviations) — `retryModel()` didn't URL-encode the model ID
   (every real model ID contains a `/`), and the `round_complete` reducer duplicated instead of
   upserting by round number. Both fixed with regression tests. The full per-task ledger was
   deleted per the `finishing-a-development-branch` cleanup step once the branch merged.
4. **Final whole-branch review** (Opus, diff over all 25 commits) came back "Ready to merge?
   With fixes." Fixed all bug-class findings: `.env` was never loaded at startup, the
   verdict-table parser was brittle against real Markdown formatting, `tsc --noEmit` wasn't
   actually clean (added `npm run typecheck`), session history didn't refresh after a run
   completed, a fast double-click could launch two paid runs. Flagged several feature-scope gaps
   the design spec describes but no task covered — see "Known follow-up work" below.
5. **Manual smoke test against the real OpenRouter API** (2026-08-07) — caught one real bug:
   Grok's model ID needs a leading `~` (see roster table above); the app's own error handling
   (marking a failed model `no_response` without blocking the round) worked exactly as designed,
   it was purely a wrong ID string. Fixed and verified with a direct `curl` against the live API.
6. **Frontend redesign** (2026-08-07, ad-hoc follow-on, not in the original plan) — the UI had
   zero CSS before this. Added: a distinct accent color per model, a `FormattedText` helper that
   renders bullet/numbered lines as real `<li>`s instead of one run-on paragraph, a "What is
   Model Council?" landing section, and a CSS aurora/glow animated background with frosted-glass
   cards. Zero new npm dependencies (plain CSS, not a 3D/WebGL library).
7. **Merged and pushed to GitHub** (2026-08-07) — `model-council-implementation` merged into
   `main` locally, verified, pushed to the new remote. One more real bug caught during this step:
   running tests from the merged repo root also picked up the leftover worktree's own nested copy
   of the test suite (separate `node_modules` → duplicate-React-instance crash, not an app bug) —
   fixed by excluding `.worktrees/**` in `vitest.config.ts`.

## Known follow-up work (not blockers, not yet scheduled)

The design spec describes these, but no task in the original 17-task plan ever covered them:

- No per-model retry button in the UI (the backend route, orchestrator method, and tests all
  exist and work — nothing in the frontend calls it).
- No session-level error surfacing or "Retry synthesis" button — a run that exhausts the
  synthesizer's retries goes silent; the form just quietly re-enables.
- The verdict doesn't stream live as the spec describes — synthesis tokens are emitted but
  nothing renders them; the verdict appears all at once at `session_complete`.
- The verdict table / Markdown export are missing the "final position" column the spec calls for
  (the data is parsed and persisted, just not displayed or exported).
- Zero error handling on any frontend API call (`createSession`/`fetchSession`/`fetchHistory`).

## Environment

- `OPENROUTER_API_KEY` goes in a local `.env` at the repo root (gitignored, copied from
  `.env.example`). You don't have to create it by hand — `server/index.ts` calls
  `ensureApiKey()` (`server/config/apiKey.ts`, tested in `server/config/apiKey.test.ts`) at
  startup: if `OPENROUTER_API_KEY` isn't already set, it prompts for it interactively in the
  terminal, writes it to `.env`, and continues booting. Enter it once; every subsequent
  `npm run dev` picks it up automatically via `dotenv/config`.
- Node/TypeScript, Express backend + React/Vite frontend, `better-sqlite3`, Vitest.
- `npm test` from the repo root: 87/87 passing. `npm run typecheck` (`tsc --noEmit`): clean.
- `.env`, `node_modules`, `*.sqlite`, and `.worktrees` are all gitignored — nothing sensitive or
  generated has been pushed to GitHub.
