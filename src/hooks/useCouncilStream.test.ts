import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCouncilStream } from './useCouncilStream';

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  onmessage: ((event: { data: string }) => void) | null = null;
  constructor(public url: string) {
    FakeEventSource.instances.push(this);
  }
  close() {}
  emit(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }
}

beforeEach(() => {
  FakeEventSource.instances = [];
  vi.stubGlobal('EventSource', FakeEventSource as any);
});

describe('useCouncilStream', () => {
  it('accumulates tokens per model within a round as they stream in', () => {
    const { result } = renderHook(() => useCouncilStream('session-1'));
    const source = FakeEventSource.instances[0];

    act(() => {
      source.emit({ type: 'token', phase: 1, model: 'anthropic/claude-sonnet-5', token: 'Hel' });
      source.emit({ type: 'token', phase: 1, model: 'anthropic/claude-sonnet-5', token: 'lo' });
    });

    expect(result.current.roundsInProgress[1]['anthropic/claude-sonnet-5']).toBe('Hello');
  });

  it('records a completed round and marks status complete on session_complete', () => {
    const { result } = renderHook(() => useCouncilStream('session-1'));
    const source = FakeEventSource.instances[0];

    act(() => {
      source.emit({
        type: 'round_complete',
        round: 1,
        result: { round: 1, answers: [{ model: 'anthropic/claude-sonnet-5', status: 'ok', text: 'Hello', confidence: 80 }] },
      });
      source.emit({ type: 'session_complete', verdictText: 'Final answer', verdictTable: [] });
    });

    expect(result.current.completedRounds).toHaveLength(1);
    expect(result.current.status).toBe('complete');
    expect(result.current.verdictText).toBe('Final answer');
  });

  it('records a model_error without marking the session errored', () => {
    const { result } = renderHook(() => useCouncilStream('session-1'));
    const source = FakeEventSource.instances[0];

    act(() => {
      source.emit({ type: 'model_error', round: 1, model: 'openai/gpt-5.6-luna', message: 'timeout' });
    });

    expect(result.current.errors).toHaveLength(1);
    expect(result.current.status).toBe('running');
  });

  it('upserts round_complete events by round number instead of duplicating', () => {
    const { result } = renderHook(() => useCouncilStream('session-1'));
    const source = FakeEventSource.instances[0];

    act(() => {
      source.emit({
        type: 'round_complete',
        round: 1,
        result: { round: 1, answers: [{ model: 'anthropic/claude-sonnet-5', status: 'ok', text: 'First', confidence: 50 }] },
      });
      source.emit({
        type: 'round_complete',
        round: 1,
        result: { round: 1, answers: [{ model: 'anthropic/claude-sonnet-5', status: 'ok', text: 'Updated', confidence: 80 }] },
      });
    });

    expect(result.current.completedRounds).toHaveLength(1);
    expect(result.current.completedRounds[0].answers[0].text).toBe('Updated');
  });
});
