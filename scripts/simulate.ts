import { fromCents, remaining, simulate, type DaySummary } from '../src';

function formatDay({ date, newAdvances, charges, pendingRevenues, completed }: DaySummary) {
  const accepted = charges.filter((c) => c.accepted);
  const total = accepted.reduce((sum, c) => sum + c.amount, 0);
  return [
    date,
    `new=${newAdvances.length}`,
    `charged=${accepted.length}/${charges.length} (${fromCents(total)})`,
    `pending=${pendingRevenues.length}`,
    `completed=${completed.length ? completed.join(',') : '-'}`,
  ].join('  ');
}

const { ledger } = await simulate({ onDay: (summary) => console.log(formatDay(summary)) });

console.log();
console.table(
  ledger.list().map((entry) => ({
    advance: entry.advance.id,
    customer: entry.advance.customerId,
    owed: fromCents(entry.owed),
    repaid: fromCents(entry.repaid),
    remaining: fromCents(remaining(entry)),
    due: fromCents(entry.due),
    pending: entry.pendingRevenueDates.length,
    completed: entry.completedOn ?? '-',
  })),
);

const { totals } = ledger.snapshot();
console.log(
  `owed ${fromCents(totals.owed)}  repaid ${fromCents(totals.repaid)}  ` +
    `outstanding ${fromCents(totals.outstanding)}  active ${totals.active}  completed ${totals.completed}`,
);
