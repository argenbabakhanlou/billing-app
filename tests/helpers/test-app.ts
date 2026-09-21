import { createApp } from '../../src/app.js';
import { LedgerStore } from '../../src/store/ledger.store.js';
import { FakeWayflyerClient } from './fake-client.js';

export function createTestApp({
  client = new FakeWayflyerClient(),
  store = new LedgerStore(),
}: { client?: FakeWayflyerClient; store?: LedgerStore } = {}) {
  const app = createApp({ client, store, logRequests: false });
  return { app, client, store };
}
