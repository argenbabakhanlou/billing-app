import type { Cents, IsoDate, RevenueDto } from '../../types';
import { toCents } from '../../utils';
import { isUnavailable, requestJson } from '../http';

export async function getRevenue(
  customerId: number,
  forDate: IsoDate,
  today: IsoDate,
): Promise<Cents | null> {
  try {
    const { amount } = await requestJson<RevenueDto>(
      'GET',
      `/customers/${customerId}/revenues/${forDate}`,
      { today },
    );
    return toCents(amount);
  } catch (error) {
    if (isUnavailable(error)) return null;
    throw error;
  }
}
