import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { requestId, type RequestIdVariables } from 'hono/request-id';
import type { WayflyerClient } from './clients/wayflyer.client.js';
import { createAdvancesController } from './controllers/advances.controller.js';
import { corsMiddleware } from './middleware/cors.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { advancesRoutes } from './routes/advances.routes.js';
import { healthRoutes } from './routes/health.routes.js';
import { AdvancesService } from './services/advances.service.js';
import { LedgerStore } from './store/ledger.store.js';

export interface AppOptions {
  client: WayflyerClient;
  store?: LedgerStore;
  logRequests?: boolean;
}

export type AppEnv = { Variables: RequestIdVariables };

export function createApp({ client, store = new LedgerStore(), logRequests = true }: AppOptions) {
  const advancesService = new AdvancesService(client, store);

  const app = new Hono<AppEnv>();

  app.use(requestId());
  if (logRequests) app.use(logger());
  app.use(corsMiddleware);

  app.route('/health', healthRoutes);
  app.route('/advances', advancesRoutes(createAdvancesController(advancesService)));

  app.notFound(notFoundHandler);
  app.onError(errorHandler);

  return app;
}
