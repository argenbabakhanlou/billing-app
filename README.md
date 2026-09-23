# Billing App — Service Layer

A TypeScript service layer that does daily billing of Merchant Cash Advances against the Wayflyer billing API (see
[billing.md](billing.md)). It doesn't depend on any UI framework: it runs from the command line today, and a React, Vue or
Svelte app can use it later without changes.

## Setup

Requires Node 20+ (`.nvmrc` pins 22).

```sh
nvm use
npm install
cp .env.example .env
```

`VITE_API_BASE_URL` in `.env` is required. `npm run simulate` fails if `.env` is missing or doesn't set it. Tests
don't need it; Vitest sets its own value.

## Scripts

| Command             | What it does                                                       |
| ------------------- | ------------------------------------------------------------------ |
| `npm run simulate`  | Bills every day from 2022-01-01 to 2022-02-01 against the live API |
| `npm test`          | Runs the Vitest suite                                              |
| `npm run typecheck` | Runs `tsc --noEmit`                                                |
| `npm run lint`      | Runs ESLint                                                        |
| `npm run format`    | Runs Prettier                                                      |

`npm run simulate` prints one line per day (new advances, charges accepted/attempted, revenue still pending,
completions), then a table per advance and the overall totals.

## Structure

```
src/
  config/              base URL, simulation dates, daily charge cap
  types/               API DTOs, domain types, ledger and day-summary types
  utils/               money (integer cents) and date helpers
  services/
    http.ts            fetch wrapper: Today header, JSON body, ApiError
    api/               one function per endpoint, plus a `billingApi` bundle
    billing/
      ledger.ts        in-memory state per advance, with subscribe()
      billing.ts       runDailyBilling(today) — one day of billing
      simulation.ts    runSimulation() — loops runDailyBilling over a date range
  testing/             test helpers: fake fetch and test API
  index.ts             public entry point
scripts/simulate.ts    CLI
```

Tests sit next to the file they cover as `<filename>.spec.ts` (e.g. `utils/money.spec.ts`).

## How billing works

For each simulated day, `runDailyBilling(today, { api, ledger })`:

1. Fetches advances and registers any it hasn't seen. Each one owes `total_advanced + fee`.
2. For each advance that isn't complete and has reached its `repayment_start_date`:
   1. Queues every revenue date from the day before the start date up to yesterday that isn't queued yet.
   2. Fetches revenue for every pending date. A `530` leaves that date pending for tomorrow. Revenue that comes back
      adds `revenue × repayment_percentage / 100` to the amount due.
   3. Charges `min(due, remaining, 10000.00)` against the mandate. A `530` leaves the amount due for tomorrow.
   4. When nothing remains, calls `billing_complete` once and stops processing that advance.
3. Returns a `DaySummary` of what happened.

### Design decisions

- **Money is integer cents.** Amounts are converted only at the API edge, so floating-point error never enters the
  calculation. Percentages round half-up to the cent.
- **Revenue for day D is billed from D + 1.** The first charge, on `repayment_start_date`, uses the previous day's
  revenue.
- **Late revenue is tracked per date.** Each advance keeps its list of pending revenue dates, so a late day is billed
  exactly once, as soon as it's available.
- **The 10,000.00 cap applies per advance, per day.** Each advance gets at most one charge a day, so the cap is simple
  to enforce. Anything above the cap carries forward.
- **State is in memory.** `createBillingLedger()` returns a store whose snapshot is cached until it changes, with
  `subscribe()`, so a UI can bind to it.
- **Dependencies are injected.** `runDailyBilling` and `runSimulation` take `{ api, ledger }`, so tests use a test API and a UI
  could use a proxied one.
- **Responses are read as text.** The API returns `text/html` for everything and charges return plain `Accepted`, so
  the HTTP layer parses JSON only where an endpoint returns it.

## Wiring into a framework

Once a framework is chosen, install it (with Vite), then add `src/components/` and `src/views/` next to the existing
folders. Import everything from `src/index.ts`.

The live API sends no CORS headers, so the browser needs a dev proxy. With Vite:

```ts
// vite.config.ts
server: {
  proxy: {
    '/api': {
      target: 'https://billing.eng-test.wayflyer.com/v2',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api/, ''),
    },
  },
},
```

```sh
# .env
VITE_API_BASE_URL=/api
```

Binding the ledger:

```ts
// React
const ledger = createBillingLedger();
const snapshot = useSyncExternalStore(ledger.subscribe, ledger.snapshot);
```

Run a simulation from a view and show progress:

```ts
await runSimulation({ deps: { api: billingApi, ledger }, onDay: (day) => days.push(day) });
```

## Known gaps / TODOs

1. **No retries for unexpected errors.** Only `530` is retried. Any other failure aborts the whole run, since the
   exercise assumes a reliable environment.
   _Fix:_ wrap `apiRequest` in a retry with exponential backoff for 5xx and network errors, capped at a few attempts.
2. **A failed day stops the simulation.** One bad response ends the loop, so later days are never billed.
   _Fix:_ catch per advance inside `runDailyBilling`, record the failure on the `DaySummary`, and carry on. Unbilled
   revenue and due amounts already roll forward on their own.
3. **No runtime validation of API responses.** A changed or malformed payload surfaces as a confusing error deep in
   the billing logic.
   _Fix:_ parse responses with a schema (for example zod) in `services/api` and fail with a clear message at the edge.
4. **Calls are sequential.** Advances are billed one after another, so a long period is slower than it needs to be.
   _Fix:_ bill advances concurrently with `Promise.all`, since each advance has its own state; keep the per-advance
   steps in order.
5. **Unneeded revenue calls.** Revenue is still fetched when the amount already due covers the remaining balance.
   _Fix:_ skip `fetchRevenue` when `due >= remainingBalance(entry)`, and resume if a charge is later rejected.
6. **Nothing persists.** Ledger state is lost when the process exits, so an interrupted run restarts from scratch.
   _Fix:_ add a storage interface behind the ledger (JSON file, SQLite or a real database) and reload it on startup.
7. **Percentages must be whole numbers.** `applyPercentage` throws on a fractional `repayment_percentage`.
   _Fix:_ scale the percentage to basis points before dividing, keeping the arithmetic in integers.
8. **Mandates aren't capped together.** The cap is per advance, as the spec states, so two advances sharing a mandate
   can together exceed 10,000.00 against it in a day.
   _Fix:_ if that is ever required, track charges per mandate per day in the ledger and cap against that total.
9. **A simulation can't be cancelled.** `runSimulation` runs to the end, which a UI would need to interrupt.
   _Fix:_ accept an `AbortSignal` and check it between days.
10. **No structured output.** The CLI prints for humans only, so runs can't be diffed or checked automatically.
    _Fix:_ add a `--json` flag that writes the day summaries and final ledger as JSON.
