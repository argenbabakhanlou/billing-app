import type { Cents, IsoDate, RevenueDto } from '../../types';
import { parseAmount } from '../../utils';
import { isUnavailableError, apiRequestJson } from '../http';

export async function fetchRevenue(
  customerId: number,
  forDate: IsoDate,
  today: IsoDate,
): Promise<Cents | null> {
  try {
    const { amount } = await apiRequestJson<RevenueDto>(
      'GET',
      `/customers/${customerId}/revenues/${forDate}`,
      { today },
    );
    return parseAmount(amount);
  } catch (error) {
    if (isUnavailableError(error)) return null;
    throw error;
  }
}
