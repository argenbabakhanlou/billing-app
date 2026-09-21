import { describe, expect, it } from 'vitest';
import { FakeWayflyerClient, makeAdvance } from '../helpers/fake-client.js';
import { createTestApp } from '../helpers/test-app.js';

function setup() {
  const client = new FakeWayflyerClient()
    .addAdvance(makeAdvance({ id: 1, created: '2022-01-02' }))
    .addAdvance(makeAdvance({ id: 2, customer_id: 2, mandate_id: 5, created: '2022-01-07' }));
  return createTestApp({ client });
}

function postJson(body: unknown) {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

describe('advances routes', () => {
  it('GET /advances is empty before any sync', async () => {
    const { app } = setup();

    const res = await app.request('/advances');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ advances: [] });
  });

  it('POST /advances/sync adds new advances, then GET /advances lists them', async () => {
    const { app } = setup();

    const sync = await app.request('/advances/sync', postJson({ date: '2022-01-07' }));
    expect(sync.status).toBe(200);
    expect(await sync.json()).toEqual({ date: '2022-01-07', addedAdvanceIds: [1, 2] });

    const list = await app.request('/advances');
    const body = (await list.json()) as { advances: { id: number }[] };
    expect(body.advances.map((a) => a.id)).toEqual([1, 2]);
  });

  it('GET /advances/:id returns the ledger detail', async () => {
    const { app } = setup();
    await app.request('/advances/sync', postJson({ date: '2022-01-07' }));

    const res = await app.request('/advances/2');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      id: 2,
      customerId: 2,
      mandateId: 5,
      totalOwed: '62500.00',
      repaid: '0.00',
      outstanding: '62500.00',
      status: 'repaying',
      repaymentStartDate: '2022-01-05',
      repaymentPercentage: 60,
      charges: [],
    });
  });

  it('GET /advances/:id returns 404 for an unknown advance', async () => {
    const { app } = setup();

    const res = await app.request('/advances/42');

    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({
      error: { code: 'NOT_FOUND', message: 'Advance 42 not found' },
    });
  });

  it.each(['abc', '0', '-1', '1.5'])('GET /advances/%s returns 400', async (id) => {
    const { app } = setup();

    const res = await app.request(`/advances/${id}`);

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: { code: 'BAD_REQUEST' } });
  });

  it.each([
    ['a missing date', {}],
    ['an invalid date', { date: '2022-02-30' }],
    ['a wrong format', { date: '01/07/2022' }],
  ])('POST /advances/sync returns 400 for %s', async (_, body) => {
    const { app } = setup();

    const res = await app.request('/advances/sync', postJson(body));

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      error: { code: 'BAD_REQUEST', message: expect.stringContaining('date') },
    });
  });

  it('POST /advances/sync returns 400 for malformed JSON', async () => {
    const { app } = setup();

    const res = await app.request('/advances/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not json',
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: { code: 'BAD_REQUEST' } });
  });
});
