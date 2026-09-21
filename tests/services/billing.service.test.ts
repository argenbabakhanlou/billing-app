import { describe, expect, it } from 'vitest';
import { dateRange } from '../../src/lib/dates.js';
import { ConflictError } from '../../src/lib/errors.js';
import { AdvancesService } from '../../src/services/advances.service.js';
import { BillingService } from '../../src/services/billing.service.js';
import { LedgerStore } from '../../src/store/ledger.store.js';
import { FakeWayflyerClient, makeAdvance } from '../helpers/fake-client.js';

function setup(client: FakeWayflyerClient) {
  const store = new LedgerStore();
  const billing = new BillingService(client, store, new AdvancesService(client, store));
  const runDays = async (start: string, end: string) => {
    for (const day of dateRange(start, end)) await billing.runBillingForDay(day);
  };
  return { store, billing, runDays };
}

function setDailyRevenue(
  client: FakeWayflyerClient,
  customerId: number,
  start: string,
  end: string,
  amountCents: number,
) {
  for (const day of dateRange(start, end)) client.setRevenue(customerId, day, amountCents);
}

describe('BillingService.runBillingForDay', () => {
  it('does nothing before the repayment start date', async () => {
    const client = new FakeWayflyerClient().addAdvance(
      makeAdvance({ created: '2022-01-02', repayment_start_date: '2022-01-05' }),
    );
    setDailyRevenue(client, 1, '2022-01-01', '2022-01-10', 100_000);
    const { billing, runDays } = setup(client);

    await runDays('2022-01-02', '2022-01-03');
    const report = await billing.runBillingForDay('2022-01-04');

    expect(client.revenueRequests).toEqual([]);
    expect(client.charges).toEqual([]);
    expect(report).toEqual({
      date: '2022-01-04',
      advancesProcessed: 0,
      charges: [],
      completedAdvanceIds: [],
    });
  });

  it("charges the repayment percentage of the previous day's revenue", async () => {
    const client = new FakeWayflyerClient()
      .addAdvance(makeAdvance({ repayment_start_date: '2022-01-05', repayment_percentage: 60 }))
      .setRevenue(1, '2022-01-04', 100_000)
      .setRevenue(1, '2022-01-05', 250_000);
    const { billing } = setup(client);

    const first = await billing.runBillingForDay('2022-01-05');
    const second = await billing.runBillingForDay('2022-01-06');

    expect(client.revenueRequests).toEqual([
      { today: '2022-01-05', customerId: 1, forDate: '2022-01-04' },
      { today: '2022-01-06', customerId: 1, forDate: '2022-01-05' },
    ]);
    expect(client.charges).toEqual([
      { today: '2022-01-05', mandateId: 2, amountCents: 60_000, status: 'succeeded' },
      { today: '2022-01-06', mandateId: 2, amountCents: 150_000, status: 'succeeded' },
    ]);
    expect(first.charges).toEqual([
      { advanceId: 1, mandateId: 2, amount: '600.00', status: 'succeeded' },
    ]);
    expect(second.advancesProcessed).toBe(1);
  });

  it('rounds the revenue share half-up to the cent', async () => {
    const client = new FakeWayflyerClient()
      .addAdvance(makeAdvance({ repayment_percentage: 60 }))
      .setRevenue(1, '2022-01-04', 1_001); // 10.01 × 60% = 6.006
    const { billing } = setup(client);

    await billing.runBillingForDay('2022-01-05');

    expect(client.charges[0]!.amountCents).toBe(601);
  });

  it('skips the charge when the revenue share is zero', async () => {
    const client = new FakeWayflyerClient()
      .addAdvance(makeAdvance())
      .setRevenue(1, '2022-01-04', 0);
    const { billing, store } = setup(client);

    const report = await billing.runBillingForDay('2022-01-05');

    expect(client.charges).toEqual([]);
    expect(report.charges).toEqual([]);
    expect(store.get(1)!.billedRevenueDates.has('2022-01-04')).toBe(true);
  });

  it('keeps ledger totals in step with successful charges', async () => {
    const client = new FakeWayflyerClient().addAdvance(makeAdvance({ repayment_percentage: 10 }));
    setDailyRevenue(client, 1, '2022-01-04', '2022-01-08', 100_000);
    const { store, runDays } = setup(client);

    await runDays('2022-01-05', '2022-01-09');

    const ledger = store.get(1)!;
    const charged = client.charges.reduce((sum, charge) => sum + charge.amountCents, 0);
    expect(charged).toBe(50_000);
    expect(ledger.accruedCents).toBe(50_000);
    expect(ledger.repaidCents).toBe(50_000);
    expect(ledger.charges.map((c) => c.date)).toEqual(dateRange('2022-01-05', '2022-01-09'));
  });

  it('caps the final charge at the outstanding amount', async () => {
    const client = new FakeWayflyerClient().addAdvance(
      makeAdvance({ total_advanced: '900.00', fee: '100.00', repayment_percentage: 50 }),
    );
    setDailyRevenue(client, 1, '2022-01-04', '2022-01-05', 120_000); // 600.00 due each day
    const { store, runDays } = setup(client);

    await runDays('2022-01-05', '2022-01-06');

    expect(client.charges.map((c) => c.amountCents)).toEqual([60_000, 40_000]);
    expect(store.get(1)!.repaidCents).toBe(store.get(1)!.totalOwedCents);
  });

  it('calls billing_complete once after the final payment, then stops billing', async () => {
    const client = new FakeWayflyerClient().addAdvance(
      makeAdvance({ total_advanced: '900.00', fee: '100.00', repayment_percentage: 50 }),
    );
    setDailyRevenue(client, 1, '2022-01-04', '2022-01-10', 120_000);
    const { store, billing, runDays } = setup(client);

    await billing.runBillingForDay('2022-01-05');
    const finalDay = await billing.runBillingForDay('2022-01-06');
    const requestsAfterCompletion = client.revenueRequests.length;
    await runDays('2022-01-07', '2022-01-10');

    expect(finalDay.completedAdvanceIds).toEqual([1]);
    expect(client.completions).toEqual([{ today: '2022-01-06', advanceId: 1 }]);
    expect(store.get(1)!.completedOn).toBe('2022-01-06');
    expect(client.charges).toHaveLength(2);
    expect(client.revenueRequests).toHaveLength(requestsAfterCompletion);
  });

  it('bills several advances and customers in one run', async () => {
    const client = new FakeWayflyerClient()
      .addAdvance(makeAdvance({ id: 1, customer_id: 1, mandate_id: 11, repayment_percentage: 10 }))
      .addAdvance(makeAdvance({ id: 2, customer_id: 2, mandate_id: 22, repayment_percentage: 20 }))
      .setRevenue(1, '2022-01-04', 100_000)
      .setRevenue(2, '2022-01-04', 300_000);
    const { billing } = setup(client);

    const report = await billing.runBillingForDay('2022-01-05');

    expect(report.advancesProcessed).toBe(2);
    expect(report.charges).toEqual([
      { advanceId: 1, mandateId: 11, amount: '100.00', status: 'succeeded' },
      { advanceId: 2, mandateId: 22, amount: '600.00', status: 'succeeded' },
    ]);
  });

  it('charges each advance separately when a customer has two on the same mandate', async () => {
    const client = new FakeWayflyerClient()
      .addAdvance(makeAdvance({ id: 1, customer_id: 1, mandate_id: 2, repayment_percentage: 60 }))
      .addAdvance(makeAdvance({ id: 2, customer_id: 1, mandate_id: 2, repayment_percentage: 16 }))
      .setRevenue(1, '2022-01-04', 100_000);
    const { billing, store } = setup(client);

    const report = await billing.runBillingForDay('2022-01-05');

    expect(report.charges).toEqual([
      { advanceId: 1, mandateId: 2, amount: '600.00', status: 'succeeded' },
      { advanceId: 2, mandateId: 2, amount: '160.00', status: 'succeeded' },
    ]);
    expect(store.get(1)!.repaidCents).toBe(60_000);
    expect(store.get(2)!.repaidCents).toBe(16_000);
  });

  it('picks up advances created during the period', async () => {
    const client = new FakeWayflyerClient()
      .addAdvance(makeAdvance({ id: 1, created: '2022-01-02', repayment_start_date: '2022-01-03' }))
      .addAdvance(
        makeAdvance({ id: 2, created: '2022-01-06', repayment_start_date: '2022-01-07' }),
      );
    setDailyRevenue(client, 1, '2022-01-01', '2022-01-10', 100_000);
    const { billing, runDays } = setup(client);

    await runDays('2022-01-03', '2022-01-06');
    const report = await billing.runBillingForDay('2022-01-07');

    expect(report.charges.map((c) => c.advanceId)).toEqual([1, 2]);
  });

  it('catches up on every unbilled revenue day when billing starts late', async () => {
    const client = new FakeWayflyerClient().addAdvance(
      makeAdvance({ repayment_start_date: '2022-01-05', repayment_percentage: 10 }),
    );
    setDailyRevenue(client, 1, '2022-01-04', '2022-01-07', 100_000);
    const { billing } = setup(client);

    await billing.runBillingForDay('2022-01-08');

    expect(client.revenueRequests.map((r) => r.forDate)).toEqual(
      dateRange('2022-01-04', '2022-01-07'),
    );
    expect(client.charges).toEqual([
      { today: '2022-01-08', mandateId: 2, amountCents: 40_000, status: 'succeeded' },
    ]);
  });

  describe('day ordering', () => {
    it('rejects running the same day twice', async () => {
      const client = new FakeWayflyerClient().addAdvance(makeAdvance());
      const { billing } = setup(client);

      await billing.runBillingForDay('2022-01-05');

      await expect(billing.runBillingForDay('2022-01-05')).rejects.toThrow(ConflictError);
    });

    it('rejects running an earlier day', async () => {
      const client = new FakeWayflyerClient().addAdvance(makeAdvance());
      const { billing } = setup(client);

      await billing.runBillingForDay('2022-01-05');

      await expect(billing.runBillingForDay('2022-01-04')).rejects.toThrow(/in order/);
    });

    it('allows a retry of a day whose run failed part-way', async () => {
      const client = new FakeWayflyerClient().addAdvance(makeAdvance());
      const { billing } = setup(client);
      client.getAdvances = async () => {
        throw new Error('boom');
      };

      await expect(billing.runBillingForDay('2022-01-05')).rejects.toThrow('boom');
      client.getAdvances = FakeWayflyerClient.prototype.getAdvances.bind(client);

      await expect(billing.runBillingForDay('2022-01-05')).resolves.toMatchObject({
        date: '2022-01-05',
      });
    });
  });
});
