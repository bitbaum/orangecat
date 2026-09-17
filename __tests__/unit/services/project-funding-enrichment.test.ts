/**
 * Settled-funding enrichment — the honest numbers for project list surfaces.
 *
 * Guards the core money-honesty invariants:
 *  - raised_amount comes from the settled ledger (batch RPC), NOT the dead
 *    raised_amount column;
 *  - conversion into the project's own currency (BTC projects pass through);
 *  - entities absent from the RPC result (private / unfunded) get zeros;
 *  - failures degrade to zeros, never to fabricated numbers, never throw.
 */

import { enrichProjectsWithSettledFunding } from '@/services/wallets/project-funding';
import type { AnySupabaseClient } from '@/lib/supabase/types';

vi.mock('@/services/currency', () => ({
  currencyConverter: { getRates: vi.fn().mockResolvedValue({}) },
  convertBtcTo: (amountBtc: number, currency: string) =>
    currency === 'BTC' ? amountBtc : amountBtc * 100_000,
}));

function clientWithRpc(rows: unknown, error: unknown = null): AnySupabaseClient {
  return {
    rpc: vi.fn().mockResolvedValue({ data: rows, error }),
  } as unknown as AnySupabaseClient;
}

describe('enrichProjectsWithSettledFunding', () => {
  it('returns [] for an empty list without calling the RPC', async () => {
    const client = clientWithRpc([]);
    await expect(enrichProjectsWithSettledFunding(client, [])).resolves.toEqual([]);
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it('attaches settled totals in BTC + project currency + supporter count', async () => {
    const client = clientWithRpc([
      { entity_id: 'btc-project', total_btc: 0.5, contributor_count: 3, named_supporter_count: 2 },
      {
        entity_id: 'chf-project',
        total_btc: 0.001,
        contributor_count: 1,
        named_supporter_count: 1,
      },
    ]);

    const result = await enrichProjectsWithSettledFunding(client, [
      { id: 'btc-project', currency: 'BTC' },
      { id: 'chf-project', currency: 'CHF' },
    ]);

    expect(result[0]).toMatchObject({
      raised_amount: 0.5,
      settled_raised_btc: 0.5,
      supporters_count: 3,
    });
    expect(result[1]).toMatchObject({
      raised_amount: 100, // 0.001 BTC * mocked 100k rate
      settled_raised_btc: 0.001,
      supporters_count: 1,
    });
  });

  it('zeros projects the RPC did not return (private or unfunded)', async () => {
    const client = clientWithRpc([]);
    const [project] = await enrichProjectsWithSettledFunding(client, [
      { id: 'unfunded', currency: 'CHF' },
    ]);
    expect(project).toMatchObject({
      raised_amount: 0,
      settled_raised_btc: 0,
      supporters_count: 0,
    });
  });

  it('degrades to zeros on RPC error — never fabricates, never throws', async () => {
    const errClient = clientWithRpc(null, { message: 'boom' });
    const [a] = await enrichProjectsWithSettledFunding(errClient, [{ id: 'x', currency: 'BTC' }]);
    expect(a).toMatchObject({ raised_amount: 0, settled_raised_btc: 0, supporters_count: 0 });

    const throwingClient = {
      rpc: vi.fn().mockRejectedValue(new Error('network down')),
    } as unknown as AnySupabaseClient;
    const [b] = await enrichProjectsWithSettledFunding(throwingClient, [
      { id: 'y', currency: 'BTC' },
    ]);
    expect(b).toMatchObject({ raised_amount: 0, settled_raised_btc: 0, supporters_count: 0 });
  });
});
