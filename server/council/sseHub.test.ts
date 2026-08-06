// server/council/sseHub.test.ts
import { describe, it, expect } from 'vitest';
import { SseHub } from './sseHub';

class FakeResponse {
  written: string[] = [];
  private closeHandler: (() => void) | null = null;
  write(chunk: string) {
    this.written.push(chunk);
  }
  on(event: string, handler: () => void) {
    if (event === 'close') this.closeHandler = handler;
  }
  close() {
    this.closeHandler?.();
  }
}

describe('SseHub', () => {
  it('delivers events only to subscribers of that session', () => {
    const hub = new SseHub();
    const resA = new FakeResponse();
    const resB = new FakeResponse();
    hub.subscribe('a', resA as any);
    hub.subscribe('b', resB as any);

    hub.emit('a', { type: 'round_start', round: 1 });

    expect(resA.written).toHaveLength(1);
    expect(resA.written[0]).toContain('"type":"round_start"');
    expect(resB.written).toHaveLength(0);
  });

  it('stops delivering to a subscriber after it closes', () => {
    const hub = new SseHub();
    const res = new FakeResponse();
    hub.subscribe('a', res as any);
    res.close();

    hub.emit('a', { type: 'round_start', round: 1 });

    expect(res.written).toHaveLength(0);
  });

  it('does nothing when emitting to a session with no subscribers', () => {
    const hub = new SseHub();
    expect(() => hub.emit('nobody', { type: 'round_start', round: 1 })).not.toThrow();
  });
});
