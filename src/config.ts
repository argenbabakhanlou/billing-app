import { z } from 'zod';
import { compareDates, isValidIsoDate } from './lib/dates.js';
import { toCents, type Cents } from './lib/money.js';
import type { IsoDate } from './types/api.js';

const isoDate = z.string().refine(isValidIsoDate, 'Expected a date in yyyy-mm-dd format');
const money = z.string().regex(/^\d+\.\d{2}$/, 'Expected an amount like 10000.00');

const envSchema = z
  .object({
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    BILLING_API_BASE_URL: z.url().default('https://billing.eng-test.wayflyer.com/v2'),
    DAILY_CHARGE_CAP: money.default('10000.00'),
    SIM_START: isoDate.default('2022-01-01'),
    SIM_END: isoDate.default('2022-02-01'),
  })
  .refine(
    (env) =>
      !isValidIsoDate(env.SIM_START) ||
      !isValidIsoDate(env.SIM_END) ||
      compareDates(env.SIM_START, env.SIM_END) <= 0,
    { message: 'SIM_START must be on or before SIM_END', path: ['SIM_START'] },
  );

export interface Config {
  port: number;
  billingApiBaseUrl: string;
  dailyChargeCapCents: Cents;
  simulationStart: IsoDate;
  simulationEnd: IsoDate;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    throw new Error(`Invalid configuration:\n${z.prettifyError(result.error)}`);
  }
  const parsed = result.data;
  return {
    port: parsed.PORT,
    billingApiBaseUrl: parsed.BILLING_API_BASE_URL.replace(/\/+$/, ''),
    dailyChargeCapCents: toCents(parsed.DAILY_CHARGE_CAP),
    simulationStart: parsed.SIM_START,
    simulationEnd: parsed.SIM_END,
  };
}
