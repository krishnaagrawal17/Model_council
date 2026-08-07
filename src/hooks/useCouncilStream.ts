import { useEffect, useState } from 'react';
import type { CouncilEvent, RoundResult, Session, VerdictRow } from '../../shared/types';

export interface CouncilStreamState {
  roundsInProgress: Record<number, Record<string, string>>;
  completedRounds: RoundResult[];
  verdictText: string | null;
  verdictTable: VerdictRow[] | null;
  errors: { round: number; model: string; message: string }[];
  status: 'running' | 'complete' | 'error';
}

const initialState: CouncilStreamState = {
  roundsInProgress: {},
  completedRounds: [],
  verdictText: null,
  verdictTable: null,
  errors: [],
  status: 'running',
};

export function useCouncilStream(sessionId: string | null): CouncilStreamState {
  const [state, setState] = useState<CouncilStreamState>(initialState);

  useEffect(() => {
    if (!sessionId) return;
    setState(initialState);
    const source = new EventSource(`/api/sessions/${sessionId}/stream`);

    source.onmessage = (event) => {
      const parsed: CouncilEvent = JSON.parse(event.data);
      setState((prev) => applyEvent(prev, parsed));
    };

    return () => {
      source.close();
    };
  }, [sessionId]);

  return state;
}

export function sessionToStreamState(session: Session): CouncilStreamState {
  return {
    roundsInProgress: {},
    completedRounds: session.rounds,
    verdictText: session.verdictText,
    verdictTable: session.verdictTable,
    errors: [],
    status: session.status,
  };
}

function applyEvent(prev: CouncilStreamState, event: CouncilEvent): CouncilStreamState {
  switch (event.type) {
    case 'token': {
      const phaseKey = typeof event.phase === 'number' ? event.phase : 0;
      const roundTokens = { ...(prev.roundsInProgress[phaseKey] ?? {}) };
      roundTokens[event.model] = (roundTokens[event.model] ?? '') + event.token;
      return { ...prev, roundsInProgress: { ...prev.roundsInProgress, [phaseKey]: roundTokens } };
    }
    case 'round_complete': {
      const existingIndex = prev.completedRounds.findIndex((r) => r.round === event.result.round);
      const updated = [...prev.completedRounds];
      if (existingIndex >= 0) {
        updated[existingIndex] = event.result;
      } else {
        updated.push(event.result);
      }
      return { ...prev, completedRounds: updated };
    }
    case 'model_error':
      return { ...prev, errors: [...prev.errors, { round: event.round, model: event.model, message: event.message }] };
    case 'session_complete':
      return { ...prev, status: 'complete', verdictText: event.verdictText, verdictTable: event.verdictTable };
    case 'session_error':
      return { ...prev, status: 'error' };
    default:
      return prev;
  }
}
