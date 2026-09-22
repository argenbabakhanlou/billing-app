import { completeBilling, getAdvances } from './advances';
import { charge } from './mandates';
import { getRevenue } from './revenues';

export { charge, completeBilling, getAdvances, getRevenue };
export { toAdvance } from './advances';

export const billingApi = { getAdvances, getRevenue, charge, completeBilling };

export type BillingApi = typeof billingApi;
