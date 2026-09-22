import type { Cents, ChargeRequest, IsoDate } from '../../types';
import { fromCents } from '../../utils';
import { isUnavailable, request } from '../http';

export async function charge(mandateId: number, amount: Cents, today: IsoDate): Promise<boolean> {
  const body: ChargeRequest = { amount: fromCents(amount) };
  try {
    await request('POST', `/mandates/${mandateId}/charge`, { today, body });
    return true;
  } catch (error) {
    if (isUnavailable(error)) return false;
    throw error;
  }
}
