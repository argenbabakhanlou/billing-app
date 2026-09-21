import { Hono } from 'hono';
import type { AppEnv } from '../app.js';
import type { BillingController } from '../controllers/billing.controller.js';

export function billingRoutes(controller: BillingController) {
  return new Hono<AppEnv>().post('/run', ...controller.run);
}
