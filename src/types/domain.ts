export type Cents = number;

export type IsoDate = string;

export interface Advance {
  id: number;
  customerId: number;
  created: IsoDate;
  totalAdvanced: Cents;
  fee: Cents;
  mandateId: number;
  repaymentStartDate: IsoDate;
  repaymentPercentage: number;
}
