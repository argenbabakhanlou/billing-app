import { fromCents, percentOf, toCents } from './money';

describe('toCents', () => {
  it.each([
    ['12345.67', 1234567],
    ['0.00', 0],
    ['0.05', 5],
    ['1.5', 150],
    ['10', 1000],
    ['60000.00', 6000000],
  ])('parses %s', (amount, cents) => {
    expect(toCents(amount)).toBe(cents);
  });

  it.each(['', 'abc', '-1.00', '1.234', '1,000.00', '.50'])('rejects %j', (amount) => {
    expect(() => toCents(amount)).toThrow();
  });
});

describe('fromCents', () => {
  it.each([
    [1234567, '12345.67'],
    [0, '0.00'],
    [5, '0.05'],
    [1000000, '10000.00'],
  ])('formats %d', (cents, amount) => {
    expect(fromCents(cents)).toBe(amount);
  });

  it.each([-1, 1.5, NaN])('rejects %d', (cents) => {
    expect(() => fromCents(cents)).toThrow();
  });

  it('round-trips', () => {
    expect(fromCents(toCents('98765.43'))).toBe('98765.43');
  });
});

describe('percentOf', () => {
  it('computes an exact percentage', () => {
    expect(percentOf(100000, 11)).toBe(11000);
  });

  it('rounds half up', () => {
    expect(percentOf(50, 1)).toBe(1);
    expect(percentOf(49, 1)).toBe(0);
    expect(percentOf(123456, 11)).toBe(13580);
  });

  it('handles zero revenue', () => {
    expect(percentOf(0, 11)).toBe(0);
  });

  it('rejects non-integer percentages', () => {
    expect(() => percentOf(100, 1.5)).toThrow();
  });
});
