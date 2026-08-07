import { describe, it, expect, vi, afterEach } from 'vitest';
import { RealOpenRouterClient, FakeOpenRouterClient } from './client';

function chunksToStream(chunks: string[]) {
  const encoder = new TextEncoder();
  let i = 0;
  return {
    getReader() {
      return {
        read: async () => {
          if (i >= chunks.length) return { done: true, value: undefined };
          const value = encoder.encode(chunks[i]);
          i += 1;
          return { done: false, value };
        },
      };
    },
  };
}

describe('RealOpenRouterClient', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('yields content deltas parsed from SSE chunks', async () => {
    const sse = [
      'data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"lo"}}]}\n\n',
      'data: [DONE]\n\n',
    ].join('');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, body: chunksToStream([sse]) }),
    );

    const client = new RealOpenRouterClient('test-key');
    const tokens: string[] = [];
    for await (const token of client.streamChatCompletion('some/model', [{ role: 'user', content: 'hi' }])) {
      tokens.push(token);
    }
    expect(tokens).toEqual(['Hel', 'lo']);
  });

  it('throws when the response is not ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500, statusText: 'Server Error', body: null }),
    );
    const client = new RealOpenRouterClient('test-key');
    await expect(async () => {
      for await (const _token of client.streamChatCompletion('some/model', [])) {
        // draining the generator to trigger the throw
      }
    }).rejects.toThrow('OpenRouter request failed: 500 Server Error');
  });

  it('reassembles an SSE line split across two chunks', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        body: chunksToStream([
          'data: {"choices":[{"delta":{"cont',
          'ent":"Hi"}}]}\n\ndata: [DONE]\n\n',
        ]),
      }),
    );

    const client = new RealOpenRouterClient('test-key');
    const tokens: string[] = [];
    for await (const token of client.streamChatCompletion('some/model', [{ role: 'user', content: 'hi' }])) {
      tokens.push(token);
    }
    expect(tokens).toEqual(['Hi']);
  });
});

describe('FakeOpenRouterClient', () => {
  it('yields the scripted tokens for a model', async () => {
    const client = new FakeOpenRouterClient();
    client.script('some/model', ['a', 'b', 'c']);
    const tokens: string[] = [];
    for await (const token of client.streamChatCompletion('some/model', [])) {
      tokens.push(token);
    }
    expect(tokens).toEqual(['a', 'b', 'c']);
  });

  it('consumes queued scripts in order across repeated calls to the same model', async () => {
    const client = new FakeOpenRouterClient();
    client.script('some/model', ['first']);
    client.script('some/model', ['second']);

    const firstCall: string[] = [];
    for await (const token of client.streamChatCompletion('some/model', [])) firstCall.push(token);
    const secondCall: string[] = [];
    for await (const token of client.streamChatCompletion('some/model', [])) secondCall.push(token);

    expect(firstCall).toEqual(['first']);
    expect(secondCall).toEqual(['second']);
  });

  it('throws the scripted error for a model', async () => {
    const client = new FakeOpenRouterClient();
    client.scriptError('some/model', new Error('boom'));
    await expect(async () => {
      for await (const _token of client.streamChatCompletion('some/model', [])) {
        // draining the generator to trigger the throw
      }
    }).rejects.toThrow('boom');
  });
});
