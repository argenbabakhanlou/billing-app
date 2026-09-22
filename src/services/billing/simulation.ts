import { END_DATE, START_DATE } from '../../config';
import type { DaySummary, IsoDate } from '../../types';
import { eachDay } from '../../utils';
import { billingApi } from '../api';
import { runDailyBilling, type BillingDeps } from './billing';
import { createBillingLedger } from './ledger';

export interface SimulationOptions {
  from?: IsoDate;
  to?: IsoDate;
  deps?: BillingDeps;
  onDay?: (summary: DaySummary) => void;
}

export async function runSimulation({
  from = START_DATE,
  to = END_DATE,
  deps = { api: billingApi, ledger: createBillingLedger() },
  onDay,
}: SimulationOptions = {}) {
  const days: DaySummary[] = [];
  for (const today of eachDay(from, to)) {
    const summary = await runDailyBilling(today, deps);
    days.push(summary);
    onDay?.(summary);
  }
  return { ledger: deps.ledger, days };
}
