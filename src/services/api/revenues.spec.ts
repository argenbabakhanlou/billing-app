import { getRevenue } from './revenues';
import { lastCall, mockFetch } from '../../testing/fetch';

afterEach(() => vi.unstubAllGlobals());

describe('getRevenue', () => {
  it('returns revenue in cents', async () => {
    const fetchMock = mockFetch(200, '{"amount": "7372.61"}');

    await expect(getRevenue(1, '2022-01-05', '2022-01-06')).resolves.toBe(737261);
    expect(lastCall(fetchMock).url).toMatch(/\/customers\/1\/revenues\/2022-01-05$/);
    expect(lastCall(fetchMock).headers.Today).toBe('2022-01-06');
  });

  it('returns null when revenue is not yet available', async () => {
    mockFetch(530, 'Revenue not yet available');
    await expect(getRevenue(1, '2022-01-05', '2022-01-06')).resolves.toBeNull();
  });

  it('throws on other errors', async () => {
    mockFetch(400, 'Revenue unavailable for future day');
    await expect(getRevenue(1, '2022-01-06', '2022-01-06')).rejects.toMatchObject({ status: 400 });
  });
});
