import type { WayflyerClient } from '../clients/wayflyer.client.js';
import { fromCents } from '../lib/money.js';
import {
  ledgerStatus,
  outstandingCents,
  type AdvanceLedger,
  type LedgerStore,
} from '../store/ledger.store.js';
import type { AdvanceDetail, AdvanceSummary } from '../types/advance.js';
import type { IsoDate } from '../types/api.js';

export class AdvancesService {
  constructor(
    private readonly client: WayflyerClient,
    private readonly store: LedgerStore,
  ) {}

  async sync(today: IsoDate): Promise<number[]> {
    const advances = await this.client.getAdvances(today);
    const added = advances.filter((advance) => !this.store.has(advance.id));
    for (const advance of added) this.store.add(advance);
    this.store.markSynced(today);
    return added.map((advance) => advance.id);
  }

  list(): AdvanceSummary[] {
    return this.store.all().map((ledger) => this.toSummary(ledger));
  }

  get(advanceId: number): AdvanceDetail | undefined {
    const ledger = this.store.get(advanceId);
    if (!ledger) return undefined;
    return {
      ...this.toSummary(ledger),
      repaymentStartDate: ledger.advance.repayment_start_date,
      repaymentPercentage: ledger.advance.repayment_percentage,
      charges: ledger.charges.map((charge) => ({
        date: charge.date,
        amount: fromCents(charge.amountCents),
        status: charge.status,
      })),
    };
  }

  private toSummary(ledger: AdvanceLedger): AdvanceSummary {
    return {
      id: ledger.advance.id,
      customerId: ledger.advance.customer_id,
      mandateId: ledger.advance.mandate_id,
      totalOwed: fromCents(ledger.totalOwedCents),
      repaid: fromCents(ledger.repaidCents),
      outstanding: fromCents(outstandingCents(ledger)),
      status: ledgerStatus(ledger, this.store.lastSyncedOn),
      ...(ledger.completedOn && { completedOn: ledger.completedOn }),
    };
  }
}
