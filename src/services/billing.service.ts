import type { WayflyerClient } from '../clients/wayflyer.client.js';
import { addDays, compareDates, dateRange } from '../lib/dates.js';
import { ConflictError } from '../lib/errors.js';
import { fromCents, percentOf } from '../lib/money.js';
import { dueCents, type AdvanceLedger, type LedgerStore } from '../store/ledger.store.js';
import type { IsoDate } from '../types/api.js';
import type { ChargeAttempt, DailyRunReport } from '../types/billing.js';
import type { AdvancesService } from './advances.service.js';

export class BillingService {
  constructor(
    private readonly client: WayflyerClient,
    private readonly store: LedgerStore,
    private readonly advances: AdvancesService,
  ) {}

  async runBillingForDay(today: IsoDate): Promise<DailyRunReport> {
    const lastBilledOn = this.store.lastBilledOn;
    if (lastBilledOn && compareDates(today, lastBilledOn) <= 0) {
      throw new ConflictError(
        `Billing already ran for ${lastBilledOn}; days must be billed in order`,
      );
    }

    await this.advances.sync(today);

    const report: DailyRunReport = {
      date: today,
      advancesProcessed: 0,
      charges: [],
      completedAdvanceIds: [],
    };

    for (const ledger of this.store.all()) {
      if (!this.isActive(ledger, today)) continue;
      report.advancesProcessed++;

      await this.accrueRevenue(ledger, today);

      const charge = await this.collectDue(ledger, today);
      if (charge) report.charges.push(charge);

      if (await this.completeIfRepaid(ledger, today)) {
        report.completedAdvanceIds.push(ledger.advance.id);
      }
    }

    this.store.markBilled(today);
    return report;
  }

  private isActive(ledger: AdvanceLedger, today: IsoDate): boolean {
    return !ledger.completedOn && compareDates(ledger.advance.repayment_start_date, today) <= 0;
  }

  // On day T we bill revenue for T-1 (A1). Unavailable dates stay unbilled and are retried later.
  private async accrueRevenue(ledger: AdvanceLedger, today: IsoDate): Promise<void> {
    const { advance } = ledger;
    const firstRevenueDate = addDays(advance.repayment_start_date, -1);
    const pendingDates = dateRange(firstRevenueDate, addDays(today, -1)).filter(
      (date) => !ledger.billedRevenueDates.has(date),
    );

    for (const date of pendingDates) {
      const revenue = await this.client.getRevenue(today, advance.customer_id, date);
      if (revenue.status === 'unavailable') continue;

      ledger.accruedCents += percentOf(revenue.amountCents, advance.repayment_percentage);
      ledger.billedRevenueDates.add(date);
    }
  }

  private async collectDue(ledger: AdvanceLedger, today: IsoDate): Promise<ChargeAttempt | null> {
    const amountCents = dueCents(ledger);
    if (amountCents <= 0) return null;

    const { advance } = ledger;
    const result = await this.client.charge(today, advance.mandate_id, amountCents);

    ledger.charges.push({ date: today, amountCents, status: result.status });
    if (result.status === 'succeeded') ledger.repaidCents += amountCents;

    return {
      advanceId: advance.id,
      mandateId: advance.mandate_id,
      amount: fromCents(amountCents),
      status: result.status,
    };
  }

  private async completeIfRepaid(ledger: AdvanceLedger, today: IsoDate): Promise<boolean> {
    if (ledger.completedOn || ledger.repaidCents < ledger.totalOwedCents) return false;

    await this.client.billingComplete(today, ledger.advance.id);
    ledger.completedOn = today;
    return true;
  }
}
