import { createLedger, remaining } from './ledger';
import type { Advance } from '../../types';

const advance: Advance = {
  id: 1,
  customerId: 1,
  created: '2022-01-02',
  totalAdvanced: 6000000,
  fee: 250000,
  mandateId: 2,
  repaymentStartDate: '2022-01-05',
  repaymentPercentage: 60,
};

function setup() {
  const ledger = createLedger();
  ledger.register(advance);
  return ledger;
}

describe('register', () => {
  it('creates an entry owing total plus fee', () => {
    const entry = setup().get(1)!;
    expect(entry).toMatchObject({ owed: 6250000, repaid: 0, due: 0, completedOn: null });
    expect(remaining(entry)).toBe(6250000);
  });

  it('ignores advances it already knows', () => {
    const ledger = setup();
    expect(ledger.register({ ...advance, fee: 0 })).toBe(false);
    expect(ledger.list()).toHaveLength(1);
    expect(ledger.get(1)!.owed).toBe(6250000);
  });
});

describe('queueRevenueDate', () => {
  it('queues dates in order and ignores repeats or earlier dates', () => {
    const ledger = setup();
    expect(ledger.queueRevenueDate(1, '2022-01-04')).toBe(true);
    expect(ledger.queueRevenueDate(1, '2022-01-05')).toBe(true);
    expect(ledger.queueRevenueDate(1, '2022-01-05')).toBe(false);
    expect(ledger.queueRevenueDate(1, '2022-01-03')).toBe(false);
    expect(ledger.get(1)!.pendingRevenueDates).toEqual(['2022-01-04', '2022-01-05']);
  });

  it('does not re-queue a date once resolved', () => {
    const ledger = setup();
    ledger.queueRevenueDate(1, '2022-01-04');
    ledger.addDue(1, '2022-01-04', 100);
    expect(ledger.queueRevenueDate(1, '2022-01-04')).toBe(false);
  });
});

describe('addDue', () => {
  it('resolves the pending date and accumulates due', () => {
    const ledger = setup();
    ledger.queueRevenueDate(1, '2022-01-04');
    ledger.queueRevenueDate(1, '2022-01-05');
    ledger.addDue(1, '2022-01-05', 300);
    ledger.addDue(1, '2022-01-04', 200);

    const entry = ledger.get(1)!;
    expect(entry.due).toBe(500);
    expect(entry.pendingRevenueDates).toEqual([]);
  });

  it('rejects a date that is not pending', () => {
    expect(() => setup().addDue(1, '2022-01-04', 100)).toThrow();
  });
});

describe('recordCharge', () => {
  it('increases repaid and reduces due', () => {
    const ledger = setup();
    ledger.queueRevenueDate(1, '2022-01-04');
    ledger.addDue(1, '2022-01-04', 1500000);
    ledger.recordCharge(1, 1000000);

    expect(ledger.get(1)).toMatchObject({ repaid: 1000000, due: 500000 });
  });

  it('never leaves due negative', () => {
    const ledger = setup();
    ledger.recordCharge(1, 100);
    expect(ledger.get(1)!.due).toBe(0);
  });

  it.each([0, -1, 6250001])('rejects a charge of %d', (amount) => {
    expect(() => setup().recordCharge(1, amount)).toThrow();
  });

  it('rejects unknown advances', () => {
    expect(() => setup().recordCharge(99, 100)).toThrow();
  });
});

describe('markComplete', () => {
  it('completes a fully repaid advance and clears outstanding work', () => {
    const ledger = setup();
    ledger.queueRevenueDate(1, '2022-01-04');
    ledger.queueRevenueDate(1, '2022-01-05');
    ledger.addDue(1, '2022-01-04', 7000000);
    ledger.recordCharge(1, 6250000);
    ledger.markComplete(1, '2022-01-20');

    expect(ledger.get(1)).toMatchObject({
      completedOn: '2022-01-20',
      due: 0,
      pendingRevenueDates: [],
    });
  });

  it('refuses to complete an advance that is still owed', () => {
    expect(() => setup().markComplete(1, '2022-01-20')).toThrow();
  });
});

describe('read side', () => {
  it('returns copies that cannot mutate the ledger', () => {
    const ledger = setup();
    const entry = ledger.get(1)!;
    entry.repaid = 999;
    entry.pendingRevenueDates.push('2022-01-01');
    expect(ledger.get(1)).toMatchObject({ repaid: 0, pendingRevenueDates: [] });
  });

  it('returns undefined for unknown advances', () => {
    expect(setup().get(99)).toBeUndefined();
  });

  it('summarises totals across advances', () => {
    const ledger = setup();
    ledger.register({ ...advance, id: 2, totalAdvanced: 100, fee: 0 });
    ledger.recordCharge(2, 100);
    ledger.markComplete(2, '2022-01-10');
    ledger.recordCharge(1, 50);

    expect(ledger.snapshot().totals).toEqual({
      owed: 6250100,
      repaid: 150,
      outstanding: 6249950,
      active: 1,
      completed: 1,
    });
  });

  it('keeps the same snapshot until something changes', () => {
    const ledger = setup();
    const first = ledger.snapshot();
    expect(ledger.snapshot()).toBe(first);
    ledger.recordCharge(1, 100);
    expect(ledger.snapshot()).not.toBe(first);
  });
});

describe('subscribe', () => {
  it('notifies listeners with the latest snapshot on every change', () => {
    const ledger = setup();
    const listener = vi.fn();
    ledger.subscribe(listener);

    ledger.recordCharge(1, 100);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenLastCalledWith(ledger.snapshot());
  });

  it('stops notifying after unsubscribe', () => {
    const ledger = setup();
    const listener = vi.fn();
    const unsubscribe = ledger.subscribe(listener);
    unsubscribe();

    ledger.recordCharge(1, 100);
    expect(listener).not.toHaveBeenCalled();
  });

  it('does not notify for no-op registrations', () => {
    const ledger = setup();
    const listener = vi.fn();
    ledger.subscribe(listener);
    ledger.register(advance);
    ledger.queueRevenueDate(1, '2022-01-04');
    ledger.queueRevenueDate(1, '2022-01-04');
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
