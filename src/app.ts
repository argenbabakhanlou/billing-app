import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { requestId, type RequestIdVariables } from 'hono/request-id';
import { corsMiddleware } from './middleware/cors.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { healthRoutes } from './routes/health.routes.js';

export interface AppOptions {
  logRequests?: boolean;
}

export type AppEnv = { Variables: RequestIdVariables };

export function createApp({ logRequests = true }: AppOptions = {}) {
  const app = new Hono<AppEnv>();

  app.use(requestId());
  if (logRequests) app.use(logger());
  app.use(corsMiddleware);

  app.route('/health', healthRoutes);

  app.notFound(notFoundHandler);
  app.onError(errorHandler);

  return app;
}
