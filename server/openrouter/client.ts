import type { ChatMessage } from '../../shared/types';

export interface OpenRouterClient {
  streamChatCompletion(model: string, messages: ChatMessage[]): AsyncGenerator<string, void, unknown>;
}

export class RealOpenRouterClient implements OpenRouterClient {
  constructor(private apiKey: string) {}

  async *streamChatCompletion(model: string, messages: ChatMessage[]): AsyncGenerator<string, void, unknown> {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, messages, stream: true }),
    });

    if (!response.ok || !response.body) {
      throw new Error(`OpenRouter request failed: ${response.status} ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice('data: '.length).trim();
        if (data === '[DONE]') return;
        const parsed = JSON.parse(data);
        const delta: string | undefined = parsed.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      }
    }
  }
}

export class FakeOpenRouterClient implements OpenRouterClient {
  private queues = new Map<string, (string[] | Error)[]>();
  calls: { model: string; messages: ChatMessage[] }[] = [];

  script(model: string, tokens: string[]): void {
    const queue = this.queues.get(model) ?? [];
    queue.push(tokens);
    this.queues.set(model, queue);
  }

  scriptError(model: string, error: Error): void {
    const queue = this.queues.get(model) ?? [];
    queue.push(error);
    this.queues.set(model, queue);
  }

  async *streamChatCompletion(model: string, messages: ChatMessage[]): AsyncGenerator<string, void, unknown> {
    this.calls.push({ model, messages });
    const queue = this.queues.get(model);
    const next = queue?.shift();
    if (!next) throw new Error(`No script configured for model: ${model}`);
    if (next instanceof Error) throw next;
    for (const token of next) yield token;
  }
}
