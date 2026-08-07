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
| Council | Grok latest | `~x-ai/grok-latest` — **note the leading `~`**. OpenRouter's catalog lists this alias-routing entry as `~x-ai/grok-latest`; the bare string `x-ai/grok-latest` (no tilde) gets rejected outright with `400: not a valid model ID`. Aliases to `x-ai/grok-4.5`. Confirmed live 2026-08-07 by curling `https://openrouter.ai/api/v1/chat/completions` directly with both forms. |
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

## Current status: all 17 tasks reviewed, smoke test run, frontend redesigned — but there is uncommitted work

All implementation, per-task review, and the final whole-branch review (with its fix wave) are done and committed through `dbe5406`. **Task 17 Step 7 (the manual real-OpenRouter smoke test) has now been run** by the user and it caught one real, shipping bug (wrong Grok model ID — fixed). After that, the user asked for a full frontend visual redesign as ad-hoc follow-on work, outside the original 17-task plan. Both are described in detail in "Post-review session" below.

**Important: none of that is committed yet.** `git status` in the worktree currently shows uncommitted changes to `shared/types.ts`, `server/index.ts`, and every frontend `src/` file, plus new untracked files (`src/index.css`, `src/modelTheme.ts`, `src/components/{AboutSection,AuroraBackground,FormattedText}.tsx`, and `server/config/`). The `server/config/` / `server/index.ts` changes (the `ensureApiKey()` interactive-prompt feature) are *also* uncommitted — an earlier version of this file incorrectly claimed that feature was "included in current worktree HEAD"; it never was. If resuming, don't re-invoke `subagent-driven-development` or re-dispatch any of Tasks 1–17 — they're all done. Do check `git status` first and decide with the user how to commit the pending work before invoking `finishing-a-development-branch`.

## Resuming execution (historical — all steps below are now complete)

1. `cd /Users/krishnaagrawal/Claude-Code/model_council/.worktrees/model-council-implementation`
2. Invoke the `superpowers:subagent-driven-development` skill.
3. Point it at the plan: `docs/superpowers/plans/2026-08-06-model-council-implementation.md`
4. It resolves the workspace via `scripts/sdd-workspace` to:
   `.superpowers/sdd/2026-08-06-model-council-implementation/`
   — the ledger there (`progress.md`) has every task through Task 17 (automated portion) marked complete, plus the full final-review record.
5. Followed the skill's normal per-task loop: task-brief → dispatch implementer (haiku for mechanical/transcription tasks with complete code in the brief, sonnet for tasks involving concurrency/parsing/judgment) → review (haiku for simple diffs, sonnet for subtler ones) → fix loop on any Critical/Important finding → ledger entry → next task.

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
| 8. Orchestrator — Convergence Check & Synthesizer Retry | ✅ complete (review clean, 0 fix rounds) | `8d48956..c022589` |
| 9. Orchestrator — Final Synthesis & full `run()` | ✅ complete (review clean, 0 fix rounds) | `c022589..194d74d` |
| 10. Per-Model Retry | ✅ complete (review clean, 0 fix rounds) | `194d74d..a422981` |
| 11. SSE Hub | ✅ complete (review clean, 0 fix rounds) | `a422981..5d6fdfa` |
| 12. Express Routes & Markdown Export | ✅ complete (1 fix round — 2 Important findings) | `5d6fdfa..6e93d0e` |
| 13. Frontend — API client & live stream hook | ✅ complete (1 fix round — 2 real bugs, plan-mandated, user confirmed the fix before dispatch) | `6e93d0e..bc8f9a7` |
| 14. Frontend — PromptForm & CouncilBoard | ✅ complete (1 fix round — 3 test-coverage-only findings) | `bc8f9a7..bccb872` |
| 15. Frontend — VerdictTable & ExportButton | ✅ complete (review clean, 0 fix rounds) | `bccb872..022f563` |
| 16. Frontend — History & App composition | ✅ complete (review clean, 0 fix rounds) | `022f563..9061729` |
| 17. Server wiring (Steps 1–6) | ✅ complete (review clean, 0 fix rounds) | `9061729..2c78306` |
| **17. Manual OpenRouter smoke test (Step 7)** | **✅ run — caught and fixed a real bug (wrong Grok model ID, see "Post-review session" below)** | uncommitted |

