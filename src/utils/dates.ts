import type { IsoDate } from '../types';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;

function toUtcMs(date: IsoDate): number {
  const ms = Date.parse(`${date}T00:00:00Z`);
  if (!DATE_PATTERN.test(date) || Number.isNaN(ms) || toIsoDate(ms) !== date) {
    throw new Error(`Invalid date: "${date}"`);
  }
  return ms;
}

function toIsoDate(ms: number): IsoDate {
  return new Date(ms).toISOString().slice(0, 10);
}

export function shiftDate(date: IsoDate, days: number): IsoDate {
  return toIsoDate(toUtcMs(date) + days * MS_PER_DAY);
}

export function compareIsoDates(a: IsoDate, b: IsoDate): number {
  return Math.sign(toUtcMs(a) - toUtcMs(b));
}

export function eachDay(from: IsoDate, to: IsoDate): IsoDate[] {
  const dates: IsoDate[] = [];
  for (let date = from; compareIsoDates(date, to) <= 0; date = shiftDate(date, 1)) {
    dates.push(date);
  }
  return dates;
}
