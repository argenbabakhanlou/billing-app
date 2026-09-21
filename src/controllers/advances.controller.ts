import { createFactory } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import type { AppEnv } from '../app.js';
import { dateBodySchema, idParamSchema, validate } from '../middleware/validate.js';
import type { AdvancesService } from '../services/advances.service.js';

const factory = createFactory<AppEnv>();

export function createAdvancesController(service: AdvancesService) {
  return {
    list: factory.createHandlers((c) => c.json({ advances: service.list() })),

    get: factory.createHandlers(validate('param', idParamSchema), (c) => {
      const { id } = c.req.valid('param');
      const advance = service.get(id);
      if (!advance) throw new HTTPException(404, { message: `Advance ${id} not found` });
      return c.json(advance);
    }),

    sync: factory.createHandlers(validate('json', dateBodySchema), async (c) => {
      const { date } = c.req.valid('json');
      const addedAdvanceIds = await service.sync(date);
      return c.json({ date, addedAdvanceIds });
    }),
  };
}

export type AdvancesController = ReturnType<typeof createAdvancesController>;
