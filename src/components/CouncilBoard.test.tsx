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
