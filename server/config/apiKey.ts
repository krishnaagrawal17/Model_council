import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { createInterface } from 'readline/promises';

export interface ApiKeyPrompter {
  prompt(question: string): Promise<string>;
}

export const stdinPrompter: ApiKeyPrompter = {
  async prompt(question: string): Promise<string> {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try {
      return await rl.question(question);
    } finally {
      rl.close();
    }
  },
};

export async function ensureApiKey(
  env: Record<string, string | undefined>,
  prompter: ApiKeyPrompter,
  envFilePath: string,
): Promise<string> {
  const existing = env.OPENROUTER_API_KEY;
  if (existing) return existing;

  const key = (await prompter.prompt('OPENROUTER_API_KEY not found. Enter your OpenRouter API key: ')).trim();
  if (!key) {
    throw new Error('OPENROUTER_API_KEY is required. Copy .env.example to .env and fill it in, or enter it when prompted.');
  }

  upsertEnvFile(envFilePath, key);
  env.OPENROUTER_API_KEY = key;
  return key;
}

function upsertEnvFile(envFilePath: string, key: string): void {
  const line = `OPENROUTER_API_KEY=${key}`;

  if (!existsSync(envFilePath)) {
    writeFileSync(envFilePath, `${line}\n`);
    return;
  }

  const contents = readFileSync(envFilePath, 'utf-8');
  const lines = contents.split('\n');
  const existingIndex = lines.findIndex((l) => /^OPENROUTER_API_KEY=/.test(l));

  if (existingIndex >= 0) {
    lines[existingIndex] = line;
    writeFileSync(envFilePath, lines.join('\n'));
  } else {
    const separator = contents === '' || contents.endsWith('\n') ? '' : '\n';
    appendFileSync(envFilePath, `${separator}${line}\n`);
  }
}
