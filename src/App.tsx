import { useState } from 'react';
import { PromptForm } from './components/PromptForm';
import { CouncilBoard } from './components/CouncilBoard';
import { VerdictTable } from './components/VerdictTable';
import { ExportButton } from './components/ExportButton';
import { HistoryList } from './components/HistoryList';
import { useCouncilStream, sessionToStreamState } from './hooks/useCouncilStream';
import { createSession, fetchSession } from './api';
import type { Session } from '../shared/types';

export function App() {
  const [liveSessionId, setLiveSessionId] = useState<string | null>(null);
  const [historySession, setHistorySession] = useState<Session | null>(null);
  const liveStream = useCouncilStream(liveSessionId);
  const stream = historySession ? sessionToStreamState(historySession) : liveStream;
  const activeSessionId = historySession?.id ?? liveSessionId;

  async function handleSubmit(prompt: string) {
    setHistorySession(null);
    const { id } = await createSession(prompt);
    setLiveSessionId(id);
  }

  async function handleSelectHistory(id: string) {
    setLiveSessionId(null);
    const session = await fetchSession(id);
    setHistorySession(session);
  }

  return (
    <div>
      <h1>Model Council</h1>
      <PromptForm onSubmit={handleSubmit} disabled={stream.status === 'running' && activeSessionId !== null} />
      {activeSessionId && <CouncilBoard stream={stream} />}
      {stream.status === 'complete' && stream.verdictText && stream.verdictTable && (
        <>
          <VerdictTable verdictText={stream.verdictText} rows={stream.verdictTable} />
          <ExportButton sessionId={activeSessionId!} />
        </>
      )}
      <h2>History</h2>
      <HistoryList onSelect={handleSelectHistory} />
    </div>
  );
}
