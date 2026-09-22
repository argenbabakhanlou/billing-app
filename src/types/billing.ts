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

export interface ChargeAttempt {
  advanceId: number;
  mandateId: number;
  amount: Cents;
  accepted: boolean;
}

export interface PendingRevenue {
  advanceId: number;
  revenueDate: IsoDate;
}

export interface DaySummary {
  date: IsoDate;
  newAdvances: number[];
  charges: ChargeAttempt[];
  pendingRevenues: PendingRevenue[];
  completed: number[];
}
