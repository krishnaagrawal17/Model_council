const BULLET_RE = /^\s*([-*•]|\d+[.)])\s+/;

function stripBulletMarker(line: string): string {
  return line.replace(BULLET_RE, '');
}

interface Block {
  type: 'text' | 'list';
  lines: string[];
}

function toBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '') continue;
    const type: Block['type'] = BULLET_RE.test(line) ? 'list' : 'text';
    const last = blocks[blocks.length - 1];
    if (last && last.type === type) {
      last.lines.push(line);
    } else {
      blocks.push({ type, lines: [line] });
    }
  }
  return blocks;
}

export function FormattedText({ text, className }: { text: string; className?: string }) {
  if (!text) return null;
  const blocks = toBlocks(text);
  return (
    <div className={className}>
      {blocks.map((block, i) =>
        block.type === 'list' ? (
          <ul key={i} className="formatted-list">
            {block.lines.map((line, j) => (
              <li key={j}>{stripBulletMarker(line)}</li>
            ))}
          </ul>
        ) : (
          <p key={i} className="formatted-paragraph">
            {block.lines.join('\n')}
          </p>
        ),
      )}
    </div>
  );
}
