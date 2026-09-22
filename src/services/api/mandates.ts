import type { Cents, ChargeRequest, IsoDate } from '../../types';
import { formatAmount } from '../../utils';
import { isUnavailableError, apiRequest } from '../http';

export async function chargeMandate(
  mandateId: number,
  amount: Cents,
  today: IsoDate,
): Promise<boolean> {
  const body: ChargeRequest = { amount: formatAmount(amount) };
  try {
    await apiRequest('POST', `/mandates/${mandateId}/charge`, { today, body });
    return true;
  } catch (error) {
    if (isUnavailableError(error)) return false;
    throw error;
  }
}
