import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExportButton } from './ExportButton';

describe('ExportButton', () => {
  it('links to the export endpoint for the given session', () => {
    render(<ExportButton sessionId="abc123" />);
    const link = screen.getByText('Export Markdown') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/api/sessions/abc123/export.md');
  });
});
