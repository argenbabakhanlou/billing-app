import type { IsoDate, Money } from './api.js';

export interface Advance {
  id: number;
  customer_id: number;
  created: IsoDate;
  total_advanced: Money;
  fee: Money;
  mandate_id: number;
  repayment_start_date: IsoDate;
  repayment_percentage: number;
}

export type AdvanceStatus = 'pending' | 'repaying' | 'completed';

export type ChargeStatus = 'succeeded' | 'rejected';

export interface ChargeRecord {
  date: IsoDate;
  amount: Money;
  status: ChargeStatus;
}

export interface AdvanceSummary {
  id: number;
  customerId: number;
  mandateId: number;
  totalOwed: Money;
  repaid: Money;
  outstanding: Money;
  status: AdvanceStatus;
  completedOn?: IsoDate;
}

export interface AdvanceDetail extends AdvanceSummary {
  repaymentStartDate: IsoDate;
  repaymentPercentage: number;
  charges: ChargeRecord[];
}
