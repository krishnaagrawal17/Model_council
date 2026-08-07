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
