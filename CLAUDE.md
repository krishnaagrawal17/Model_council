# Model Council — Project Memory

This file exists so a fresh session can resume implementation exactly where
the previous session left off, without re-deriving any of this from scratch.

## What this project is

A local web app: submit a prompt, and a council of four LLMs (via OpenRouter)
answer independently, then debate across up to three rounds, then a fifth
model (the synthesizer) writes a final verdict plus a per-model
agree/disagree/confidence table. Everything streams live, sessions persist,
and results export to Markdown.

Full product spec: `docs/superpowers/specs/2026-08-06-model-council-design.md`
Full implementation plan (17 TDD tasks): `docs/superpowers/plans/2026-08-06-model-council-implementation.md`

**Confirmed OpenRouter model roster** (verified against the live catalog on 2026-08-06 — reverify if it's been a while):

| Role | Model | OpenRouter ID |
|---|---|---|
| Council | Claude Sonnet 5 | `anthropic/claude-sonnet-5` |
| Council | GPT-5.6 Luna | `openai/gpt-5.6-luna` |
| Council | Grok latest | `x-ai/grok-latest` (aliases to `x-ai/grok-4.5`) |
| Council | Gemini 3.5 Flash Lite | `google/gemini-3.5-flash-lite` |
| Synthesizer | Claude Opus 5 | `anthropic/claude-opus-5` |

Estimated real cost per prompt run: **~$0.08 (2 rounds) to ~$0.13 (3 rounds)** — dominated by the Opus 5 synthesizer re-reading the transcript twice. Automated tests never spend real money (see below).

## Hard constraints (do not violate these)

- **Everything lives inside `model_council/`.** Nothing for this project is ever created or modified outside this folder — this was an explicit, repeated instruction from the user. The parent directory (`/Users/krishnaagrawal/Claude-Code/`) contains an unrelated project (`Leadership/`, the AI leadership tutor) with its own separate git history — do not touch it.
- Debate rounds show real model names to each other — never anonymize.
- Hard cap of 3 rounds; Round 3 only runs if the synthesizer's convergence check after Round 2 reports `NOT_CONVERGED`.
- A council model that errors/times out is marked `no_response` for that round and never blocks the round.
- Synthesizer calls get automatic retry-with-backoff — no verdict without them.
- Automated tests never call real OpenRouter — always `FakeOpenRouterClient`. One manual real-API smoke test happens once, at the very end (Task 17), not in CI.
- Single local user, no auth, SQLite only (no external DB).

(Full list: see "Global Constraints" in the plan file.)

## Repo / worktree structure — READ THIS FIRST WHEN RESUMING

- **Main repo root:** `/Users/krishnaagrawal/Claude-Code/model_council/` — its own independent git repo (`git init`'d fresh, not connected to the parent `Claude-Code` repo or its history). Branch `main` currently holds: the 6 installed PM skills (`.claude/skills/`), the design spec, and the implementation plan. No app code lives on `main` yet.
- **Implementation work happens in a worktree:** `/Users/krishnaagrawal/Claude-Code/model_council/.worktrees/model-council-implementation/`, on branch `model-council-implementation`. **This is where all the actual code is.** `cd` there to continue.
- The worktree was created manually (`git worktree add .worktrees/model-council-implementation -b model-council-implementation`) after the `EnterWorktree` tool incorrectly rooted itself in the parent `Claude-Code` repo instead of `model_council` — if you ever use that tool again here, verify with `git rev-parse --show-toplevel` immediately after that it resolves to somewhere under `model_council/`, not the parent.
- `.worktrees/` is gitignored from `main`.

## How this was built so far

1. **Brainstorming** (`superpowers:brainstorming`) → design spec written using the `create-prd` skill (one of the 6 PM skills installed from `phuryn/pm-skills` — the others: `pre-mortem`, `test-scenarios`, `identify-assumptions-new`, `shipping-artifacts`, `intended-vs-implemented`) → committed to `main`.
2. **Planning** (`superpowers:writing-plans`) → 17-task TDD implementation plan → committed to `main`.
3. **Execution** (`superpowers:subagent-driven-development`), in progress — this is the part to resume.

## Resuming execution — exact steps

1. `cd /Users/krishnaagrawal/Claude-Code/model_council/.worktrees/model-council-implementation`
2. Invoke the `superpowers:subagent-driven-development` skill.
3. Point it at the plan: `docs/superpowers/plans/2026-08-06-model-council-implementation.md`
4. It resolves the workspace via `scripts/sdd-workspace` to:
   `.superpowers/sdd/2026-08-06-model-council-implementation/`
   — the ledger there (`progress.md`) already has `Task 1`–`Task 7` marked complete. Per the skill's own rules, **do not re-dispatch those** — resume at **Task 8**.
5. Follow the skill's normal per-task loop from there: task-brief → dispatch implementer (haiku for mechanical/transcription tasks with complete code in the brief, sonnet for tasks involving concurrency/parsing/judgment) → review (haiku for simple diffs, sonnet for subtler ones) → fix loop on any Critical/Important finding → ledger entry → next task.

### Task status (as of this checkpoint)

| Task | Status | Commits (in the worktree) |
|---|---|---|
| 1. Project Scaffolding | ✅ complete | `0fc4691..8d9d84e` |
| 2. Shared Types & Model Roster | ✅ complete | `8d9d84e..1890e40` |
| 3. OpenRouter Client | ✅ complete (1 fix round) | `1890e40..7cdb266` |
| 4. Session Store (SQLite) | ✅ complete (1 fix round) | `7cdb266..f4fd957` |
| 5. Prompt Builders & Parsers | ✅ complete (1 fix round) | `f4fd957..a14d3b0` |
| 6. Orchestrator — Round 1 | ✅ complete (1 fix round) | `a14d3b0..0fa60e0` |
| 7. Orchestrator — Debate Rounds (2 & 3) | ✅ complete (1 fix round, 1 reviewer false-positive overturned by direct verification) | `0fa60e0..8d48956` |
| **8. Orchestrator — Convergence Check & Synthesizer Retry** | **⏭️ next up** | — |
| 9. Orchestrator — Final Synthesis & full `run()` | pending | — |
| 10. Per-Model Retry | pending | — |
| 11. SSE Hub | pending | — |
| 12. Express Routes & Markdown Export | pending | — |
| 13. Frontend — API client & live stream hook | pending | — |
| 14. Frontend — PromptForm & CouncilBoard | pending | — |
| 15. Frontend — VerdictTable & ExportButton | pending | — |
| 16. Frontend — History & App composition | pending | — |
| 17. Server wiring & manual OpenRouter smoke test | pending | — |

Current worktree `HEAD`: `8d48956` on branch `model-council-implementation`. All tests passing at this point (run `npm test` in the worktree to confirm — should be 10/10 across `shared/types.test.ts`, `server/openrouter/client.test.ts`, `server/db/store.test.ts`, `server/council/prompts.test.ts`, `server/council/orchestrator.test.ts`).

### Notes on how review findings were handled so far

Every task so far except Task 1 and Task 2 needed one fix round (Important findings — mostly test-coverage gaps, one missing existence-guard, one silent-failure risk). All were resolved in a single round each. Task 7's scoped re-review raised a "Critical" finding claiming a signature mismatch between `FakeOpenRouterClient` and `RealOpenRouterClient` — this was verified false by direct inspection (`grep` showed both already had identical signatures) plus a clean test run, so it was parked with a ruling rather than spent on another fix round. Full detail for every finding and ruling is in the ledger:
`.superpowers/sdd/2026-08-06-model-council-implementation/progress.md` (inside the worktree).

### One-off process note

Partway through Task 7, the user asked to be checked in with once before Task 8 specifically was dispatched — that checkpoint is what produced this file. It was a one-time request, not a standing rule to pause before every task — proceed through Tasks 8–17 continuously unless told otherwise, per the normal `subagent-driven-development` flow (no "should I continue?" prompts between tasks).

## After all 17 tasks are done

Per `subagent-driven-development`: dispatch the final whole-branch code review (most capable model), on the diff from `MERGE_BASE` (= `git merge-base main HEAD` inside the worktree) to `HEAD`. Fix any findings in one batch, one scoped re-review, adjudicate residuals. Then delete the plan's SDD workspace and use `superpowers:finishing-a-development-branch` to decide how `model-council-implementation` gets merged back into `main`.

## Environment

- `OPENROUTER_API_KEY` goes in a local `.env` (copied from `.env.example`, gitignored) — not yet created since Task 17 is what needs it for the manual smoke test.
- Node/TypeScript, Express backend + React/Vite frontend, `better-sqlite3`, Vitest. `npm install` already run in the worktree.
