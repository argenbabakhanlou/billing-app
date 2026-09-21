import type {
  ChargeResult,
  RevenueResult,
  WayflyerClient,
} from '../../src/clients/wayflyer.client.js';
import { compareDates } from '../../src/lib/dates.js';
import type { Cents } from '../../src/lib/money.js';
import type { Advance } from '../../src/types/advance.js';
import type { IsoDate } from '../../src/types/api.js';

interface RevenueEntry {
  amountCents: Cents;
  availableFrom?: IsoDate;
}

export interface RecordedCharge {
  today: IsoDate;
  mandateId: number;
  amountCents: Cents;
  status: ChargeResult['status'];
}

// Mimics the live API: advances only appear from their `created` date onwards.
export class FakeWayflyerClient implements WayflyerClient {
  private advances: Advance[] = [];
  private readonly revenues = new Map<string, RevenueEntry>();
  private readonly rejectedCharges = new Set<string>();

  readonly revenueRequests: { today: IsoDate; customerId: number; forDate: IsoDate }[] = [];
  readonly charges: RecordedCharge[] = [];
  readonly completions: { today: IsoDate; advanceId: number }[] = [];

  addAdvance(advance: Advance): this {
    this.advances.push(advance);
    return this;
  }

  setRevenue(
    customerId: number,
    forDate: IsoDate,
    amountCents: Cents,
    options: { availableFrom?: IsoDate } = {},
  ): this {
    this.revenues.set(`${customerId}:${forDate}`, { amountCents, ...options });
    return this;
  }

  rejectChargesOn(mandateId: number, today: IsoDate): this {
    this.rejectedCharges.add(`${mandateId}:${today}`);
    return this;
  }

  async getAdvances(today: IsoDate): Promise<Advance[]> {
    return this.advances.filter((advance) => compareDates(advance.created, today) <= 0);
  }

  async getRevenue(today: IsoDate, customerId: number, forDate: IsoDate): Promise<RevenueResult> {
    this.revenueRequests.push({ today, customerId, forDate });
    const entry = this.revenues.get(`${customerId}:${forDate}`);
    if (!entry) return { status: 'unavailable' };
    if (entry.availableFrom && compareDates(today, entry.availableFrom) < 0) {
      return { status: 'unavailable' };
    }
    return { status: 'available', amountCents: entry.amountCents };
  }

  async charge(today: IsoDate, mandateId: number, amountCents: Cents): Promise<ChargeResult> {
    const status = this.rejectedCharges.has(`${mandateId}:${today}`) ? 'rejected' : 'succeeded';
    this.charges.push({ today, mandateId, amountCents, status });
    return { status };
  }

  async billingComplete(today: IsoDate, advanceId: number): Promise<void> {
    this.completions.push({ today, advanceId });
  }
}

export function makeAdvance(overrides: Partial<Advance> = {}): Advance {
  return {
    id: 1,
    customer_id: 1,
    mandate_id: 2,
    created: '2022-01-02',
    total_advanced: '60000.00',
    fee: '2500.00',
    repayment_start_date: '2022-01-05',
    repayment_percentage: 60,
    ...overrides,
  };
}
