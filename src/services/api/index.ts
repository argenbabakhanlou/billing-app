import { markBillingComplete, fetchAdvances } from './advances';
import { chargeMandate } from './mandates';
import { fetchRevenue } from './revenues';

export { chargeMandate, markBillingComplete, fetchAdvances, fetchRevenue };
export { mapAdvanceDto } from './advances';

export const billingApi = { fetchAdvances, fetchRevenue, chargeMandate, markBillingComplete };

export type BillingApi = typeof billingApi;
