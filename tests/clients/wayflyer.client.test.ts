import { describe, expect, it, vi } from 'vitest';
import { HttpWayflyerClient, UpstreamError } from '../../src/clients/wayflyer.client.js';

const BASE_URL = 'https://api.test/v2';
const TODAY = '2022-01-10';

const advance = {
  id: 1,
  customer_id: 1,
  mandate_id: 2,
  created: '2022-01-02',
  total_advanced: '60000.00',
  fee: '2500.00',
  repayment_start_date: '2022-01-05',
  repayment_percentage: 60,
};

function stubFetch(status: number, body: string) {
  return vi.fn<typeof fetch>(async () => new Response(body, { status }));
}

function clientWith(fetchFn: typeof fetch) {
  return new HttpWayflyerClient(BASE_URL, fetchFn);
}

function lastCall(fetchFn: ReturnType<typeof stubFetch>) {
  const [url, init] = fetchFn.mock.calls.at(-1)!;
  return { url, init: init!, headers: init!.headers as Record<string, string> };
}

describe('HttpWayflyerClient', () => {
  describe('getAdvances', () => {
    it('sends the Today header and returns parsed advances', async () => {
      const fetchFn = stubFetch(200, JSON.stringify({ advances: [advance] }));

      const advances = await clientWith(fetchFn).getAdvances(TODAY);

      expect(advances).toEqual([advance]);
      const { url, init, headers } = lastCall(fetchFn);
      expect(url).toBe(`${BASE_URL}/advances`);
      expect(init.method).toBe('GET');
      expect(headers).toEqual({ Today: TODAY });
      expect(init.body).toBeUndefined();
    });

    it('parses JSON even when labelled text/html, as the live API does', async () => {
      const fetchFn = vi.fn<typeof fetch>(
        async () =>
          new Response(JSON.stringify({ advances: [] }), {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          }),
      );

      await expect(clientWith(fetchFn).getAdvances(TODAY)).resolves.toEqual([]);
    });

    it('drops unknown fields', async () => {
      const fetchFn = stubFetch(200, JSON.stringify({ advances: [{ ...advance, extra: true }] }));

      await expect(clientWith(fetchFn).getAdvances(TODAY)).resolves.toEqual([advance]);
    });

    it.each([
      ['a bad money format', { ...advance, fee: '2500' }],
      ['an invalid date', { ...advance, repayment_start_date: '2022-02-30' }],
      ['a missing field', { ...advance, mandate_id: undefined }],
      ['a percentage over 100', { ...advance, repayment_percentage: 150 }],
    ])('rejects an advance with %s', async (_, bad) => {
      const fetchFn = stubFetch(200, JSON.stringify({ advances: [bad] }));

      await expect(clientWith(fetchFn).getAdvances(TODAY)).rejects.toThrow(/unexpected shape/);
    });

    it('rejects invalid JSON', async () => {
      const fetchFn = stubFetch(200, '<html>oops</html>');

      await expect(clientWith(fetchFn).getAdvances(TODAY)).rejects.toThrow(/invalid JSON/);
    });
  });

  describe('getRevenue', () => {
    it('returns the amount in cents', async () => {
      const fetchFn = stubFetch(200, JSON.stringify({ amount: '5363.16' }));

      const result = await clientWith(fetchFn).getRevenue(TODAY, 7, '2022-01-09');

      expect(result).toEqual({ status: 'available', amountCents: 536316 });
      expect(lastCall(fetchFn).url).toBe(`${BASE_URL}/customers/7/revenues/2022-01-09`);
      expect(lastCall(fetchFn).headers).toEqual({ Today: TODAY });
    });

    it('maps 530 to unavailable', async () => {
      const fetchFn = stubFetch(530, 'Revenue not available at this time');

      await expect(clientWith(fetchFn).getRevenue(TODAY, 4, '2022-01-09')).resolves.toEqual({
        status: 'unavailable',
      });
    });

    it('rejects a malformed amount', async () => {
      const fetchFn = stubFetch(200, JSON.stringify({ amount: 12.5 }));

      await expect(clientWith(fetchFn).getRevenue(TODAY, 1, '2022-01-09')).rejects.toThrow(
        UpstreamError,
      );
    });
  });

  describe('charge', () => {
    it('posts the amount as a two-decimal string with a JSON content type', async () => {
      const fetchFn = stubFetch(200, '');

      const result = await clientWith(fetchFn).charge(TODAY, 2, 1_000_005);

      expect(result).toEqual({ status: 'succeeded' });
      const { url, init, headers } = lastCall(fetchFn);
      expect(url).toBe(`${BASE_URL}/mandates/2/charge`);
      expect(init.method).toBe('POST');
      expect(headers).toEqual({ Today: TODAY, 'Content-Type': 'application/json' });
      expect(init.body).toBe('{"amount":"10000.05"}');
    });

    it('maps 530 to rejected', async () => {
      const fetchFn = stubFetch(530, 'Charging not possible at this time');

      await expect(clientWith(fetchFn).charge(TODAY, 2, 100)).resolves.toEqual({
        status: 'rejected',
      });
    });

    it.each([0, -100])('refuses to send a charge of %i cents', async (amount) => {
      const fetchFn = stubFetch(200, '');

      await expect(clientWith(fetchFn).charge(TODAY, 2, amount)).rejects.toThrow(RangeError);
      expect(fetchFn).not.toHaveBeenCalled();
    });
  });

  describe('billingComplete', () => {
    it('posts an empty JSON body', async () => {
      const fetchFn = stubFetch(200, '');

      await clientWith(fetchFn).billingComplete(TODAY, 1);

      const { url, init, headers } = lastCall(fetchFn);
      expect(url).toBe(`${BASE_URL}/advances/1/billing_complete`);
      expect(init.method).toBe('POST');
      expect(headers).toEqual({ Today: TODAY, 'Content-Type': 'application/json' });
      expect(init.body).toBe('{}');
    });

    it('treats 530 as an error because it has no documented meaning here', async () => {
      const fetchFn = stubFetch(530, 'nope');

      await expect(clientWith(fetchFn).billingComplete(TODAY, 1)).rejects.toThrow(UpstreamError);
    });
  });

  describe('errors', () => {
    it.each([
      [400, 'Revenue unavailable for future day'],
      [404, 'Customer not found: 99999'],
      [500, 'Internal Server Error'],
    ])('wraps a %i response in an UpstreamError', async (status, body) => {
      const fetchFn = stubFetch(status, body);

      const error = await clientWith(fetchFn)
        .getRevenue(TODAY, 99999, '2022-01-09')
        .catch((err: unknown) => err);

      expect(error).toBeInstanceOf(UpstreamError);
      expect(error).toMatchObject({
        status,
        endpoint: '/customers/99999/revenues/2022-01-09',
        message: expect.stringContaining(body),
      });
    });

    it('wraps network failures, keeping the cause', async () => {
      const cause = new TypeError('fetch failed');
      const fetchFn = vi.fn<typeof fetch>(async () => {
        throw cause;
      });

      const error = await clientWith(fetchFn)
        .getAdvances(TODAY)
        .catch((err: unknown) => err);

      expect(error).toBeInstanceOf(UpstreamError);
      expect(error).toMatchObject({ status: undefined, endpoint: '/advances', cause });
    });
  });
});
