export function ExportButton({ sessionId }: { sessionId: string }) {
  return (
    <a className="btn btn-secondary export-button" href={`/api/sessions/${sessionId}/export.md`} download>
      Export Markdown
    </a>
  );
}
