import { createBillingLedger } from './ledger';
import { runSimulation } from './simulation';
import { createFakeApi, makeAdvance } from '../../testing/test-api';

describe('runSimulation', () => {
  it('runs billing for every day in the range, inclusive', async () => {
    const fake = createFakeApi();
    const onDay = vi.fn();

    const { days } = await runSimulation({
      from: '2022-01-01',
      to: '2022-01-05',
      deps: { api: fake.api, ledger: createBillingLedger() },
      onDay,
    });

    expect(days.map((d) => d.date)).toEqual([
      '2022-01-01',
      '2022-01-02',
      '2022-01-03',
      '2022-01-04',
      '2022-01-05',
    ]);
    expect(onDay).toHaveBeenCalledTimes(5);
    expect(fake.api.fetchAdvances).toHaveBeenCalledTimes(5);
  });

  it('bills an advance to completion over the period', async () => {
    const fake = createFakeApi();
    fake.addAdvance(makeAdvance({ totalAdvanced: 2500000, fee: 100000 }));
    fake.setDefaultRevenue(10000000);

    const { ledger } = await runSimulation({
      from: '2022-01-01',
      to: '2022-02-01',
      deps: { api: fake.api, ledger: createBillingLedger() },
    });

    expect(ledger.get(1)).toMatchObject({ repaid: 2600000, completedOn: '2022-01-07' });
    expect(fake.chargedAmounts().map((c) => c.amount)).toEqual([1000000, 1000000, 600000]);
    expect(ledger.snapshot().totals).toMatchObject({ outstanding: 0, completed: 1, active: 0 });
  });
});
