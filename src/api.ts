import type { Session } from '../shared/types';

export async function createSession(prompt: string): Promise<{ id: string }> {
  const res = await fetch('/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  if (!res.ok) throw new Error('Failed to create session');
  return res.json();
}

export async function fetchSession(id: string): Promise<Session> {
  const res = await fetch(`/api/sessions/${id}`);
  if (!res.ok) throw new Error('Failed to load session');
  return res.json();
}

export async function fetchHistory(): Promise<Session[]> {
  const res = await fetch('/api/sessions');
  if (!res.ok) throw new Error('Failed to load history');
  return res.json();
}

export async function retryModel(sessionId: string, round: number, model: string) {
  const res = await fetch(`/api/sessions/${sessionId}/retry/${encodeURIComponent(model)}?round=${round}`, { method: 'POST' });
  if (!res.ok) throw new Error('Retry failed');
  return res.json();
}
