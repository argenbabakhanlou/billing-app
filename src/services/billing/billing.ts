import { DAILY_CHARGE_CAP } from '../../config';
import type { DaySummary, IsoDate, LedgerEntry } from '../../types';
import { addDays, compareDates, percentOf } from '../../utils';
import type { BillingApi } from '../api';
import { remaining, type Ledger } from './ledger';

export interface BillingDeps {
  api: BillingApi;
  ledger: Ledger;
}

function queueRevenueDates(entry: LedgerEntry, today: IsoDate, ledger: Ledger) {
  const { id, repaymentStartDate } = entry.advance;
  if (compareDates(today, repaymentStartDate) < 0) return;

  const latest = addDays(today, -1);
  let date = entry.lastQueuedRevenueDate
    ? addDays(entry.lastQueuedRevenueDate, 1)
    : addDays(repaymentStartDate, -1);
  for (; compareDates(date, latest) <= 0; date = addDays(date, 1)) {
    ledger.queueRevenueDate(id, date);
  }
}

async function resolveRevenues(entry: LedgerEntry, today: IsoDate, { api, ledger }: BillingDeps) {
  const { id, customerId, repaymentPercentage } = entry.advance;
  for (const revenueDate of entry.pendingRevenueDates) {
    const revenue = await api.getRevenue(customerId, revenueDate, today);
    if (revenue !== null) ledger.addDue(id, revenueDate, percentOf(revenue, repaymentPercentage));
  }
}

async function billAdvance(id: number, today: IsoDate, deps: BillingDeps, summary: DaySummary) {
  const { api, ledger } = deps;

  queueRevenueDates(ledger.get(id)!, today, ledger);
  await resolveRevenues(ledger.get(id)!, today, deps);

  const entry = ledger.get(id)!;
  const amount = Math.min(entry.due, remaining(entry), DAILY_CHARGE_CAP);
  if (amount > 0) {
    const accepted = await api.charge(entry.advance.mandateId, amount, today);
    if (accepted) ledger.recordCharge(id, amount);
    summary.charges.push({ advanceId: id, mandateId: entry.advance.mandateId, amount, accepted });
  }

  const after = ledger.get(id)!;
  if (remaining(after) === 0) {
    await api.completeBilling(id, today);
    ledger.markComplete(id, today);
    summary.completed.push(id);
    return;
  }

  for (const revenueDate of after.pendingRevenueDates) {
    summary.pendingRevenues.push({ advanceId: id, revenueDate });
  }
}

export async function runBilling(today: IsoDate, deps: BillingDeps): Promise<DaySummary> {
  const { api, ledger } = deps;
  const summary: DaySummary = {
    date: today,
    newAdvances: [],
    charges: [],
    pendingRevenues: [],
    completed: [],
  };

  for (const advance of await api.getAdvances(today)) {
    if (ledger.register(advance)) summary.newAdvances.push(advance.id);
  }

  for (const entry of ledger.list()) {
    if (!entry.completedOn) await billAdvance(entry.advance.id, today, deps, summary);
  }

  return summary;
}
