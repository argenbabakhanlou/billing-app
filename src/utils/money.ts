import type { Cents } from '../types';

const AMOUNT_PATTERN = /^(\d+)(?:\.(\d{1,2}))?$/;

export function toCents(amount: string): Cents {
  const match = AMOUNT_PATTERN.exec(amount);
  if (!match) throw new Error(`Invalid amount: "${amount}"`);
  const [, whole = '0', fraction = ''] = match;
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

export function fromCents(cents: Cents): string {
  if (!Number.isSafeInteger(cents) || cents < 0) throw new Error(`Invalid cents: ${cents}`);
  const whole = Math.floor(cents / 100);
  const fraction = String(cents % 100).padStart(2, '0');
  return `${whole}.${fraction}`;
}

export function percentOf(cents: Cents, percentage: number): Cents {
  if (!Number.isInteger(percentage)) throw new Error(`Invalid percentage: ${percentage}`);
  return Math.floor((cents * percentage + 50) / 100);
}
