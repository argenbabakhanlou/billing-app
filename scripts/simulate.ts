import { formatAmount, remainingBalance, runSimulation, type DaySummary } from '../src';

function formatDay({ date, newAdvances, charges, pendingRevenues, completed }: DaySummary) {
  const accepted = charges.filter((c) => c.accepted);
  const total = accepted.reduce((sum, c) => sum + c.amount, 0);
  return [
    date,
    `new=${newAdvances.length}`,
    `charged=${accepted.length}/${charges.length} (${formatAmount(total)})`,
    `pending=${pendingRevenues.length}`,
    `completed=${completed.length ? completed.join(',') : '-'}`,
  ].join('  ');
}

const { ledger } = await runSimulation({ onDay: (summary) => console.log(formatDay(summary)) });

console.log();
console.table(
  ledger.list().map((entry) => ({
    advance: entry.advance.id,
    customer: entry.advance.customerId,
    owed: formatAmount(entry.owed),
    repaid: formatAmount(entry.repaid),
    remaining: formatAmount(remainingBalance(entry)),
    due: formatAmount(entry.due),
    pending: entry.pendingRevenueDates.length,
    completed: entry.completedOn ?? '-',
  })),
);

const { totals } = ledger.snapshot();
console.log(
  `owed ${formatAmount(totals.owed)}  repaid ${formatAmount(totals.repaid)}  ` +
    `outstanding ${formatAmount(totals.outstanding)}  active ${totals.active}  completed ${totals.completed}`,
);