Final whole-branch review (all 25 commits, `main`'s merge-base `0fc4691` → `2c78306`) ran on Opus, came back "Ready to merge? With fixes." One fix wave (commits `2c78306..dbe5406`) addressed every bug-class finding; a scoped re-review confirmed all addressed with zero new breakage. Full detail in "Final whole-branch review" below.

Current worktree `HEAD`: `dbe5406` on branch `model-council-implementation`. All tests passing at this point (run `npm test` in the worktree to confirm — should be **80/80** across all test files, plus `npx tsc --noEmit` should exit clean with zero errors, and `npm run typecheck` runs the same check).

### Notes on how review findings were handled so far

Tasks 1, 2, 8, 9, 10, 11 reviewed clean with zero fix rounds. Every other task needed exactly one fix round, all resolved in that single round:

- **Task 7**: scoped re-review raised a "Critical" finding claiming a `FakeOpenRouterClient`/`RealOpenRouterClient` signature mismatch — verified false by direct inspection plus a clean test run, parked with a ruling.
- **Task 12** (Express routes): 2 Important findings — missing route-test coverage for `/stream`, `/export.md`, and the retry endpoint's success/error paths; and a fragile `catch` in the retry route that mapped *any* thrown error to 404 (now narrowed to only map "not found"-type errors to 404, else falls through toward 500). Both fixed and re-reviewed clean.
- **Task 13** (API client & stream hook): 2 **real, shipping bugs** that were present in the plan's own brief code verbatim — not implementer deviations. (a) `retryModel()` in `src/api.ts` didn't URL-encode the model id, and every real `CouncilModelId` contains a `/` (e.g. `anthropic/claude-sonnet-5`), so retry requests would 404 against the real Express route for every real model. (b) The `round_complete` reducer in `useCouncilStream.ts` blindly appended instead of upserting by round number, so a legitimate retry-triggered re-emit of `round_complete` for an already-completed round produced a duplicate entry in `completedRounds` instead of replacing it. Per the skill's "finding conflicts with plan text → ask the human" rule, this was surfaced to the user before fixing (not silently patched or silently left broken) — user said fix both. Both fixed, each with a regression test, and re-reviewed clean.
- **Task 14** (PromptForm & CouncilBoard): 3 Important/Minor findings, all test-coverage-only — the underlying component logic was already correct on inspection, it just had no regression guard for: `disabled` actually disabling both the textarea and the button, whitespace-only input being rejected (not just fully-empty input), and a completed round's answer correctly taking visual precedence over stale in-progress tokens for the same model. All three got dedicated tests, re-reviewed clean.
- **Task 15** (VerdictTable & ExportButton): reviewed clean, 0 fix rounds — pure transcription of complete plan-provided code, no deviations.
- **Task 16** (History & App composition): reviewed clean, 0 fix rounds. Implementer independently confirmed the SSE `round_start`-drop gap (see below) is mechanically real, not just theoretical — but the reviewer's own re-check found it's currently dead code with zero observable UI effect, since nothing downstream ever had a case for `round_start`. Downgraded to Minor.
- **Task 17** (server wiring, Steps 1–6 only): reviewed clean, 0 fix rounds. Step 7 (manual smoke test) was deliberately never dispatched to a subagent — it needs a real API key and spends real money, so it's reserved for the user (see "Environment").

**Deferred Minor findings from per-task reviews (folded into or superseded by the final whole-branch review below):**
- Task 8: no test covers `callSynthesizerWithRetry`'s retry-exhaustion path — turned out to already be covered end-to-end by `orchestrator.test.ts`; confirmed and closed at the final review.
- Task 12: duplicated "lookup-or-404" pattern across 3 route handlers; a dead `.catch(() => {})` on `orchestrator.run()` in `POST /sessions`; the SSE stream test's bespoke `http.get` pattern. All reviewed at the final pass — the `http.get`/`require` pattern turned out to be the actual cause of a `tsc` error and got fixed as part of the final fix wave (see below); the other two were judged fine to ship as-is.
- Task 16: `round_start` SSE drop (see above) and missing error handling on `App.tsx`/`HistoryList.tsx` API calls — both re-triaged at the final review (see below).

### One-off process note (resolved)

The user asked for a check-in before dispatching specific tasks twice in this project: once before Task 8, and again before Task 15. Both times, when asked explicitly whether the pause was one-time or a standing rule, the user chose "proceed continuously" rather than "check in before every remaining task." Both were one-time requests — no standing check-in rule was ever established, and Tasks 16–17 proceeded to completion without further check-ins, per that resolution.

## Final whole-branch review (done)

Dispatched per `subagent-driven-development`'s closing step: most capable model (Opus), diff from `MERGE_BASE` (`0fc4691` = `git merge-base main HEAD`) to the pre-fix `HEAD` (`2c78306`), all 25 commits / 17 tasks. Verdict: **"Ready to merge? With fixes."**

Findings split into two categories, and the user made an explicit scope call on how to handle each:

**Bug-class findings (all fixed in one wave, commits `2c78306..dbe5406`, re-reviewed clean):**
1. **(Critical)** `.env` was never loaded — `server/index.ts` read `OPENROUTER_API_KEY` but nothing populated it from the file, so the documented setup instructions would throw immediately. Fixed with `dotenv` + `import 'dotenv/config'` as the first line of `server/index.ts`.
2. **(Important)** `parseVerdictTable`'s regex was brittle enough to plausibly return zero rows against real synthesizer output (Markdown table pipes, bold emphasis, divider rows) — the single highest-risk item for the still-pending smoke test. Hardened with pipe/emphasis stripping, divider-row skipping, and a `MODEL_LABELS`-substring fallback match.
3. **(Important)** `npx tsc --noEmit` failed with 17 errors (`strict: true` was decorative — nothing ran a typecheck). Root causes: `vitest.setup.ts` (which registers jest-dom matchers) was missing from `tsconfig.json`'s `include`, and a redundant `require('http')` in a route test produced an implicit-`any`. Both fixed; `npm run typecheck` (`tsc --noEmit`) added as a standing script.
4. **(Important)** Session history never refreshed after a run completed — required a full page reload. Fixed via a `refreshKey` counter in `App.tsx`, bumped only when a *live* session's status transitions to `complete` (not when merely viewing an already-complete historical session), threaded into `HistoryList`'s fetch effect.
5. **(Minor)** Markdown export rendered a literal `—%` for null confidence instead of bare `—`. Fixed to match `VerdictTable.tsx`'s existing correct ternary.
6. **(Minor)** A fast double-click on submit could launch two real (paid) council runs before `createSession()` resolved. Fixed with a `submitting` state flag closing the window.
7. **(Minor)** Redundant `// server/app.ts` / `// server/index.ts` leading comments (copy-pasted from the plan's code fences) — deleted.

**Feature-scope-gap findings — the design spec describes these, but no task in the 17-task plan ever covered them. Per explicit user decision, these ship as documented follow-up work, not blockers for this branch:**
- No per-model retry button in the UI (the backend route, orchestrator method, and tests all exist and work — nothing in the frontend calls it).
- No session-level error surfacing or "Retry synthesis" button — a run that exhausts the synthesizer's retries goes silent; the form just quietly re-enables.
- The verdict doesn't stream live as the spec describes — synthesis tokens are emitted by the orchestrator but nothing renders them; the verdict appears all at once at `session_complete`.
- The verdict table/Markdown export are missing the "final position" column the spec calls for (the data is parsed and persisted, just not displayed or exported).
- Zero error handling on any frontend API call (`createSession`/`fetchSession`/`fetchHistory`) — this is plan-mandated code verbatim from the brief, not an implementer deviation, and compounds with the missing error-surfacing item above.

Reviewer's own process observation, worth remembering for future plans: the implementation plan's "Self-Review Notes" claimed every spec section mapped to a task — that claim didn't hold. All five feature-scope gaps above are in the design spec's §7.1/§7.2 but appear in no task, because each task was reviewed against its own brief rather than against the original spec. A future plan should have an independent spec-to-task traceability check, not one the plan author self-certifies.

A dozen additional Minor items (parsing edge cases, a stale-verdict flash, an SSE cleanup gap, no README, etc.) are logged verbatim in the SDD ledger (`.superpowers/sdd/2026-08-06-model-council-implementation/progress.md`) — not reproduced here, not blocking.

Full detail for every finding, ruling, and re-review verdict is in that ledger file — it is the authoritative record; this section is a summary.

## Post-review session: smoke test, Grok bug fix, frontend redesign (2026-08-07)

This section covers everything that happened after the final whole-branch review, in the resumed session on 2026-08-07. **All of it is currently uncommitted** — see "Current status" above.

### Smoke test (Task 17 Step 7) — run, caught a real bug

The user ran `npm run dev` against the real OpenRouter API. Finding: **the Grok council model never responded.** Root cause investigation (via `superpowers:systematic-debugging`) traced it to the model ID itself, not the app's error handling:

- The app's graceful-degradation behavior (mark a failing model `no_response`, never block the round) worked exactly as designed — it wasn't a bug in the orchestrator.
- The actual bug: `shared/types.ts` hardcoded `'x-ai/grok-latest'`, but curling OpenRouter's live `/api/v1/chat/completions` directly with that exact string returns `400: "x-ai/grok-latest is not a valid model ID"`. OpenRouter's catalog (`/api/v1/models`) lists the real alias-routing entry as **`~x-ai/grok-latest`** — with a leading tilde. Curling with the tilde succeeds and resolves to `x-ai/grok-4.5`.
- Fix: updated all 4 occurrences in `shared/types.ts` (the only file referencing the string outside historical spec/plan docs, which were left as-is). Verified with a direct before/after `curl` against the real API (not just unit tests, since `FakeOpenRouterClient` can't catch a wrong-model-ID-string bug), then `npm run typecheck` (clean) and `npm test` (87/87 passing).
- The rest of the smoke-test checklist (Round 2 debate, convergence check, verdict table, Markdown export) was exercised by the user during testing but not itemized point-by-point in this session — the user's own confirmation was "it works well."

### Frontend redesign — ad-hoc follow-on, not in the original 17-task plan

User feedback after the smoke test: the UI was unstyled (literally zero CSS existed anywhere in `src/` before this), model responses ran together into one paragraph (a raw `<p>{text}</p>` collapses newlines, so any bullets/points a model wrote got squashed), and the homepage had no explanation of what the app does. Went through `superpowers:brainstorming` (compressed — user explicitly wanted to move straight to implementation and test at the end rather than iterate question-by-question); the one real design decision point (background treatment + content placement) was resolved via `AskUserQuestion`:
- **Background**: CSS aurora/glow orbs (blurred, drifting, colored gradient blobs behind the page) + frosted-glass cards — chosen over a real `three.js`/WebGL scene (rejected: new ~500KB dependency, more complexity) or a static SVG illustration.
- **Content placement**: a full "About" landing section between the header and the prompt form (chosen over a compact one-line hero blurb).

What shipped (all plain CSS, zero new npm dependencies):
- `src/index.css` (new) — CSS custom-property color tokens (a distinct accent color per council model: Claude=orange, GPT=teal, Grok=violet, Gemini=blue, synthesizer=gold; plus agree/disagree/partial colors), aurora `@keyframes` (respects `prefers-reduced-motion`), card/grid/badge styles.
- `src/modelTheme.ts` (new) — maps each `CouncilModelId` to its accent color + avatar initial.
- `src/components/FormattedText.tsx` (new) — splits raw model-response text on line breaks and renders `-`/`*`/numbered lines as real `<li>` bullets, everything else as spaced paragraphs. This is what fixed the "no spacing between points" complaint. Used by `CouncilBoard` and `VerdictTable`.
- `src/components/AboutSection.tsx` (new) — the "What is Model Council?" explainer + 4 color-coded benefit cards (independent takes / real debate / confidence-scored verdict / full transparency).
- `src/components/AuroraBackground.tsx` (new) — the drifting gradient-orb background, `position: fixed`, `aria-hidden`.
- `App.tsx`, `CouncilBoard.tsx`, `VerdictTable.tsx`, `PromptForm.tsx`, `HistoryList.tsx`, `ExportButton.tsx`, `main.tsx` — updated to use the new classes/theme/components. No data flow or logic changes — purely presentational, plus the `FormattedText` formatting helper.
- Verified after every change: `npm run typecheck` clean, `npm test` 87/87 passing (no test changes needed — component text content stayed exact-match compatible), and the running dev server's Vite HMR log confirmed each file actually hot-reloaded.

### Next step: commit the pending work, then `finishing-a-development-branch`

Per `subagent-driven-development`'s closing sequence, the plan was: delete the plan's SDD workspace (`.superpowers/sdd/2026-08-06-model-council-implementation/`) and invoke `superpowers:finishing-a-development-branch` to decide how `model-council-implementation` merges into `main`. That's still the right next step, but **first decide with the user how to commit the currently-uncommitted work** (the `ensureApiKey()` feature, the Grok fix, and the frontend redesign) — `finishing-a-development-branch` expects a coherent commit history, not a dirty working tree.

## Environment

- `OPENROUTER_API_KEY` goes in a local `.env` (gitignored, copied from `.env.example`). **You don't have to create `.env` by hand** — `server/index.ts` calls `ensureApiKey()` (`server/config/apiKey.ts`, tested in `server/config/apiKey.test.ts`) at startup: if `OPENROUTER_API_KEY` isn't already set, it prompts for it interactively in the terminal, writes it to `.env` (creating the file if needed, or replacing an existing empty/placeholder line without duplicating it), and continues booting. Enter it once in any terminal and every subsequent `npm run dev` — new terminal or not — picks it up from `.env` via `dotenv/config` without asking again. **This feature is currently uncommitted working-tree state** (`server/config/` is untracked, `server/index.ts` is modified) — see "Current status" above.
- The manual smoke test (Task 17 Step 7) has been run — see "Post-review session" above for what it found and fixed. To rerun the app locally: `cd /Users/krishnaagrawal/Claude-Code/model_council/.worktrees/model-council-implementation && npm run dev`, then open the printed Vite URL. Real prompts cost a few cents in OpenRouter usage.
- Node/TypeScript, Express backend + React/Vite frontend, `better-sqlite3`, Vitest. `npm install` already run in the worktree.
- Current worktree `HEAD` is `dbe5406`, but there are substantial uncommitted changes on top of it (the apiKey-prompt feature, the Grok model-ID fix, and the full frontend redesign — see "Current status" above for the exact file list). 87/87 tests passing, `tsc --noEmit` clean, against the working tree as it currently stands.
