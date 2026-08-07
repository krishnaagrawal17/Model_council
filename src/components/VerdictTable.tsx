import type { CSSProperties } from 'react';
import { MODEL_LABELS } from '../../shared/types';
import type { VerdictRow } from '../../shared/types';
import { AGREEMENT_THEME } from '../modelTheme';
import { FormattedText } from './FormattedText';

export function VerdictTable({ verdictText, rows }: { verdictText: string; rows: VerdictRow[] }) {
  return (
    <div className="verdict-card">
      <h2>Verdict</h2>
      <div className="verdict-text">
        <FormattedText text={verdictText} />
      </div>
      <table className="verdict-table">
        <thead>
          <tr>
            <th>Model</th>
            <th>Agreement</th>
            <th>Confidence</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const badge = AGREEMENT_THEME[row.agreement];
            return (
              <tr key={row.model}>
                <td>{MODEL_LABELS[row.model]}</td>
                <td>
                  <span
                    className="agreement-badge"
                    style={
                      { '--badge-accent': badge.accent, '--badge-bg': badge.bg } as CSSProperties
                    }
                  >
                    {row.agreement}
                  </span>
                </td>
                <td className="confidence-cell">{row.confidence !== null ? `${row.confidence}%` : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
