import { vi } from 'vitest';

export function mockFetch(status: number, body: string) {
  const fetchMock = vi.fn(async () => new Response(body, { status }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

export function lastCall(fetchMock: ReturnType<typeof mockFetch>) {
  const call = fetchMock.mock.lastCall as unknown as [string, RequestInit];
  return { url: call[0], init: call[1], headers: call[1].headers as Record<string, string> };
}
