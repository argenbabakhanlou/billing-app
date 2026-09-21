import { Hono } from 'hono';
import type { AppEnv } from '../app.js';
import type { AdvancesController } from '../controllers/advances.controller.js';

export function advancesRoutes(controller: AdvancesController) {
  return new Hono<AppEnv>()
    .get('/', ...controller.list)
    .post('/sync', ...controller.sync)
    .get('/:id', ...controller.get);
}
