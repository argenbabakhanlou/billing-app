import { vi } from 'vitest';
import type { BillingApi } from '../services/api';
import type { Advance, Cents, IsoDate } from '../types';
import { compareIsoDates } from '../utils';

interface Revenue {
  amount: Cents;
  availableFrom?: IsoDate;
}

export function makeAdvance(overrides: Partial<Advance> = {}): Advance {
  return {
    id: 1,
    customerId: 1,
    created: '2022-01-02',
    totalAdvanced: 6000000,
    fee: 250000,
    mandateId: 10,
    repaymentStartDate: '2022-01-05',
    repaymentPercentage: 10,
    ...overrides,
  };
}

export function createFakeApi() {
  const advances: Advance[] = [];
  const revenues = new Map<string, Revenue>();
  const rejectedChargeDays = new Set<IsoDate>();
  let defaultRevenue: Cents | null = null;

  const api = {
    fetchAdvances: vi.fn(async (today: IsoDate) =>
      advances.filter((advance) => compareIsoDates(advance.created, today) <= 0),
    ),
    fetchRevenue: vi.fn(async (customerId: number, forDate: IsoDate, today: IsoDate) => {
      const revenue = revenues.get(`${customerId}:${forDate}`);
      if (!revenue) return defaultRevenue;
      if (revenue.availableFrom && compareIsoDates(today, revenue.availableFrom) < 0) return null;
      return revenue.amount;
    }),
    chargeMandate: vi.fn(async (_mandateId: number, _amount: Cents, today: IsoDate) => {
      return !rejectedChargeDays.has(today);
    }),
    markBillingComplete: vi.fn(async () => {}),
  } satisfies BillingApi;

  return {
    api,
    addAdvance(advance: Advance) {
      advances.push(advance);
    },
    setRevenue(customerId: number, forDate: IsoDate, amount: Cents, availableFrom?: IsoDate) {
      revenues.set(`${customerId}:${forDate}`, { amount, availableFrom });
    },
    setDefaultRevenue(amount: Cents) {
      defaultRevenue = amount;
    },
    rejectChargesOn(today: IsoDate) {
      rejectedChargeDays.add(today);
    },
    chargedAmounts() {
      return api.chargeMandate.mock.calls.map(([, amount, today]) => ({ today, amount }));
    },
  };
}
