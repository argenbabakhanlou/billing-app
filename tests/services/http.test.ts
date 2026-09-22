import { API_BASE_URL } from '../../src/config';
import { ApiError, isUnavailable, request, requestJson } from '../../src/services/http';
import { lastCall, mockFetch } from '../helpers/fetch';

afterEach(() => vi.unstubAllGlobals());

describe('request', () => {
  it('sends the Today header on GET without a body or content type', async () => {
    const fetchMock = mockFetch(200, 'ok');
    await request('GET', '/advances', { today: '2022-01-02' });

    const { url, init, headers } = lastCall(fetchMock);
    expect(url).toBe(`${API_BASE_URL}/advances`);
    expect(init.method).toBe('GET');
    expect(headers).toEqual({ Today: '2022-01-02' });
    expect(init.body).toBeUndefined();
  });

  it('sends JSON with a content type on POST', async () => {
    const fetchMock = mockFetch(200, 'Accepted');
    const text = await request('POST', '/x', { today: '2022-01-02', body: { amount: '1.00' } });

    const { init, headers } = lastCall(fetchMock);
    expect(text).toBe('Accepted');
    expect(headers).toEqual({ Today: '2022-01-02', 'Content-Type': 'application/json' });
    expect(init.body).toBe('{"amount":"1.00"}');
  });

  it('defaults the POST body to an empty object', async () => {
    const fetchMock = mockFetch(200, '');
    await request('POST', '/x', { today: '2022-01-02' });
    expect(lastCall(fetchMock).init.body).toBe('{}');
  });

  it('throws ApiError with status and body on failure', async () => {
    mockFetch(400, 'Revenue unavailable for future day');
    const error = await request('GET', '/x', { today: '2022-01-02' }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 400, method: 'GET', path: '/x' });
    expect(isUnavailable(error)).toBe(false);
  });

  it('flags 530 as unavailable', async () => {
    mockFetch(530, '');
    const error = await request('GET', '/x', { today: '2022-01-02' }).catch((e: unknown) => e);
    expect(isUnavailable(error)).toBe(true);
  });
});

describe('requestJson', () => {
  it('parses JSON regardless of content type', async () => {
    mockFetch(200, '{"amount": "1.00"}');
    await expect(requestJson('GET', '/x', { today: '2022-01-02' })).resolves.toEqual({
      amount: '1.00',
    });
  });
});
