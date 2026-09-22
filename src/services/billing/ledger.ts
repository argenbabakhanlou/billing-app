import type { Advance, Cents, IsoDate, LedgerEntry, LedgerSnapshot } from '../../types';
import { compareDates } from '../../utils';

export type Ledger = ReturnType<typeof createLedger>;

export function remaining(entry: LedgerEntry): Cents {
  return entry.owed - entry.repaid;
}

function copy(entry: LedgerEntry): LedgerEntry {
  return {
    ...entry,
    advance: { ...entry.advance },
    pendingRevenueDates: [...entry.pendingRevenueDates],
  };
}

export function createLedger() {
  const entries = new Map<number, LedgerEntry>();
  const listeners = new Set<(snapshot: LedgerSnapshot) => void>();
  let cached: LedgerSnapshot | null = null;

  function entryFor(id: number): LedgerEntry {
    const entry = entries.get(id);
    if (!entry) throw new Error(`Unknown advance: ${id}`);
    return entry;
  }

  function changed() {
    cached = null;
    const current = snapshot();
    listeners.forEach((listener) => listener(current));
  }

  function register(advance: Advance): boolean {
    if (entries.has(advance.id)) return false;
    entries.set(advance.id, {
      advance: { ...advance },
      owed: advance.totalAdvanced + advance.fee,
      repaid: 0,
      due: 0,
      pendingRevenueDates: [],
      lastQueuedRevenueDate: null,
      completedOn: null,
    });
    changed();
    return true;
  }

  function queueRevenueDate(id: number, date: IsoDate): boolean {
    const entry = entryFor(id);
    const last = entry.lastQueuedRevenueDate;
    if (last && compareDates(date, last) <= 0) return false;
    entry.pendingRevenueDates.push(date);
    entry.lastQueuedRevenueDate = date;
    changed();
    return true;
  }

  function addDue(id: number, revenueDate: IsoDate, amount: Cents) {
    const entry = entryFor(id);
    const index = entry.pendingRevenueDates.indexOf(revenueDate);
    if (index === -1) throw new Error(`Revenue date ${revenueDate} not pending for advance ${id}`);
    entry.pendingRevenueDates.splice(index, 1);
    entry.due += amount;
    changed();
  }

  function recordCharge(id: number, amount: Cents) {
    const entry = entryFor(id);
    if (amount <= 0 || amount > remaining(entry)) {
      throw new Error(`Invalid charge of ${amount} for advance ${id}`);
    }
    entry.repaid += amount;
    entry.due = Math.max(0, entry.due - amount);
    changed();
  }

  function markComplete(id: number, date: IsoDate) {
    const entry = entryFor(id);
    if (remaining(entry) > 0) throw new Error(`Advance ${id} is not fully repaid`);
    entry.completedOn = date;
    entry.pendingRevenueDates = [];
    entry.due = 0;
    changed();
  }

  function get(id: number): LedgerEntry | undefined {
    const entry = entries.get(id);
    return entry && copy(entry);
  }

  function list(): LedgerEntry[] {
    return [...entries.values()].map(copy);
  }

  function snapshot(): LedgerSnapshot {
    if (cached) return cached;
    const all = list();
    const owed = all.reduce((sum, entry) => sum + entry.owed, 0);
    const repaid = all.reduce((sum, entry) => sum + entry.repaid, 0);
    const completed = all.filter((entry) => entry.completedOn).length;
    cached = {
      entries: all,
      totals: {
        owed,
        repaid,
        outstanding: owed - repaid,
        active: all.length - completed,
        completed,
      },
    };
    return cached;
  }

  function subscribe(listener: (snapshot: LedgerSnapshot) => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return {
    register,
    queueRevenueDate,
    addDue,
    recordCharge,
    markComplete,
    get,
    list,
    snapshot,
    subscribe,
  };
}
