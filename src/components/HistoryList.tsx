import { useEffect, useState } from 'react';
import { fetchHistory } from '../api';
import type { Session } from '../../shared/types';

export function HistoryList({
  onSelect,
  refreshKey,
}: {
  onSelect: (id: string) => void;
  refreshKey: number;
}) {
  const [sessions, setSessions] = useState<Session[]>([]);

  useEffect(() => {
    fetchHistory().then(setSessions);
  }, [refreshKey]);

  return (
    <ul>
      {sessions.map((s) => (
        <li key={s.id}>
          <button onClick={() => onSelect(s.id)}>{s.prompt}</button>
        </li>
      ))}
    </ul>
  );
}
