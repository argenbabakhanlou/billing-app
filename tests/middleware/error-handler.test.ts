import { HTTPException } from 'hono/http-exception';
import { describe, expect, it, vi } from 'vitest';
import { createTestApp } from '../helpers/test-app.js';

function appWithFailingRoutes() {
  const app = createTestApp().app;
  app.get('/http-error', () => {
    throw new HTTPException(409, { message: 'Already running' });
  });
  app.get('/crash', () => {
    throw new Error('secret internal detail');
  });
  return app;
}

describe('error handling', () => {
  it('returns a JSON 404 for unknown routes', async () => {
    const res = await createTestApp().app.request('/nope', {
      headers: { 'X-Request-Id': 'req-1' },
    });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      error: { message: 'Route not found: GET /nope', code: 'NOT_FOUND', requestId: 'req-1' },
    });
  });

  it('maps HTTPException to its status and message', async () => {
    const res = await appWithFailingRoutes().request('/http-error', {
      headers: { 'X-Request-Id': 'req-2' },
    });

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: { message: 'Already running', code: 'CONFLICT', requestId: 'req-2' },
    });
  });

  it('hides unexpected error details behind a 500', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await appWithFailingRoutes().request('/crash', {
      headers: { 'X-Request-Id': 'req-3' },
    });

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: { message: 'Internal server error', code: 'INTERNAL_ERROR', requestId: 'req-3' },
    });
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
