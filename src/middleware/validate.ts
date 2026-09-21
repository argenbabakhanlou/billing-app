import { zValidator } from '@hono/zod-validator';
import type { ValidationTargets } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { isoDateSchema } from '../lib/schemas.js';

export function validate<Target extends keyof ValidationTargets, Schema extends z.ZodType>(
  target: Target,
  schema: Schema,
) {
  return zValidator(target, schema, (result) => {
    if (!result.success) {
      throw new HTTPException(400, { message: z.prettifyError(result.error) });
    }
  });
}

export const idParamSchema = z.object({ id: z.coerce.number().int().positive() });

export const dateBodySchema = z.object({ date: isoDateSchema });
