import { charge } from './mandates';
import { lastCall, mockFetch } from '../../testing/fetch';

afterEach(() => vi.unstubAllGlobals());

describe('charge', () => {
  it('posts the amount as a two-decimal string and returns true', async () => {
    const fetchMock = mockFetch(200, 'Accepted');

    await expect(charge(2, 442357, '2022-01-06')).resolves.toBe(true);
    const { url, init, headers } = lastCall(fetchMock);
    expect(url).toMatch(/\/mandates\/2\/charge$/);
    expect(init.body).toBe('{"amount":"4423.57"}');
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('returns false when the charge is rejected', async () => {
    mockFetch(530, 'Charging not possible at this time');
    await expect(charge(2, 100, '2022-01-06')).resolves.toBe(false);
  });

  it('throws on other errors', async () => {
    mockFetch(400, 'bad');
    await expect(charge(2, 100, '2022-01-06')).rejects.toMatchObject({ status: 400 });
  });
});
