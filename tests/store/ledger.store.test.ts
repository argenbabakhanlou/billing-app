import { beforeEach, describe, expect, it } from 'vitest';
import {
  dueCents,
  ledgerStatus,
  LedgerStore,
  outstandingCents,
} from '../../src/store/ledger.store.js';
import { makeAdvance } from '../helpers/fake-client.js';

describe('LedgerStore', () => {
  let store: LedgerStore;

  beforeEach(() => {
    store = new LedgerStore();
  });

  it('creates a ledger with total owed = advance + fee', () => {
    const ledger = store.add(makeAdvance({ total_advanced: '60000.00', fee: '2500.00' }));

    expect(ledger).toMatchObject({
      totalOwedCents: 6_250_000,
      accruedCents: 0,
      repaidCents: 0,
      charges: [],
    });
    expect(ledger.billedRevenueDates.size).toBe(0);
    expect(ledger.completedOn).toBeUndefined();
  });

  it('refuses to add the same advance twice', () => {
    store.add(makeAdvance({ id: 1 }));

    expect(() => store.add(makeAdvance({ id: 1 }))).toThrow(/already tracked/);
  });

  it('returns ledgers sorted by advance id', () => {
    store.add(makeAdvance({ id: 3 }));
    store.add(makeAdvance({ id: 1 }));
    store.add(makeAdvance({ id: 2 }));

    expect(store.all().map((l) => l.advance.id)).toEqual([1, 2, 3]);
  });

  it('looks up ledgers by id', () => {
    store.add(makeAdvance({ id: 7 }));

    expect(store.has(7)).toBe(true);
    expect(store.get(7)?.advance.id).toBe(7);
    expect(store.has(8)).toBe(false);
    expect(store.get(8)).toBeUndefined();
  });

  it('reset clears ledgers and the sync date', () => {
    store.add(makeAdvance());
    store.markSynced('2022-01-05');

    store.reset();

    expect(store.all()).toEqual([]);
    expect(store.lastSyncedOn).toBeUndefined();
  });
});

describe('derived values', () => {
  function ledgerWith(accruedCents: number, repaidCents: number) {
    const ledger = new LedgerStore().add(makeAdvance({ total_advanced: '100.00', fee: '0.00' }));
    return Object.assign(ledger, { accruedCents, repaidCents });
  }

  it('outstanding is total owed minus repaid', () => {
    expect(outstandingCents(ledgerWith(0, 0))).toBe(10_000);
    expect(outstandingCents(ledgerWith(5_000, 3_000))).toBe(7_000);
  });

  it('due is accrued minus repaid', () => {
    expect(dueCents(ledgerWith(5_000, 3_000))).toBe(2_000);
    expect(dueCents(ledgerWith(5_000, 5_000))).toBe(0);
  });

  it('due never exceeds what is still owed', () => {
    expect(dueCents(ledgerWith(25_000, 4_000))).toBe(6_000);
  });

  describe('ledgerStatus', () => {
    const ledger = () => new LedgerStore().add(makeAdvance({ repayment_start_date: '2022-01-05' }));

    it('is pending before any sync or before the start date', () => {
      expect(ledgerStatus(ledger(), undefined)).toBe('pending');
      expect(ledgerStatus(ledger(), '2022-01-04')).toBe('pending');
    });

    it('is repaying from the start date', () => {
      expect(ledgerStatus(ledger(), '2022-01-05')).toBe('repaying');
      expect(ledgerStatus(ledger(), '2022-01-20')).toBe('repaying');
    });

    it('is completed once billing is complete', () => {
      const completed = Object.assign(ledger(), { completedOn: '2022-01-10' });
      expect(ledgerStatus(completed, '2022-01-20')).toBe('completed');
    });
  });
});
