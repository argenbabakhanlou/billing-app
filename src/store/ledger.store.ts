import { compareDates } from '../lib/dates.js';
import { toCents, type Cents } from '../lib/money.js';
import type { Advance, AdvanceStatus, ChargeStatus } from '../types/advance.js';
import type { IsoDate } from '../types/api.js';

export interface ChargeEntry {
  date: IsoDate;
  amountCents: Cents;
  status: ChargeStatus;
}

export interface AdvanceLedger {
  advance: Advance;
  totalOwedCents: Cents;
  accruedCents: Cents;
  repaidCents: Cents;
  billedRevenueDates: Set<IsoDate>;
  charges: ChargeEntry[];
  completedOn?: IsoDate;
}

export function outstandingCents(ledger: AdvanceLedger): Cents {
  return ledger.totalOwedCents - ledger.repaidCents;
}

export function dueCents(ledger: AdvanceLedger): Cents {
  return Math.min(ledger.accruedCents, ledger.totalOwedCents) - ledger.repaidCents;
}

export function ledgerStatus(ledger: AdvanceLedger, asOf: IsoDate | undefined): AdvanceStatus {
  if (ledger.completedOn) return 'completed';
  if (asOf && compareDates(ledger.advance.repayment_start_date, asOf) <= 0) return 'repaying';
  return 'pending';
}

export class LedgerStore {
  private readonly ledgers = new Map<number, AdvanceLedger>();
  private syncedOn?: IsoDate;
  private billedOn?: IsoDate;

  get lastSyncedOn(): IsoDate | undefined {
    return this.syncedOn;
  }

  markSynced(today: IsoDate): void {
    this.syncedOn = today;
  }

  get lastBilledOn(): IsoDate | undefined {
    return this.billedOn;
  }

  markBilled(today: IsoDate): void {
    this.billedOn = today;
  }

  has(advanceId: number): boolean {
    return this.ledgers.has(advanceId);
  }

  get(advanceId: number): AdvanceLedger | undefined {
    return this.ledgers.get(advanceId);
  }

  add(advance: Advance): AdvanceLedger {
    if (this.ledgers.has(advance.id)) {
      throw new Error(`Advance ${advance.id} is already tracked`);
    }
    const ledger: AdvanceLedger = {
      advance,
      totalOwedCents: toCents(advance.total_advanced) + toCents(advance.fee),
      accruedCents: 0,
      repaidCents: 0,
      billedRevenueDates: new Set(),
      charges: [],
    };
    this.ledgers.set(advance.id, ledger);
    return ledger;
  }

  all(): AdvanceLedger[] {
    return [...this.ledgers.values()].sort((a, b) => a.advance.id - b.advance.id);
  }

  reset(): void {
    this.ledgers.clear();
    this.syncedOn = undefined;
    this.billedOn = undefined;
  }
}
