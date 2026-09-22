import type { Cents, IsoDate } from '../types';

const DEFAULT_API_BASE_URL = 'https://billing.eng-test.wayflyer.com/v2';

const viteEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;

export const API_BASE_URL: string =
  viteEnv?.VITE_API_BASE_URL ?? globalThis.process?.env?.VITE_API_BASE_URL ?? DEFAULT_API_BASE_URL;

export const START_DATE: IsoDate = '2022-01-01';
export const END_DATE: IsoDate = '2022-02-01';

export const DAILY_CHARGE_CAP: Cents = 1_000_000;
