import { MODEL_LABELS } from '../../shared/types';
import type { Session } from '../../shared/types';

export function sessionToMarkdown(session: Session): string {
  const lines: string[] = [`# Model Council Session`, '', `**Prompt:** ${session.prompt}`, ''];

  for (const round of session.rounds) {
    lines.push(`## Round ${round.round}`, '');
    for (const answer of round.answers) {
      lines.push(`### ${MODEL_LABELS[answer.model]}`, '');
      lines.push(answer.status === 'ok' ? answer.text : '_No response_');
      if (answer.confidence !== null) lines.push('', `Confidence: ${answer.confidence}%`);
      lines.push('');
    }
  }

  if (session.verdictText) {
    lines.push('## Verdict', '', session.verdictText, '');
  }

  if (session.verdictTable) {
    lines.push('## Verdict Table', '', '| Model | Agreement | Confidence |', '|---|---|---|');
    for (const row of session.verdictTable) {
      const confidenceText = row.confidence !== null ? `${row.confidence}%` : '—';
      lines.push(`| ${MODEL_LABELS[row.model]} | ${row.agreement} | ${confidenceText} |`);
    }
  }

  return lines.join('\n');
}
