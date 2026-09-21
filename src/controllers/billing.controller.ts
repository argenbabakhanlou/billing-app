import { createFactory } from 'hono/factory';
import type { AppEnv } from '../app.js';
import { dateBodySchema, validate } from '../middleware/validate.js';
import type { BillingService } from '../services/billing.service.js';

const factory = createFactory<AppEnv>();

export function createBillingController(service: BillingService) {
  return {
    run: factory.createHandlers(validate('json', dateBodySchema), async (c) => {
      const { date } = c.req.valid('json');
      return c.json(await service.runBillingForDay(date));
    }),
  };
}

export type BillingController = ReturnType<typeof createBillingController>;
