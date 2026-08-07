import { describe, it, expect, vi, afterEach } from 'vitest';
import { retryModel } from './api';

describe('api', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('URL-encodes the model ID in retryModel requests', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    vi.stubGlobal('fetch', mockFetch);

    await retryModel('session-1', 1, 'anthropic/claude-sonnet-5');

    expect(mockFetch).toHaveBeenCalledOnce();
    const callArgs = mockFetch.mock.calls[0];
    const url = callArgs[0] as string;
    expect(url).toContain('anthropic%2Fclaude-sonnet-5');
    expect(url).not.toContain('anthropic/claude-sonnet-5');
  });
});
