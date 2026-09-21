import type { Context, ErrorHandler, NotFoundHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { ConflictError } from '../lib/errors.js';
import type { ErrorResponse } from '../types/api.js';

const STATUS_CODES: Record<number, string> = {
  400: 'BAD_REQUEST',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  500: 'INTERNAL_ERROR',
  502: 'BAD_GATEWAY',
};

function errorBody(c: Context, status: number, message: string): ErrorResponse {
  return {
    error: {
      message,
      code: STATUS_CODES[status] ?? 'ERROR',
      requestId: c.get('requestId'),
    },
  };
}

export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof HTTPException) {
    const status = err.status as ContentfulStatusCode;
    return c.json(errorBody(c, status, err.message), status);
  }

  if (err instanceof ConflictError) {
    return c.json(errorBody(c, 409, err.message), 409);
  }

  console.error(`[${c.get('requestId')}]`, err);
  return c.json(errorBody(c, 500, 'Internal server error'), 500);
};

export const notFoundHandler: NotFoundHandler = (c) =>
  c.json(errorBody(c, 404, `Route not found: ${c.req.method} ${c.req.path}`), 404);
