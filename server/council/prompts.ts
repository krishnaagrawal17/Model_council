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
  if (rows.length !== COUNCIL_MODELS.length) {
    console.warn(
      `parseVerdictTable: expected ${COUNCIL_MODELS.length} verdict rows, got ${rows.length}. Synthesizer output may not match the expected format.`,
    );
  }
  return rows;
}
