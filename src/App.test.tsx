import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from './App';
import * as api from './api';

beforeEach(() => {
  vi.spyOn(api, 'fetchHistory').mockResolvedValue([]);
});

describe('App', () => {
  it('renders the prompt form and history section', () => {
    render(<App />);
    expect(screen.getByPlaceholderText('Ask the council...')).toBeInTheDocument();
    expect(screen.getByText('History')).toBeInTheDocument();
  });
});
