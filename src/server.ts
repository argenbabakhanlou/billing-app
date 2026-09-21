import { serve } from '@hono/node-server';
import { createApp } from './app.js';

// TODO(phase 1): read the port from config.ts
const port = Number(process.env.PORT ?? 3000);

const server = serve({ fetch: createApp().fetch, port }, (info) => {
  console.log(`Billing API listening on http://localhost:${info.port}`);
});

function shutdown() {
  server.close(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
