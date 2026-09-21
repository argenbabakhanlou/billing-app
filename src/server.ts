import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { HttpWayflyerClient } from './clients/wayflyer.client.js';
import { loadConfig } from './config.js';

const config = loadConfig();
const app = createApp({ client: new HttpWayflyerClient(config.billingApiBaseUrl) });

const server = serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`Billing API listening on http://localhost:${info.port}`);
});

function shutdown() {
  server.close(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
