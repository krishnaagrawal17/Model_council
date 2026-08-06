import { describe, it, expect } from 'vitest';
import { SessionStore } from './store';

describe('SessionStore', () => {
  it('creates a session and retrieves it with defaults', () => {
    const store = new SessionStore(':memory:');
    store.createSession('s1', 'Is this a good idea?');
    const session = store.getSession('s1');
    expect(session).toMatchObject({
      id: 's1',
      prompt: 'Is this a good idea?',
      status: 'running',
      rounds: [],
      verdictText: null,
      verdictTable: null,
      errorMessage: null,
    });
  });

  it('appends rounds in order', () => {
    const store = new SessionStore(':memory:');
    store.createSession('s1', 'prompt');
    store.appendRound('s1', { round: 1, answers: [] });
    store.appendRound('s1', { round: 2, answers: [] });
    const session = store.getSession('s1');
    expect(session?.rounds.map((r) => r.round)).toEqual([1, 2]);
  });

  it('sets the verdict and marks the session complete', () => {
    const store = new SessionStore(':memory:');
    store.createSession('s1', 'prompt');
    store.setVerdict('s1', 'Final answer', [
      { model: 'anthropic/claude-sonnet-5', finalPosition: 'x', agreement: 'agree', confidence: 90 },
    ]);
    const session = store.getSession('s1');
    expect(session?.status).toBe('complete');
    expect(session?.verdictText).toBe('Final answer');
    expect(session?.verdictTable).toHaveLength(1);
  });

  it('sets an error and marks the session errored', () => {
    const store = new SessionStore(':memory:');
    store.createSession('s1', 'prompt');
    store.setError('s1', 'synthesizer failed');
    const session = store.getSession('s1');
    expect(session?.status).toBe('error');
    expect(session?.errorMessage).toBe('synthesizer failed');
  });

  it('lists sessions newest first', () => {
    const store = new SessionStore(':memory:');
    store.createSession('s1', 'first');
    store.createSession('s2', 'second');
    const sessions = store.listSessions();
    expect(sessions.map((s) => s.id)).toEqual(['s2', 's1']);
  });

  it('throws when appending round to missing session', () => {
    const store = new SessionStore(':memory:');
    expect(() => store.appendRound('missing', { round: 1, answers: [] })).toThrow(
      'Session not found: missing',
    );
  });

  it('throws when setting verdict on missing session', () => {
    const store = new SessionStore(':memory:');
    expect(() =>
      store.setVerdict('missing', 'Final answer', [
        { model: 'anthropic/claude-sonnet-5', finalPosition: 'x', agreement: 'agree', confidence: 90 },
      ]),
    ).toThrow('Session not found: missing');
  });

  it('throws when setting error on missing session', () => {
    const store = new SessionStore(':memory:');
    expect(() => store.setError('missing', 'synthesizer failed')).toThrow('Session not found: missing');
  });
});
