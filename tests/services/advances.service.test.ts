import { beforeEach, describe, expect, it } from 'vitest';
import { AdvancesService } from '../../src/services/advances.service.js';
import { LedgerStore } from '../../src/store/ledger.store.js';
import { FakeWayflyerClient, makeAdvance } from '../helpers/fake-client.js';

describe('AdvancesService', () => {
  let client: FakeWayflyerClient;
  let store: LedgerStore;
  let service: AdvancesService;

  beforeEach(() => {
    client = new FakeWayflyerClient()
      .addAdvance(makeAdvance({ id: 1, created: '2022-01-02' }))
      .addAdvance(makeAdvance({ id: 2, created: '2022-01-07' }));
    store = new LedgerStore();
    service = new AdvancesService(client, store);
  });

  describe('sync', () => {
    it('adds advances visible on the given day', async () => {
      expect(await service.sync('2022-01-03')).toEqual([1]);
      expect(store.all().map((l) => l.advance.id)).toEqual([1]);
      expect(store.lastSyncedOn).toBe('2022-01-03');
    });

    it('picks up advances created on later days', async () => {
      await service.sync('2022-01-03');

      expect(await service.sync('2022-01-07')).toEqual([2]);
      expect(store.all().map((l) => l.advance.id)).toEqual([1, 2]);
    });

    it('is idempotent and never overwrites existing ledgers', async () => {
      await service.sync('2022-01-07');
      const ledger = store.get(1)!;
      ledger.repaidCents = 12_345;

      expect(await service.sync('2022-01-08')).toEqual([]);
      expect(store.get(1)).toBe(ledger);
      expect(store.get(1)!.repaidCents).toBe(12_345);
    });
  });

  describe('list and get', () => {
    it('returns money as strings and derives status from the last sync date', async () => {
      await service.sync('2022-01-07');
      store.get(1)!.repaidCents = 250_050;

      expect(service.list()).toEqual([
        {
          id: 1,
          customerId: 1,
          mandateId: 2,
          totalOwed: '62500.00',
          repaid: '2500.50',
          outstanding: '59999.50',
          status: 'repaying',
        },
        {
          id: 2,
          customerId: 1,
          mandateId: 2,
          totalOwed: '62500.00',
          repaid: '0.00',
          outstanding: '62500.00',
          status: 'repaying',
        },
      ]);
    });

    it('marks advances before their start date as pending', async () => {
      await service.sync('2022-01-03');

      expect(service.list()[0]!.status).toBe('pending');
    });

    it('includes completedOn only for completed advances', async () => {
      await service.sync('2022-01-07');
      store.get(1)!.completedOn = '2022-01-20';

      const [first, second] = service.list();
      expect(first).toMatchObject({ status: 'completed', completedOn: '2022-01-20' });
      expect(second).not.toHaveProperty('completedOn');
    });

    it('returns detail with charge history', async () => {
      await service.sync('2022-01-07');
      store
        .get(1)!
        .charges.push(
          { date: '2022-01-05', amountCents: 551_076, status: 'succeeded' },
          { date: '2022-01-06', amountCents: 100, status: 'rejected' },
        );

      expect(service.get(1)).toMatchObject({
        id: 1,
        repaymentStartDate: '2022-01-05',
        repaymentPercentage: 60,
        charges: [
          { date: '2022-01-05', amount: '5510.76', status: 'succeeded' },
          { date: '2022-01-06', amount: '1.00', status: 'rejected' },
        ],
      });
    });

    it('returns undefined for an unknown advance', () => {
      expect(service.get(999)).toBeUndefined();
    });
  });
});
