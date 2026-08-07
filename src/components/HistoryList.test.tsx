import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { HistoryList } from './HistoryList';
import * as api from '../api';

describe('HistoryList', () => {
  it('lists past sessions by prompt and calls onSelect when clicked', async () => {
    vi.spyOn(api, 'fetchHistory').mockResolvedValue([
      { id: 's1', prompt: 'First question', status: 'complete', rounds: [], verdictText: null, verdictTable: null, createdAt: '', errorMessage: null },
    ]);
    const onSelect = vi.fn();
    render(<HistoryList onSelect={onSelect} />);

    await waitFor(() => expect(screen.getByText('First question')).toBeInTheDocument());
    fireEvent.click(screen.getByText('First question'));

    expect(onSelect).toHaveBeenCalledWith('s1');
  });
});
