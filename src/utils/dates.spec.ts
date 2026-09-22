import { shiftDate, compareIsoDates, eachDay } from './dates';

describe('shiftDate', () => {
  it('adds and subtracts days', () => {
    expect(shiftDate('2022-01-01', 1)).toBe('2022-01-02');
    expect(shiftDate('2022-01-01', -1)).toBe('2021-12-31');
  });

  it('crosses month and leap-year boundaries', () => {
    expect(shiftDate('2022-01-31', 1)).toBe('2022-02-01');
    expect(shiftDate('2024-02-28', 1)).toBe('2024-02-29');
    expect(shiftDate('2022-02-28', 1)).toBe('2022-03-01');
  });

  it.each(['2022-1-1', '2022-02-30', 'not-a-date', ''])('rejects %j', (date) => {
    expect(() => shiftDate(date, 1)).toThrow();
  });
});

describe('compareIsoDates', () => {
  it('orders dates', () => {
    expect(compareIsoDates('2022-01-01', '2022-01-02')).toBe(-1);
    expect(compareIsoDates('2022-01-02', '2022-01-01')).toBe(1);
    expect(compareIsoDates('2022-01-01', '2022-01-01')).toBe(0);
  });
});

describe('eachDay', () => {
  it('is inclusive of both ends', () => {
    expect(eachDay('2022-01-30', '2022-02-01')).toEqual(['2022-01-30', '2022-01-31', '2022-02-01']);
  });

  it('returns a single day when from equals to', () => {
    expect(eachDay('2022-01-01', '2022-01-01')).toEqual(['2022-01-01']);
  });

  it('returns nothing when from is after to', () => {
    expect(eachDay('2022-01-02', '2022-01-01')).toEqual([]);
  });

  it('covers the full simulated period', () => {
    expect(eachDay('2022-01-01', '2022-02-01')).toHaveLength(32);
  });
});
