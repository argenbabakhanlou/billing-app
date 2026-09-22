import type { Advance, Cents, IsoDate } from './domain';

export interface LedgerEntry {
  advance: Advance;
  owed: Cents;
  repaid: Cents;
  due: Cents;
  pendingRevenueDates: IsoDate[];
  lastQueuedRevenueDate: IsoDate | null;
  completedOn: IsoDate | null;
}

export interface LedgerTotals {
  owed: Cents;
  repaid: Cents;
  outstanding: Cents;
  active: number;
  completed: number;
}

export interface LedgerSnapshot {
  entries: readonly LedgerEntry[];
  totals: LedgerTotals;
}
