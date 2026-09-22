import { formatAmount, applyPercentage, parseAmount } from './money';

describe('parseAmount', () => {
  it.each([
    ['12345.67', 1234567],
    ['0.00', 0],
    ['0.05', 5],
    ['1.5', 150],
    ['10', 1000],
    ['60000.00', 6000000],
  ])('parses %s', (amount, cents) => {
    expect(parseAmount(amount)).toBe(cents);
  });

  it.each(['', 'abc', '-1.00', '1.234', '1,000.00', '.50'])('rejects %j', (amount) => {
    expect(() => parseAmount(amount)).toThrow();
  });
});

describe('formatAmount', () => {
  it.each([
    [1234567, '12345.67'],
    [0, '0.00'],
    [5, '0.05'],
    [1000000, '10000.00'],
  ])('formats %d', (cents, amount) => {
    expect(formatAmount(cents)).toBe(amount);
  });

  it.each([-1, 1.5, NaN])('rejects %d', (cents) => {
    expect(() => formatAmount(cents)).toThrow();
  });

  it('round-trips', () => {
    expect(formatAmount(parseAmount('98765.43'))).toBe('98765.43');
  });
});

describe('applyPercentage', () => {
  it('computes an exact percentage', () => {
    expect(applyPercentage(100000, 11)).toBe(11000);
  });

  it('rounds half up', () => {
    expect(applyPercentage(50, 1)).toBe(1);
    expect(applyPercentage(49, 1)).toBe(0);
    expect(applyPercentage(123456, 11)).toBe(13580);
  });

  it('handles zero revenue', () => {
    expect(applyPercentage(0, 11)).toBe(0);
  });

  it('rejects non-integer percentages', () => {
    expect(() => applyPercentage(100, 1.5)).toThrow();
  });
});
