import { z } from 'zod';
import { fromCents, toCents, type Cents } from '../lib/money.js';
import { isoDateSchema, moneySchema } from '../lib/schemas.js';
import type { Advance } from '../types/advance.js';
import type { IsoDate } from '../types/api.js';

const NOT_AVAILABLE_STATUS = 530;

export type RevenueResult = { status: 'available'; amountCents: Cents } | { status: 'unavailable' };

export type ChargeResult = { status: 'succeeded' } | { status: 'rejected' };

export interface WayflyerClient {
  getAdvances(today: IsoDate): Promise<Advance[]>;
  getRevenue(today: IsoDate, customerId: number, forDate: IsoDate): Promise<RevenueResult>;
  charge(today: IsoDate, mandateId: number, amountCents: Cents): Promise<ChargeResult>;
  billingComplete(today: IsoDate, advanceId: number): Promise<void>;
}

export class UpstreamError extends Error {
  constructor(
    message: string,
    readonly endpoint: string,
    readonly status?: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'UpstreamError';
  }
}

const advanceSchema = z.object({
  id: z.number().int(),
  customer_id: z.number().int(),
  created: isoDateSchema,
  total_advanced: moneySchema,
  fee: moneySchema,
  mandate_id: z.number().int(),
  repayment_start_date: isoDateSchema,
  repayment_percentage: z.number().min(0).max(100),
}) satisfies z.ZodType<Advance>;

const advancesResponseSchema = z.object({ advances: z.array(advanceSchema) });

const revenueResponseSchema = z.object({ amount: moneySchema });

export class HttpWayflyerClient implements WayflyerClient {
  constructor(
    private readonly baseUrl: string,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async getAdvances(today: IsoDate): Promise<Advance[]> {
    const endpoint = '/advances';
    const res = await this.request(today, 'GET', endpoint);
    await this.assertOk(res, endpoint);
    const body = await this.parseJson(res, endpoint, advancesResponseSchema);
    return body.advances;
  }

  async getRevenue(today: IsoDate, customerId: number, forDate: IsoDate): Promise<RevenueResult> {
    const endpoint = `/customers/${customerId}/revenues/${forDate}`;
    const res = await this.request(today, 'GET', endpoint);
    if (res.status === NOT_AVAILABLE_STATUS) return { status: 'unavailable' };
    await this.assertOk(res, endpoint);
    const body = await this.parseJson(res, endpoint, revenueResponseSchema);
    return { status: 'available', amountCents: toCents(body.amount) };
  }

  async charge(today: IsoDate, mandateId: number, amountCents: Cents): Promise<ChargeResult> {
    if (amountCents <= 0) {
      throw new RangeError(`Charge amount must be positive, got ${amountCents} cents`);
    }
    const endpoint = `/mandates/${mandateId}/charge`;
    const res = await this.request(today, 'POST', endpoint, { amount: fromCents(amountCents) });
    if (res.status === NOT_AVAILABLE_STATUS) return { status: 'rejected' };
    await this.assertOk(res, endpoint);
    return { status: 'succeeded' };
  }

  async billingComplete(today: IsoDate, advanceId: number): Promise<void> {
    const endpoint = `/advances/${advanceId}/billing_complete`;
    const res = await this.request(today, 'POST', endpoint, {});
    await this.assertOk(res, endpoint);
  }

  private async request(
    today: IsoDate,
    method: 'GET' | 'POST',
    endpoint: string,
    body?: unknown,
  ): Promise<Response> {
    const headers: Record<string, string> = { Today: today };
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    try {
      return await this.fetchFn(`${this.baseUrl}${endpoint}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (err) {
      throw new UpstreamError(`${method} ${endpoint} failed: network error`, endpoint, undefined, {
        cause: err,
      });
    }
  }

  private async assertOk(res: Response, endpoint: string): Promise<void> {
    if (res.ok) return;
    const detail = (await res.text()).slice(0, 200);
    throw new UpstreamError(`${endpoint} responded ${res.status}: ${detail}`, endpoint, res.status);
  }

  private async parseJson<T>(res: Response, endpoint: string, schema: z.ZodType<T>): Promise<T> {
    const text = await res.text();
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch (err) {
      throw new UpstreamError(`${endpoint} returned invalid JSON`, endpoint, res.status, {
        cause: err,
      });
    }
    const result = schema.safeParse(json);
    if (!result.success) {
      throw new UpstreamError(
        `${endpoint} returned an unexpected shape:\n${z.prettifyError(result.error)}`,
        endpoint,
        res.status,
      );
    }
    return result.data;
  }
}
