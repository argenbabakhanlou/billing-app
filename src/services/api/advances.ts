import type { Advance, AdvanceDto, AdvancesResponse, IsoDate } from '../../types';
import { parseAmount } from '../../utils';
import { apiRequest, apiRequestJson } from '../http';

export function mapAdvanceDto(dto: AdvanceDto): Advance {
  return {
    id: dto.id,
    customerId: dto.customer_id,
    created: dto.created,
    totalAdvanced: parseAmount(dto.total_advanced),
    fee: parseAmount(dto.fee),
    mandateId: dto.mandate_id,
    repaymentStartDate: dto.repayment_start_date,
    repaymentPercentage: dto.repayment_percentage,
  };
}

export async function fetchAdvances(today: IsoDate): Promise<Advance[]> {
  const { advances } = await apiRequestJson<AdvancesResponse>('GET', '/advances', { today });
  return advances.map(mapAdvanceDto);
}

export async function markBillingComplete(advanceId: number, today: IsoDate): Promise<void> {
  await apiRequest('POST', `/advances/${advanceId}/billing_complete`, { today, body: {} });
}
