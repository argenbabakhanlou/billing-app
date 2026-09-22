import { markBillingComplete, fetchAdvances } from './advances';
import { lastCall, mockFetch } from '../../testing/fetch';

afterEach(() => vi.unstubAllGlobals());

const dto = {
  id: 1,
  customer_id: 1,
  mandate_id: 2,
  created: '2022-01-02',
  total_advanced: '60000.00',
  fee: '2500.00',
  repayment_start_date: '2022-01-05',
  repayment_percentage: 60,
};

describe('fetchAdvances', () => {
  it('fetches and maps advances to the domain shape', async () => {
    const fetchMock = mockFetch(200, JSON.stringify({ advances: [dto] }));

    await expect(fetchAdvances('2022-01-02')).resolves.toEqual([
      {
        id: 1,
        customerId: 1,
        mandateId: 2,
        created: '2022-01-02',
        totalAdvanced: 6000000,
        fee: 250000,
        repaymentStartDate: '2022-01-05',
        repaymentPercentage: 60,
      },
    ]);
    expect(lastCall(fetchMock).url).toMatch(/\/advances$/);
    expect(lastCall(fetchMock).headers.Today).toBe('2022-01-02');
  });

  it('returns an empty list when there are no advances', async () => {
    mockFetch(200, '{"advances": []}');
    await expect(fetchAdvances('2022-01-01')).resolves.toEqual([]);
  });
});

describe('markBillingComplete', () => {
  it('posts an empty body to billing_complete', async () => {
    const fetchMock = mockFetch(200, '');
    await markBillingComplete(1, '2022-01-20');

    const { url, init } = lastCall(fetchMock);
    expect(url).toMatch(/\/advances\/1\/billing_complete$/);
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{}');
  });

  it('throws on failure', async () => {
    mockFetch(500, 'boom');
    await expect(markBillingComplete(1, '2022-01-20')).rejects.toMatchObject({ status: 500 });
  });
});
