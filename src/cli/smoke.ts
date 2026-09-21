import { HttpWayflyerClient } from '../clients/wayflyer.client.js';
import { loadConfig } from '../config.js';
import { addDays, isValidIsoDate } from '../lib/dates.js';

const today = process.argv[2] ?? '2022-01-10';
if (!isValidIsoDate(today)) {
  console.error(`Usage: npm run smoke -- [yyyy-mm-dd]  (got "${today}")`);
  process.exit(1);
}

const client = new HttpWayflyerClient(loadConfig().billingApiBaseUrl);
const yesterday = addDays(today, -1);

const advances = await client.getAdvances(today);
console.log(`${advances.length} advance(s) on ${today}`);

for (const advance of advances) {
  const revenue = await client.getRevenue(today, advance.customer_id, yesterday);
  console.log(
    `advance ${advance.id} (customer ${advance.customer_id}) revenue for ${yesterday}:`,
    revenue,
  );
}
