import { cors } from 'hono/cors';

// Add allowed frontend origins here, e.g. 'http://localhost:5173'.
// With an empty list no CORS headers are sent, so cross-origin browser requests are blocked.
const ALLOWED_ORIGINS: string[] = [];

export const corsMiddleware = cors({
  origin: ALLOWED_ORIGINS,
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
});
