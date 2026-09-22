import { fetchAdvances, markBillingComplete } from './advances';
import { chargeMandate } from './mandates';
import { fetchRevenue } from './revenues';

export { chargeMandate, fetchAdvances, fetchRevenue, markBillingComplete };
export { mapAdvanceDto } from './advances';

export const billingApi = { fetchAdvances, fetchRevenue, chargeMandate, markBillingComplete };

export type BillingApi = typeof billingApi;
