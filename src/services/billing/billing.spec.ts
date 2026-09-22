import { runDailyBilling } from './billing';
import { createBillingLedger } from './ledger';
import { eachDay } from '../../utils';
import { createFakeApi, makeAdvance } from '../../testing/test-api';

function setup() {
  const fake = createFakeApi();
  const ledger = createBillingLedger();
  const deps = { api: fake.api, ledger };
  const run = (today: string) => runDailyBilling(today, deps);
  const runDays = async (from: string, to: string) => {
    for (const day of eachDay(from, to)) await run(day);
  };
  return { fake, ledger, run, runDays };
}

describe('runDailyBilling', () => {
  it('registers new advances once', async () => {
    const { fake, ledger, run } = setup();
    fake.addAdvance(makeAdvance());

    expect((await run('2022-01-02')).newAdvances).toEqual([1]);
    expect((await run('2022-01-03')).newAdvances).toEqual([]);
    expect(ledger.list()).toHaveLength(1);
  });

  it('does not bill before the repayment start date', async () => {
    const { fake, run, runDays } = setup();
    fake.addAdvance(makeAdvance());
    fake.setDefaultRevenue(100000);

    await runDays('2022-01-02', '2022-01-04');
    const summary = await run('2022-01-04');

    expect(fake.api.fetchRevenue).not.toHaveBeenCalled();
    expect(fake.api.chargeMandate).not.toHaveBeenCalled();
    expect(summary.charges).toEqual([]);
  });

  it('charges a percentage of the previous day revenue from the start date', async () => {
    const { fake, ledger, run, runDays } = setup();
    fake.addAdvance(makeAdvance());
    fake.setRevenue(1, '2022-01-04', 100000);
    fake.setRevenue(1, '2022-01-05', 250000);

    await runDays('2022-01-02', '2022-01-04');
    const day1 = await run('2022-01-05');
    const day2 = await run('2022-01-06');

    expect(fake.api.fetchRevenue).toHaveBeenCalledWith(1, '2022-01-04', '2022-01-05');
    expect(day1.charges).toEqual([{ advanceId: 1, mandateId: 10, amount: 10000, accepted: true }]);
    expect(day2.charges).toEqual([{ advanceId: 1, mandateId: 10, amount: 25000, accepted: true }]);
    expect(ledger.get(1)).toMatchObject({ repaid: 35000, due: 0 });
  });

  it('bills late revenue as soon as it becomes available', async () => {
    const { fake, ledger, run } = setup();
    fake.addAdvance(makeAdvance());
    fake.setRevenue(1, '2022-01-04', 100000, '2022-01-07');
    fake.setRevenue(1, '2022-01-05', 200000);
    fake.setRevenue(1, '2022-01-06', 300000);

    const day5 = await run('2022-01-05');
    expect(day5.charges).toEqual([]);
    expect(day5.pendingRevenues).toEqual([{ advanceId: 1, revenueDate: '2022-01-04' }]);

    const day6 = await run('2022-01-06');
    expect(day6.charges.map((c) => c.amount)).toEqual([20000]);
    expect(day6.pendingRevenues).toEqual([{ advanceId: 1, revenueDate: '2022-01-04' }]);

    const day7 = await run('2022-01-07');
    expect(day7.charges.map((c) => c.amount)).toEqual([40000]);
    expect(day7.pendingRevenues).toEqual([]);
    expect(ledger.get(1)!.repaid).toBe(60000);
  });

  it('carries rejected charges over to the next day', async () => {
    const { fake, ledger, run } = setup();
    fake.addAdvance(makeAdvance());
    fake.setDefaultRevenue(100000);
    fake.rejectChargesOn('2022-01-05');

    const day5 = await run('2022-01-05');
    expect(day5.charges).toEqual([{ advanceId: 1, mandateId: 10, amount: 10000, accepted: false }]);
    expect(ledger.get(1)).toMatchObject({ repaid: 0, due: 10000 });

    await run('2022-01-06');
    expect(fake.chargedAmounts().at(-1)).toEqual({ today: '2022-01-06', amount: 20000 });
    expect(ledger.get(1)).toMatchObject({ repaid: 20000, due: 0 });
  });

  it('caps daily charges at 10000.00 and spreads the rest over later days', async () => {
    const { fake, ledger, runDays } = setup();
    fake.addAdvance(makeAdvance({ repaymentPercentage: 60 }));
    fake.setRevenue(1, '2022-01-04', 5000000);
    fake.setDefaultRevenue(0);

    await runDays('2022-01-05', '2022-01-08');

    expect(fake.chargedAmounts().map((c) => c.amount)).toEqual([1000000, 1000000, 1000000]);
    expect(ledger.get(1)).toMatchObject({ repaid: 3000000, due: 0 });
  });

  it('caps the final charge at the remaining balance and completes once', async () => {
    const { fake, ledger, run, runDays } = setup();
    fake.addAdvance(makeAdvance({ totalAdvanced: 20000, fee: 5000 }));
    fake.setDefaultRevenue(100000);

    await runDays('2022-01-05', '2022-01-07');
    const completedDay = await run('2022-01-08');
    await runDays('2022-01-09', '2022-01-12');

    expect(fake.chargedAmounts().map((c) => c.amount)).toEqual([10000, 10000, 5000]);
    expect(fake.api.markBillingComplete).toHaveBeenCalledTimes(1);
    expect(fake.api.markBillingComplete).toHaveBeenCalledWith(1, '2022-01-07');
    expect(completedDay.charges).toEqual([]);
    expect(ledger.get(1)).toMatchObject({ repaid: 25000, completedOn: '2022-01-07' });
  });

  it('stops fetching revenue once an advance is complete', async () => {
    const { fake, runDays } = setup();
    fake.addAdvance(makeAdvance({ totalAdvanced: 10000, fee: 0 }));
    fake.setRevenue(1, '2022-01-04', 50000);
    fake.setRevenue(1, '2022-01-05', 50000);
    fake.setDefaultRevenue(100000);

    await runDays('2022-01-05', '2022-01-10');

    expect(fake.api.fetchRevenue).toHaveBeenCalledTimes(2);
    expect(fake.api.markBillingComplete).toHaveBeenCalledTimes(1);
    expect(fake.api.markBillingComplete).toHaveBeenCalledWith(1, '2022-01-06');
  });

  it('picks up advances created mid-period', async () => {
    const { fake, ledger, run, runDays } = setup();
    fake.addAdvance(makeAdvance());
    fake.addAdvance(
      makeAdvance({
        id: 2,
        created: '2022-01-10',
        repaymentStartDate: '2022-01-12',
        mandateId: 20,
      }),
    );
    fake.setDefaultRevenue(100000);

    await runDays('2022-01-02', '2022-01-09');
    expect(ledger.get(2)).toBeUndefined();

    expect((await run('2022-01-10')).newAdvances).toEqual([2]);
    await run('2022-01-11');
    const day12 = await run('2022-01-12');

    expect(fake.api.fetchRevenue).toHaveBeenCalledWith(1, '2022-01-11', '2022-01-12');
    expect(day12.charges.map((c) => c.advanceId)).toEqual([1, 2]);
  });

  it('backfills revenue from the day before start when an advance is first seen late', async () => {
    const { fake, run } = setup();
    fake.addAdvance(makeAdvance({ repaymentStartDate: '2022-01-05' }));
    fake.setDefaultRevenue(100000);

    const summary = await run('2022-01-07');

    const requested = fake.api.fetchRevenue.mock.calls.map(([, forDate]) => forDate);
    expect(requested).toEqual(['2022-01-04', '2022-01-05', '2022-01-06']);
    expect(summary.charges.map((c) => c.amount)).toEqual([30000]);
  });

  it('bills multiple advances for the same customer independently', async () => {
    const { fake, run } = setup();
    fake.addAdvance(makeAdvance({ repaymentPercentage: 10 }));
    fake.addAdvance(makeAdvance({ id: 2, repaymentPercentage: 20 }));
    fake.setDefaultRevenue(100000);

    const summary = await run('2022-01-05');

    expect(summary.charges.map(({ advanceId, amount }) => ({ advanceId, amount }))).toEqual([
      { advanceId: 1, amount: 10000 },
      { advanceId: 2, amount: 20000 },
    ]);
  });
});
