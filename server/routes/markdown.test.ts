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
