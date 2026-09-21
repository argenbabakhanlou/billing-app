import { z } from 'zod';
import { isValidIsoDate } from './dates.js';
import { MONEY_PATTERN } from './money.js';

export const isoDateSchema = z
  .string()
  .refine(isValidIsoDate, 'Expected a date in yyyy-mm-dd format');

export const moneySchema = z.string().regex(MONEY_PATTERN, 'Expected an amount like 10000.00');
