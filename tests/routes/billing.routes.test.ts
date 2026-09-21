import { describe, expect, it } from 'vitest';
import { FakeWayflyerClient, makeAdvance } from '../helpers/fake-client.js';
import { createTestApp } from '../helpers/test-app.js';

function postRun(body: unknown) {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function setup() {
  const client = new FakeWayflyerClient()
    .addAdvance(makeAdvance({ repayment_percentage: 60 }))
    .setRevenue(1, '2022-01-04', 100_000);
  return createTestApp({ client });
}

describe('POST /billing/run', () => {
  it('bills the day and returns the report', async () => {
    const { app, client } = setup();

    const res = await app.request('/billing/run', postRun({ date: '2022-01-05' }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      date: '2022-01-05',
      advancesProcessed: 1,
      charges: [{ advanceId: 1, mandateId: 2, amount: '600.00', status: 'succeeded' }],
      completedAdvanceIds: [],
    });
    expect(client.charges).toHaveLength(1);
  });

  it('updates the ledger visible through GET /advances/:id', async () => {
    const { app } = setup();

    await app.request('/billing/run', postRun({ date: '2022-01-05' }));
    const res = await app.request('/advances/1');

    expect(await res.json()).toMatchObject({
      repaid: '600.00',
      outstanding: '61900.00',
      charges: [{ date: '2022-01-05', amount: '600.00', status: 'succeeded' }],
    });
  });

  it.each([{}, { date: 'tomorrow' }, { date: '2022-02-30' }])(
    'returns 400 for %j',
    async (body) => {
      const { app } = setup();

      const res = await app.request('/billing/run', postRun(body));

      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ error: { code: 'BAD_REQUEST' } });
    },
  );

  it('returns 409 when the day was already billed', async () => {
    const { app } = setup();

    await app.request('/billing/run', postRun({ date: '2022-01-05' }));
    const res = await app.request('/billing/run', postRun({ date: '2022-01-05' }));

    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({
      error: { code: 'CONFLICT', message: expect.stringContaining('2022-01-05') },
    });
  });
});
