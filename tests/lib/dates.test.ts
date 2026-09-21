import { describe, expect, it } from 'vitest';
import { addDays, compareDates, dateRange, isValidIsoDate } from '../../src/lib/dates.js';

describe('isValidIsoDate', () => {
  it.each(['2022-01-01', '2022-02-28', '2024-02-29', '2022-12-31'])('accepts %s', (value) => {
    expect(isValidIsoDate(value)).toBe(true);
  });

  it.each([
    '2022-02-30',
    '2023-02-29',
    '2022-13-01',
    '2022-1-1',
    '22-01-01',
    '2022-01-01T00:00',
    '',
  ])('rejects %j', (value) => {
    expect(isValidIsoDate(value)).toBe(false);
  });
});

describe('addDays', () => {
  it('moves forwards and backwards', () => {
    expect(addDays('2022-01-07', 1)).toBe('2022-01-08');
    expect(addDays('2022-01-07', -1)).toBe('2022-01-06');
    expect(addDays('2022-01-07', 0)).toBe('2022-01-07');
  });

  it('crosses month and year boundaries', () => {
    expect(addDays('2022-01-31', 1)).toBe('2022-02-01');
    expect(addDays('2022-03-01', -1)).toBe('2022-02-28');
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29');
    expect(addDays('2021-12-31', 1)).toBe('2022-01-01');
    expect(addDays('2022-01-01', -1)).toBe('2021-12-31');
  });

  it('rejects invalid dates', () => {
    expect(() => addDays('2022-02-30', 1)).toThrow(RangeError);
  });
});

describe('compareDates', () => {
  it('orders dates', () => {
    expect(compareDates('2022-01-01', '2022-01-02')).toBe(-1);
    expect(compareDates('2022-01-02', '2022-01-01')).toBe(1);
    expect(compareDates('2022-01-01', '2022-01-01')).toBe(0);
  });
});

describe('dateRange', () => {
  it('includes both ends', () => {
    expect(dateRange('2022-01-30', '2022-02-02')).toEqual([
      '2022-01-30',
      '2022-01-31',
      '2022-02-01',
      '2022-02-02',
    ]);
  });

  it('returns a single day when start equals end', () => {
    expect(dateRange('2022-01-01', '2022-01-01')).toEqual(['2022-01-01']);
  });

  it('covers the full simulation period', () => {
    const range = dateRange('2022-01-01', '2022-02-01');
    expect(range).toHaveLength(32);
    expect(range.at(0)).toBe('2022-01-01');
    expect(range.at(-1)).toBe('2022-02-01');
  });

  it('rejects a start after the end', () => {
    expect(() => dateRange('2022-02-01', '2022-01-01')).toThrow(RangeError);
  });
});
