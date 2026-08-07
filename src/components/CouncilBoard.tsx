import type { CSSProperties } from 'react';
import { COUNCIL_MODELS, MODEL_LABELS } from '../../shared/types';
import type { CouncilStreamState } from '../hooks/useCouncilStream';
import { MODEL_THEME } from '../modelTheme';
import { FormattedText } from './FormattedText';

export function CouncilBoard({ stream }: { stream: CouncilStreamState }) {
  const rounds = [1, 2, 3] as const;
  return (
    <div>
      {rounds.map((round) => {
        const inProgress = stream.roundsInProgress[round];
        const completed = stream.completedRounds.find((r) => r.round === round);
        if (!inProgress && !completed) return null;
        return (
          <section key={round} className="round-section" aria-label={`Round ${round}`}>
            <span className="round-label">Round {round}</span>
            <div className="model-grid">
              {COUNCIL_MODELS.map((model) => {
                const completedAnswer = completed?.answers.find((a) => a.model === model);
                const text = completedAnswer?.text ?? inProgress?.[model] ?? '';
                const failed = completedAnswer?.status === 'no_response';
                const theme = MODEL_THEME[model];
                return (
                  <article
                    key={model}
                    className={`model-card${failed ? ' no-response' : ''}`}
                    style={
                      {
                        '--card-accent': theme.accent,
                        '--card-accent-bg': theme.bg,
                      } as CSSProperties
                    }
                    aria-label={MODEL_LABELS[model]}
                  >
                    <div className="model-card-header">
                      <span className="model-avatar">{theme.initial}</span>
                      <h3>{MODEL_LABELS[model]}</h3>
                    </div>
                    <div className="model-card-body">
                      {failed ? <p className="no-response-text">No response</p> : <FormattedText text={text} />}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
