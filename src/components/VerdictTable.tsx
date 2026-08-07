import { MODEL_LABELS } from '../../shared/types';
import type { VerdictRow } from '../../shared/types';

export function VerdictTable({ verdictText, rows }: { verdictText: string; rows: VerdictRow[] }) {
  return (
    <div>
      <h2>Verdict</h2>
      <p>{verdictText}</p>
      <table>
        <thead>
          <tr>
            <th>Model</th>
            <th>Agreement</th>
            <th>Confidence</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.model}>
              <td>{MODEL_LABELS[row.model]}</td>
              <td>{row.agreement}</td>
              <td>{row.confidence !== null ? `${row.confidence}%` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
