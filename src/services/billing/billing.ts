import { DAILY_CHARGE_CAP } from '../../config';
import type { DaySummary, IsoDate, LedgerEntry } from '../../types';
import { shiftDate, compareIsoDates, applyPercentage } from '../../utils';
import type { BillingApi } from '../api';
import { remainingBalance, type Ledger } from './ledger';

export interface BillingDeps {
  api: BillingApi;
  ledger: Ledger;
}

function queueRevenueDates(entry: LedgerEntry, today: IsoDate, ledger: Ledger) {
  const { id, repaymentStartDate } = entry.advance;
  if (compareIsoDates(today, repaymentStartDate) < 0) return;

  const latest = shiftDate(today, -1);
  let date = entry.lastQueuedRevenueDate
    ? shiftDate(entry.lastQueuedRevenueDate, 1)
    : shiftDate(repaymentStartDate, -1);
  for (; compareIsoDates(date, latest) <= 0; date = shiftDate(date, 1)) {
    ledger.queueRevenueDate(id, date);
  }
}

async function resolveRevenues(entry: LedgerEntry, today: IsoDate, { api, ledger }: BillingDeps) {
  const { id, customerId, repaymentPercentage } = entry.advance;
  for (const revenueDate of entry.pendingRevenueDates) {
    const revenue = await api.fetchRevenue(customerId, revenueDate, today);
    if (revenue !== null)
      ledger.addDue(id, revenueDate, applyPercentage(revenue, repaymentPercentage));
  }
}

async function billAdvance(id: number, today: IsoDate, deps: BillingDeps, summary: DaySummary) {
  const { api, ledger } = deps;

  queueRevenueDates(ledger.get(id)!, today, ledger);
  await resolveRevenues(ledger.get(id)!, today, deps);

  const entry = ledger.get(id)!;
  const amount = Math.min(entry.due, remainingBalance(entry), DAILY_CHARGE_CAP);
  if (amount > 0) {
    const accepted = await api.chargeMandate(entry.advance.mandateId, amount, today);
    if (accepted) ledger.recordCharge(id, amount);
    summary.charges.push({ advanceId: id, mandateId: entry.advance.mandateId, amount, accepted });
  }

  const after = ledger.get(id)!;
  if (remainingBalance(after) === 0) {
    await api.markBillingComplete(id, today);
    ledger.markComplete(id, today);
    summary.completed.push(id);
    return;
  }

  for (const revenueDate of after.pendingRevenueDates) {
    summary.pendingRevenues.push({ advanceId: id, revenueDate });
  }
}

export async function runDailyBilling(today: IsoDate, deps: BillingDeps): Promise<DaySummary> {
  const { api, ledger } = deps;
  const summary: DaySummary = {
    date: today,
    newAdvances: [],
    charges: [],
    pendingRevenues: [],
    completed: [],
  };

  for (const advance of await api.fetchAdvances(today)) {
    if (ledger.register(advance)) summary.newAdvances.push(advance.id);
  }

  for (const entry of ledger.list()) {
    if (!entry.completedOn) await billAdvance(entry.advance.id, today, deps, summary);
  }

  return summary;
}
