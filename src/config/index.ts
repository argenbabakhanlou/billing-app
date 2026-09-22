import type { Cents, IsoDate } from '../types';

const viteEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;

function requireEnv(name: string): string {
  const value = viteEnv?.[name] ?? globalThis.process?.env?.[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

export const API_BASE_URL = requireEnv('VITE_API_BASE_URL');

export const START_DATE: IsoDate = '2022-01-01';
export const END_DATE: IsoDate = '2022-02-01';

export const DAILY_CHARGE_CAP: Cents = 1_000_000;
