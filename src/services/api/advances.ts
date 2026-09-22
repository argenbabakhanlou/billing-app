import type { Advance, AdvanceDto, AdvancesResponse, IsoDate } from '../../types';
import { toCents } from '../../utils';
import { request, requestJson } from '../http';

export function toAdvance(dto: AdvanceDto): Advance {
  return {
    id: dto.id,
    customerId: dto.customer_id,
    created: dto.created,
    totalAdvanced: toCents(dto.total_advanced),
    fee: toCents(dto.fee),
    mandateId: dto.mandate_id,
    repaymentStartDate: dto.repayment_start_date,
    repaymentPercentage: dto.repayment_percentage,
  };
}

export async function getAdvances(today: IsoDate): Promise<Advance[]> {
  const { advances } = await requestJson<AdvancesResponse>('GET', '/advances', { today });
  return advances.map(toAdvance);
}

export async function completeBilling(advanceId: number, today: IsoDate): Promise<void> {
  await request('POST', `/advances/${advanceId}/billing_complete`, { today, body: {} });
}
