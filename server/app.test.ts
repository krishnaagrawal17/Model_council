import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from './app';

describe('createApp', () => {
  it('responds to a health check', async () => {
    const res = await request(createApp()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
