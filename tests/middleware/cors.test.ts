import { describe, expect, it } from 'vitest';
import { createTestApp } from '../helpers/test-app.js';

describe('CORS', () => {
  it('sends no allow-origin header while the allow-list is empty', async () => {
    const res = await createTestApp().app.request('/health', {
      headers: { Origin: 'http://evil.example' },
    });

    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
});
