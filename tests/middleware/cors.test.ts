import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';

describe('CORS', () => {
  it('sends no allow-origin header while the allow-list is empty', async () => {
    const res = await createApp({ logRequests: false }).request('/health', {
      headers: { Origin: 'http://evil.example' },
    });

    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
});
