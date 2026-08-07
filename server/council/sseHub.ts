import type { Response } from 'express';
import type { CouncilEvent } from '../../shared/types';
import type { CouncilEventSink } from './orchestrator';

export class SseHub implements CouncilEventSink {
  private subscribers = new Map<string, Set<Response>>();

  subscribe(sessionId: string, res: Response): void {
    const set = this.subscribers.get(sessionId) ?? new Set<Response>();
    set.add(res);
    this.subscribers.set(sessionId, set);
    res.on('close', () => {
      this.subscribers.get(sessionId)?.delete(res);
    });
  }

  emit(sessionId: string, event: CouncilEvent): void {
    const set = this.subscribers.get(sessionId);
    if (!set) return;
    const payload = `data: ${JSON.stringify(event)}\n\n`;
    for (const res of set) {
      res.write(payload);
    }
  }
}
