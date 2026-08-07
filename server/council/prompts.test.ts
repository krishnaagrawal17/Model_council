import { describe, it, expect, vi } from 'vitest';
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

  it('warns when verdict table is incomplete or missing', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const rounds: RoundResult[] = [
      {
        round: 2,
        answers: COUNCIL_MODELS.map((model) => ({ model, status: 'ok', text: `final-${model}`, confidence: 77 })),
      },
    ];
    // Missing VERDICT_TABLE: marker entirely
    const textWithoutMarker = 'Verdict text here. No table.';
    parseVerdictTable(textWithoutMarker, rounds);
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining(`expected ${COUNCIL_MODELS.length} verdict rows, got 0`),
    );
    spy.mockClear();

    // Missing one verdict line
    const verdictLines = COUNCIL_MODELS.slice(0, 3)
      .map((m) => `${MODEL_LABELS[m]} | agree`)
      .join('\n');
    const textWithIncompleteTable = `Verdict text here.\n\nVERDICT_TABLE:\n${verdictLines}`;
    parseVerdictTable(textWithIncompleteTable, rounds);
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining(`expected ${COUNCIL_MODELS.length} verdict rows, got 3`),
    );
    vi.restoreAllMocks();
  });

  it('parses a Markdown-table-formatted verdict section with leading/trailing pipes and a divider row', () => {
    const rounds: RoundResult[] = [
      {
        round: 2,
        answers: COUNCIL_MODELS.map((model) => ({ model, status: 'ok', text: `final-${model}`, confidence: 77 })),
      },
    ];
    const verdictLines = COUNCIL_MODELS.map((m) => `| ${MODEL_LABELS[m]} | agree |`).join('\n');
    const text = `Verdict text here.\n\nVERDICT_TABLE:\n| Model | Agreement |\n| --- | --- |\n${verdictLines}`;
    const table = parseVerdictTable(text, rounds);
    expect(table).toHaveLength(4);
    expect(table[0].agreement).toBe('agree');
    expect(table[0].confidence).toBe(77);
    expect(table[0].finalPosition).toBe(`final-${COUNCIL_MODELS[0]}`);
  });

  it('parses a row with bold markdown around the model name', () => {
    const rounds: RoundResult[] = [
      {
        round: 2,
        answers: COUNCIL_MODELS.map((model) => ({ model, status: 'ok', text: `final-${model}`, confidence: 77 })),
      },
    ];
    const verdictLines = COUNCIL_MODELS.map((m) => `**${MODEL_LABELS[m]}** | agree`).join('\n');
    const text = `Verdict text here.\n\nVERDICT_TABLE:\n${verdictLines}`;
    const table = parseVerdictTable(text, rounds);
    expect(table).toHaveLength(4);
    expect(table[0].agreement).toBe('agree');
    expect(table.map((r) => r.model)).toEqual(COUNCIL_MODELS);
  });
});
