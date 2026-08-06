# PRD: Model Council

## 1. Summary

Model Council is a local web app that takes a single prompt and runs it through four frontier LLMs — Claude Sonnet 5, GPT-5.6 Luna, Grok latest, and Gemini 3.5 Flash Lite — who answer independently, then see and respond to each other's answers across up to three rounds. Claude Opus 5 acts as synthesizer, judging when the group has converged and writing a final verdict, shown alongside a table of each model's agreement and confidence. The whole debate streams live, and every session is saved and exportable as Markdown.

## 2. Contacts

| Name | Role | Comment |
|---|---|---|
| Krishna Agrawal | Product owner, developer, sole user | Personal tool — no external stakeholders |

## 3. Background

Trusting a single model's answer on a judgment call means trusting whatever that one model happened to get right or wrong that day, with no visibility into how confident or contested the answer really is. OpenRouter now provides one unified API across Claude, GPT, Gemini, and Grok, which makes it practical to build a genuine multi-model "council" — independent answers, cross-examination, a synthesized verdict — without juggling four separate provider SDKs and API keys. That single point of access is what makes this buildable now rather than a bigger integration project.

## 4. Objective

Give a fast, structured way to get several frontier models' independent takes on a prompt, have them challenge each other, and land on one synthesized verdict — instead of trusting whichever single model is open, or manually pasting the same prompt into four chat tabs and eyeballing the differences.

**Benefit:** higher-confidence answers on questions that matter, a clear signal (model disagreement) for when a question deserves more human scrutiny, and time saved over manual cross-checking.

**Key Results (v1):**
- A full council run (independent Round 1 → Round 2 → auto-triggered Round 3 if needed → synthesized verdict) completes end-to-end for a real prompt, with the debate visibly streaming live.
- Every completed session is persisted and browsable in history, and exportable to Markdown, with no data loss.
- Real per-prompt cost stays in the neighborhood of the ~$0.08–$0.13 estimate (see Assumptions) — a large deviation would mean the model roster or round logic needs revisiting.

## 5. Market Segment(s)

One segment: Krishna, using this as personal decision support for prompts where a second (third, fourth, fifth) opinion is worth the extra wait and the few cents of API cost — not for routine one-shot queries. No external users, no auth requirements, no constraints beyond personal OpenRouter spend.

## 6. Value Proposition(s)

**Job to be done:** "When I have a prompt I don't want to trust to a single model, I want several frontier models to reason independently, challenge each other, and either converge or clearly show me they don't — so I can act with more confidence, or know to dig in myself."

- **Gain:** cross-model agreement or disagreement visible at a glance (verdict table), full debate transcript available to inspect, a saved record to revisit or export.
- **Pain avoided:** manually pasting one prompt into four different chat tools and comparing answers by hand.
- **Why this beats asking one model:** a single confident-sounding answer can hide real uncertainty; a council surfaces disagreement instead of masking it.

## 7. Solution

### 7.1 UX / User Flow

1. Krishna types a prompt into the prompt box and submits.
2. **Round 1** panel appears with four live streaming panes (Sonnet 5, GPT-5.6 Luna, Grok latest, Gemini 3.5 Flash Lite), each typing out its independent answer token by token.
3. Once all four finish, **Round 2** begins automatically: each model is shown the other three's named Round 1 answers and streams a revised position plus a stated confidence level.
4. Opus 5 runs a quick convergence check. If the council has converged, the app moves straight to the verdict. If not, **Round 3** runs the same way as Round 2, then the app moves to the verdict regardless of outcome (hard cap at 3 rounds).
5. Opus 5 streams the final **verdict**, and a **table** appears showing, per model: final position, agree/disagree/partial with the verdict, and confidence.
6. Krishna can **export** the full session (prompt, every round, verdict, table) as a Markdown file, or leave it — it's already saved.
7. A **History** view lists past sessions; opening one replays the stored transcript and table (not a live re-stream).

