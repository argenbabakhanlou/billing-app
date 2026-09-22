import { createLedger } from './ledger';
import { simulate } from './simulation';
import { createFakeApi, makeAdvance } from '../../testing/fake-api';

describe('simulate', () => {
  it('runs billing for every day in the range, inclusive', async () => {
    const fake = createFakeApi();
    const onDay = vi.fn();

    const { days } = await simulate({
      from: '2022-01-01',
      to: '2022-01-05',
      deps: { api: fake.api, ledger: createLedger() },
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
    expect(fake.api.getAdvances).toHaveBeenCalledTimes(5);
  });

  it('bills an advance to completion over the period', async () => {
    const fake = createFakeApi();
    fake.addAdvance(makeAdvance({ totalAdvanced: 2500000, fee: 100000 }));
    fake.setDefaultRevenue(10000000);

    const { ledger } = await simulate({
      from: '2022-01-01',
      to: '2022-02-01',
      deps: { api: fake.api, ledger: createLedger() },
    });

    expect(ledger.get(1)).toMatchObject({ repaid: 2600000, completedOn: '2022-01-07' });
    expect(fake.chargedAmounts().map((c) => c.amount)).toEqual([1000000, 1000000, 600000]);
    expect(ledger.snapshot().totals).toMatchObject({ outstanding: 0, completed: 1, active: 0 });
  });
});
