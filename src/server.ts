import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { loadConfig } from './config.js';

const config = loadConfig();

const server = serve({ fetch: createApp().fetch, port: config.port }, (info) => {
  console.log(`Billing API listening on http://localhost:${info.port}`);
});

function shutdown() {
  server.close(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