### 7.2 Key Features

- **Independent-then-informed debate**: Round 1 is blind; Rounds 2–3 show each model the others' answers by name (not anonymized), and ask for a revised position and self-reported confidence.
- **Auto-triggered Round 3**: driven by a dedicated Opus 5 convergence check after Round 2, not a fixed rule — Round 3 only runs when real disagreement remains.
- **Live token streaming**: every model's answer, in every round, streams live via a single multiplexed Server-Sent Events connection tagged by model and round.
- **Verdict table**: final position, agree/disagree/partial vs. the verdict, and confidence (carried from each model's last round of participation) for all four council models.
- **Markdown export**: full prompt, every round's transcripts, verdict, and table, serialized from what's already stored.
- **Persisted history**: every completed session is saved to SQLite and browsable later.
- **Graceful degradation on failure**: a council model that times out or errors is marked "No response" for that round and excluded from the context passed forward — the debate is never blocked by one flaky model. A per-model retry button re-runs just that model for that round. The synthesizer (single point of failure for the verdict) gets automatic retries with backoff before surfacing a session-level error with a manual "Retry synthesis" option; all round data already collected is preserved either way.

### 7.3 Technology

- **Backend:** Node/Express, orchestrating concurrent streaming calls to OpenRouter and multiplexing them onto one SSE connection per session.
- **Frontend:** React + Vite + TypeScript single-page app.
- **Persistence:** SQLite via `better-sqlite3` — local file, zero setup, matches a single-user local tool.
- **Model gateway:** OpenRouter, single API/key for every model in the roster.
- **Testing:** Vitest across backend and frontend, built test-first (TDD). All automated tests run against a mocked `OpenRouterClient` — no real API calls, no real spend, in the regular test suite. One real end-to-end smoke test against live OpenRouter is planned during implementation to confirm the integration genuinely works, at a cost of a few cents, run once — not part of ongoing CI.

**Confirmed model roster (OpenRouter IDs, verified against the live catalog on 2026-08-06):**

| Role | Model | OpenRouter ID |
|---|---|---|
| Council | Claude Sonnet 5 | `anthropic/claude-sonnet-5` |
| Council | GPT-5.6 Luna | `openai/gpt-5.6-luna` |
| Council | Grok latest | `x-ai/grok-latest` (aliases to `x-ai/grok-4.5`) |
| Council | Gemini 3.5 Flash Lite | `google/gemini-3.5-flash-lite` |
| Synthesizer | Claude Opus 5 | `anthropic/claude-opus-5` |

### 7.4 Assumptions

- The five OpenRouter model IDs above remain valid and available at implementation time; OpenRouter catalogs shift, so this should be reverified when the `OpenRouterClient` is actually built.
- Per-prompt cost is estimated at roughly **$0.08 (2 rounds, converged) to $0.13 (3 rounds)**, based on current OpenRouter pricing and typical prompt/answer lengths — the synthesizer (Opus 5) accounts for roughly half of this, since it re-reads the full transcript twice (convergence check + final verdict). Actual cost will vary with prompt and answer length.
- Single local user, single machine, no authentication needed, not deployed publicly.
- No resumable live view if the browser reloads mid-run — the orchestrator keeps running and persists server-side regardless, but the live stream isn't reconnectable in v1.

## 8. Release

**Single-phase v1** — the full scope described above (round-by-round debate with auto-triggered Round 3, verdict table, streaming UI, Markdown export, persisted history, per-model retry, synthesizer retry) ships together. The feature set is already scoped tightly for a personal tool; there's no meaningful subset worth cutting for an earlier release.

**Explicitly out of scope for v1** (candidates for later, not committed):
- Resuming a live view of an in-progress run after a browser reload.
- Anonymized model identities during debate (explicitly rejected — Krishna wants to see which model said what).
- Multi-user support or authentication.
- Model providers or gateways beyond OpenRouter.
