import type { Money } from '../types/api.js';

export type Cents = number;

const MONEY_PATTERN = /^\d+\.\d{2}$/;
const PERCENT_SCALE = 10_000n;

export function toCents(amount: Money): Cents {
  if (!MONEY_PATTERN.test(amount)) {
    throw new RangeError(`Invalid money amount: "${amount}"`);
  }
  const cents = Number(amount.replace('.', ''));
  if (!Number.isSafeInteger(cents)) {
    throw new RangeError(`Money amount too large: "${amount}"`);
  }
  return cents;
}

export function fromCents(cents: Cents): Money {
  assertCents(cents);
  const whole = Math.floor(cents / 100);
  const fraction = String(cents % 100).padStart(2, '0');
  return `${whole}.${fraction}`;
}

// Rounds half-up to the nearest cent. Supports percentages with up to 4 decimal places.
export function percentOf(cents: Cents, percentage: number): Cents {
  assertCents(cents);
  const scaledPercent = toScaledPercent(percentage);

  const numerator = BigInt(cents) * scaledPercent;
  const denominator = 100n * PERCENT_SCALE;
  return Number((numerator * 2n + denominator) / (denominator * 2n));
}

export function minCents(first: Cents, ...rest: Cents[]): Cents {
  return Math.min(first, ...rest);
}

function assertCents(cents: Cents): void {
  if (!Number.isSafeInteger(cents) || cents < 0) {
    throw new RangeError(`Cents must be a non-negative integer, got ${cents}`);
  }
}

function toScaledPercent(percentage: number): bigint {
  if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
    throw new RangeError(`Percentage must be between 0 and 100, got ${percentage}`);
  }
  const scaled = Math.round(percentage * Number(PERCENT_SCALE));
  if (Math.abs(scaled - percentage * Number(PERCENT_SCALE)) > 1e-6) {
    throw new RangeError(`Percentage has more than 4 decimal places: ${percentage}`);
  }
  return BigInt(scaled);
}
