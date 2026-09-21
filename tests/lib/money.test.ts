import { describe, expect, it } from 'vitest';
import { fromCents, minCents, percentOf, toCents } from '../../src/lib/money.js';

describe('toCents', () => {
  it.each([
    ['0.00', 0],
    ['0.05', 5],
    ['1.00', 100],
    ['12345.67', 1234567],
    ['60000.00', 6000000],
  ])('parses %s as %i', (input, expected) => {
    expect(toCents(input)).toBe(expected);
  });

  it.each(['1', '1.0', '1.000', '-1.00', '1,000.00', 'abc', '', ' 1.00', '.50'])(
    'rejects %j',
    (input) => {
      expect(() => toCents(input)).toThrow(RangeError);
    },
  );

  it('rejects amounts beyond safe integer range', () => {
    expect(() => toCents('999999999999999999.00')).toThrow(/too large/);
  });
});

describe('fromCents', () => {
  it.each([
    [0, '0.00'],
    [5, '0.05'],
    [100, '1.00'],
    [1234567, '12345.67'],
  ])('formats %i as %s', (input, expected) => {
    expect(fromCents(input)).toBe(expected);
  });

  it.each([-1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1])('rejects %d', (input) => {
    expect(() => fromCents(input)).toThrow(RangeError);
  });

  it('round-trips with toCents', () => {
    for (const amount of ['0.01', '9.99', '10000.00', '123456789.12']) {
      expect(fromCents(toCents(amount))).toBe(amount);
    }
  });
});

describe('percentOf', () => {
  it('takes an integer percentage of an amount', () => {
    expect(percentOf(toCents('1000.00'), 11)).toBe(toCents('110.00'));
  });

  it('rounds half up to the nearest cent', () => {
    expect(percentOf(5, 10)).toBe(1); // 0.5 cents → 1
    expect(percentOf(4, 10)).toBe(0); // 0.4 cents → 0
    expect(percentOf(toCents('1234.55'), 10)).toBe(12346); // 123.455 → 123.46
    expect(percentOf(toCents('1234.54'), 10)).toBe(12345); // 123.454 → 123.45
  });

  it('supports fractional percentages', () => {
    expect(percentOf(toCents('1000.00'), 12.5)).toBe(toCents('125.00'));
    expect(percentOf(toCents('100.00'), 0.0001)).toBe(0);
  });

  it('handles 0% and 100%', () => {
    expect(percentOf(toCents('999.99'), 0)).toBe(0);
    expect(percentOf(toCents('999.99'), 100)).toBe(toCents('999.99'));
  });

  it('stays exact for large amounts', () => {
    expect(percentOf(toCents('90071992547409.91'), 100)).toBe(toCents('90071992547409.91'));
  });

  it.each([-1, 101, Number.NaN, Number.POSITIVE_INFINITY, 1.00001])(
    'rejects percentage %d',
    (pct) => {
      expect(() => percentOf(100, pct)).toThrow(RangeError);
    },
  );
});

describe('minCents', () => {
  it('returns the smallest value', () => {
    expect(minCents(500, 1_000_000, 250)).toBe(250);
    expect(minCents(42)).toBe(42);
  });
});
