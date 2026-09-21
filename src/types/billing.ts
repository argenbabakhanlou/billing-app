import type { AdvanceSummary, ChargeStatus } from './advance.js';
import type { IsoDate, Money } from './api.js';

export interface ChargeAttempt {
  advanceId: number;
  mandateId: number;
  amount: Money;
  status: ChargeStatus;
}

export interface DailyRunReport {
  date: IsoDate;
  advancesProcessed: number;
  charges: ChargeAttempt[];
  completedAdvanceIds: number[];
}

export interface SimulationReport {
  startDate: IsoDate;
  endDate: IsoDate;
  days: DailyRunReport[];
  advances: AdvanceSummary[];
}
