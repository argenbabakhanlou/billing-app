# Billing App — Service Layer

A TypeScript service layer that does daily billing of Merchant Cash Advances against the Wayflyer billing API (see
[billing.md](billing.md)). It doesn't depend on any UI framework: it runs from the command line today, and a React, Vue or
Svelte app can use it later without changes.

## Setup

Requires Node 20+ (`.nvmrc` pins 22).

```sh
nvm use
npm install
```

The API base URL defaults to the live server. To override it, copy `.env.example` to `.env` or set `VITE_API_BASE_URL`.

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
      billing.ts       runBilling(today) — one day of billing
      simulation.ts    simulate() — loops runBilling over a date range
  testing/             test helpers: fake fetch and fake API
  index.ts             public entry point
scripts/simulate.ts    CLI
```

Tests sit next to the file they cover as `<filename>.spec.ts` (e.g. `utils/money.spec.ts`).

## How billing works

For each simulated day, `runBilling(today, { api, ledger })`:

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
- **State is in memory.** `createLedger()` returns a store whose snapshot is cached until it changes, with
  `subscribe()`, so a UI can bind to it.
- **Dependencies are injected.** `runBilling` and `simulate` take `{ api, ledger }`, so tests use a fake API and a UI
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

````ts
// React
const ledger = createLedger();
const snapshot = useSyncExternalStore(ledger.subscribe, ledger.snapshot);


Run a simulation from a view and show progress:

```ts
await simulate({ deps: { api: billingApi, ledger }, onDay: (day) => days.push(day) });
````

## Known gaps / TODOs

- **No retries for unexpected errors.** Only `530` is treated as retryable. Any other error stops the run, since the
  exercise assumes a reliable environment. If `billing_complete` fails, the next run retries it, because the advance
  is still repaid but not marked complete.
- **No runtime validation of API responses.** Adding a schema check (for example zod) at `services/api` would catch
  unexpected response shapes.
- **Calls are sequential.** Advances are billed one after another. Billing them in parallel per advance would speed up
  large runs.
- **Unneeded revenue calls.** Revenue is still fetched when the amount due already covers the remaining balance.
- **Nothing persists.** Ledger state is lost when the process exits.
- **Percentages must be whole numbers.** `repayment_percentage` is assumed to be an integer, and a fractional value
  throws.
- **Mandates aren't capped together.** The cap is per advance, as the spec states. Two advances sharing a mandate can
  together be charged more than 10,000.00 against that mandate in a day.
