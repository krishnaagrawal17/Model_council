import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { ensureApiKey, type ApiKeyPrompter } from './apiKey';

function fakePrompter(answer: string): ApiKeyPrompter {
  return { prompt: async () => answer };
}

describe('ensureApiKey', () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it('returns the existing key without prompting or touching the filesystem', async () => {
    dir = mkdtempSync(join(tmpdir(), 'model-council-test-'));
    const envFilePath = join(dir, '.env');
    const env = { OPENROUTER_API_KEY: 'existing-key' };
    let promptCalled = false;

    const key = await ensureApiKey(env, { prompt: async () => { promptCalled = true; return 'unused'; } }, envFilePath);

    expect(key).toBe('existing-key');
    expect(promptCalled).toBe(false);
  });

  it('prompts for the key when missing and returns the trimmed value', async () => {
    dir = mkdtempSync(join(tmpdir(), 'model-council-test-'));
    const envFilePath = join(dir, '.env');
    const env: Record<string, string | undefined> = {};

    const key = await ensureApiKey(env, fakePrompter('  sk-typed-key  '), envFilePath);

    expect(key).toBe('sk-typed-key');
  });

  it('creates a new .env file containing the prompted key when none exists', async () => {
    dir = mkdtempSync(join(tmpdir(), 'model-council-test-'));
    const envFilePath = join(dir, '.env');
    const env: Record<string, string | undefined> = {};

    await ensureApiKey(env, fakePrompter('sk-new-key'), envFilePath);

    expect(readFileSync(envFilePath, 'utf-8')).toBe('OPENROUTER_API_KEY=sk-new-key\n');
  });

  it('appends the key to an existing .env file without disturbing other lines', async () => {
    dir = mkdtempSync(join(tmpdir(), 'model-council-test-'));
    const envFilePath = join(dir, '.env');
    writeFileSync(envFilePath, 'PORT=3001\n');
    const env: Record<string, string | undefined> = {};

    await ensureApiKey(env, fakePrompter('sk-appended-key'), envFilePath);

    const contents = readFileSync(envFilePath, 'utf-8');
    expect(contents).toContain('PORT=3001');
    expect(contents).toContain('OPENROUTER_API_KEY=sk-appended-key');
  });

  it('replaces an existing empty OPENROUTER_API_KEY= line instead of duplicating it', async () => {
    dir = mkdtempSync(join(tmpdir(), 'model-council-test-'));
    const envFilePath = join(dir, '.env');
    writeFileSync(envFilePath, 'OPENROUTER_API_KEY=\nPORT=3001\n');
    const env: Record<string, string | undefined> = {};

    await ensureApiKey(env, fakePrompter('sk-replaced-key'), envFilePath);

    const contents = readFileSync(envFilePath, 'utf-8');
    const matches = contents.match(/OPENROUTER_API_KEY=/g) ?? [];
    expect(matches.length).toBe(1);
    expect(contents).toContain('OPENROUTER_API_KEY=sk-replaced-key');
    expect(contents).toContain('PORT=3001');
  });

  it('sets the key on the provided env object so callers see it immediately', async () => {
    dir = mkdtempSync(join(tmpdir(), 'model-council-test-'));
    const envFilePath = join(dir, '.env');
    const env: Record<string, string | undefined> = {};

    await ensureApiKey(env, fakePrompter('sk-set-key'), envFilePath);

    expect(env.OPENROUTER_API_KEY).toBe('sk-set-key');
  });

  it('throws when the prompted value is empty or whitespace-only', async () => {
    dir = mkdtempSync(join(tmpdir(), 'model-council-test-'));
    const envFilePath = join(dir, '.env');
    const env: Record<string, string | undefined> = {};

    await expect(ensureApiKey(env, fakePrompter('   '), envFilePath)).rejects.toThrow(
      'OPENROUTER_API_KEY is required',
    );
  });
});
