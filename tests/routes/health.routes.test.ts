import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';

describe('GET /health', () => {
  it('returns ok', async () => {
    const res = await createApp({ logRequests: false }).request('/health');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  it('sets an X-Request-Id header', async () => {
    const res = await createApp({ logRequests: false }).request('/health');

    expect(res.headers.get('X-Request-Id')).toBeTruthy();
  });

  it('echoes a caller-supplied X-Request-Id', async () => {
    const res = await createApp({ logRequests: false }).request('/health', {
      headers: { 'X-Request-Id': 'abc-123' },
    });

    expect(res.headers.get('X-Request-Id')).toBe('abc-123');
  });
});
