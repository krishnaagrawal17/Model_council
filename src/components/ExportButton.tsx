export function ExportButton({ sessionId }: { sessionId: string }) {
  return (
    <a href={`/api/sessions/${sessionId}/export.md`} download>
      Export Markdown
    </a>
  );
}
