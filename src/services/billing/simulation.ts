import { END_DATE, START_DATE } from '../../config';
import type { DaySummary, IsoDate } from '../../types';
import { dateRange } from '../../utils';
import { billingApi } from '../api';
import { runBilling, type BillingDeps } from './billing';
import { createLedger } from './ledger';

export interface SimulationOptions {
  from?: IsoDate;
  to?: IsoDate;
  deps?: BillingDeps;
  onDay?: (summary: DaySummary) => void;
}

export async function simulate({
  from = START_DATE,
  to = END_DATE,
  deps = { api: billingApi, ledger: createLedger() },
  onDay,
}: SimulationOptions = {}) {
  const days: DaySummary[] = [];
  for (const today of dateRange(from, to)) {
    const summary = await runBilling(today, deps);
    days.push(summary);
    onDay?.(summary);
  }
  return { ledger: deps.ledger, days };
}
