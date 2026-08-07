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
