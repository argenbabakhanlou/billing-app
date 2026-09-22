import { addDays, compareDates, dateRange } from '../../src/utils/dates';

describe('addDays', () => {
  it('adds and subtracts days', () => {
    expect(addDays('2022-01-01', 1)).toBe('2022-01-02');
    expect(addDays('2022-01-01', -1)).toBe('2021-12-31');
  });

  it('crosses month and leap-year boundaries', () => {
    expect(addDays('2022-01-31', 1)).toBe('2022-02-01');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2022-02-28', 1)).toBe('2022-03-01');
  });

  it.each(['2022-1-1', '2022-02-30', 'not-a-date', ''])('rejects %j', (date) => {
    expect(() => addDays(date, 1)).toThrow();
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
  it('is inclusive of both ends', () => {
    expect(dateRange('2022-01-30', '2022-02-01')).toEqual([
      '2022-01-30',
      '2022-01-31',
      '2022-02-01',
    ]);
  });

  it('returns a single day when from equals to', () => {
    expect(dateRange('2022-01-01', '2022-01-01')).toEqual(['2022-01-01']);
  });

  it('returns nothing when from is after to', () => {
    expect(dateRange('2022-01-02', '2022-01-01')).toEqual([]);
  });

  it('covers the full simulated period', () => {
    expect(dateRange('2022-01-01', '2022-02-01')).toHaveLength(32);
  });
});
