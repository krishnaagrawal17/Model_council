import { COUNCIL_MODELS, MODEL_LABELS } from '../../shared/types';
import type { CouncilStreamState } from '../hooks/useCouncilStream';

export function CouncilBoard({ stream }: { stream: CouncilStreamState }) {
  const rounds = [1, 2, 3] as const;
  return (
    <div>
      {rounds.map((round) => {
        const inProgress = stream.roundsInProgress[round];
        const completed = stream.completedRounds.find((r) => r.round === round);
        if (!inProgress && !completed) return null;
        return (
          <section key={round} aria-label={`Round ${round}`}>
            <h2>Round {round}</h2>
            {COUNCIL_MODELS.map((model) => {
              const completedAnswer = completed?.answers.find((a) => a.model === model);
              const text = completedAnswer?.text ?? inProgress?.[model] ?? '';
              const failed = completedAnswer?.status === 'no_response';
              return (
                <article key={model} aria-label={MODEL_LABELS[model]}>
                  <h3>{MODEL_LABELS[model]}</h3>
                  <p>{failed ? 'No response' : text}</p>
                </article>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
