import type { IsoDate } from '../types/api.js';

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;

export function isValidIsoDate(value: string): value is IsoDate {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const ms = toUtcMs(date) + days * MS_PER_DAY;
  return new Date(ms).toISOString().slice(0, 10);
}

export function compareDates(a: IsoDate, b: IsoDate): number {
  return Math.sign(toUtcMs(a) - toUtcMs(b));
}

export function dateRange(start: IsoDate, end: IsoDate): IsoDate[] {
  if (compareDates(start, end) > 0) {
    throw new RangeError(`Start date ${start} is after end date ${end}`);
  }
  const dates: IsoDate[] = [];
  for (let date = start; compareDates(date, end) <= 0; date = addDays(date, 1)) {
    dates.push(date);
  }
  return dates;
}

function toUtcMs(date: IsoDate): number {
  if (!isValidIsoDate(date)) {
    throw new RangeError(`Invalid date: "${date}"`);
  }
  return Date.parse(`${date}T00:00:00Z`);
}
