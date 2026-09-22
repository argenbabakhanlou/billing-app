export interface AdvanceDto {
  id: number;
  customer_id: number;
  created: string;
  total_advanced: string;
  fee: string;
  mandate_id: number;
  repayment_start_date: string;
  repayment_percentage: number;
}

export interface AdvancesResponse {
  advances: AdvanceDto[];
}

export interface RevenueDto {
  amount: string;
}

export interface ChargeRequest {
  amount: string;
}
