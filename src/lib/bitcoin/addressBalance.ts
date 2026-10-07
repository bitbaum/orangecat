/**
 * An on-chain address's balance — the one fetcher.
 *
 * There were three: services/blockchain (no timeout, its errors matched none
 * of the codes its caller checked, and Next cached it for five minutes, so
 * "refresh" could return the old number), the treasury's own (no timeout,
 * sats where every caller wanted BTC, confirmed funds only), and a private
 * copy in domain/wallets/refreshBalance (the only one that got it right).
 * None followed NEXT_PUBLIC_BITCOIN_NETWORK.
 *
 * Errors are thrown as stable codes: 'TIMEOUT', 'RATE_LIMITED',
 * 'API_ERROR_<status>', 'NETWORK_ERROR'.
 */

import { BITCOIN_FETCH_TIMEOUT_MS } from '@/lib/wallets/constants';
import { satsToBitcoin } from '@/services/currency';

const MEMPOOL_API =
  process.env.NEXT_PUBLIC_BITCOIN_NETWORK === 'testnet'
    ? 'https://mempool.space/testnet/api'
    : 'https://mempool.space/api';

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // A balance someone asked to refresh must not come from a cache.
    return await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-store',
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('TIMEOUT');
    }
    throw new Error('NETWORK_ERROR');
  } finally {
    clearTimeout(id);
  }
}

/** Confirmed plus unconfirmed, in sats — what the address holds right now. */
export async function fetchAddressStats(
  address: string
): Promise<{ balanceSats: number; txCount: number }> {
  const res = await fetchWithTimeout(
    `${MEMPOOL_API}/address/${encodeURIComponent(address)}`,
    BITCOIN_FETCH_TIMEOUT_MS
  );
  if (res.status === 429) {
    throw new Error('RATE_LIMITED');
  }
  if (!res.ok) {
    throw new Error(`API_ERROR_${res.status}`);
  }
  const d = await res.json();
  const c = d?.chain_stats ?? {};
  const m = d?.mempool_stats ?? {};
  const balanceSats =
    (c.funded_txo_sum ?? 0) -
    (c.spent_txo_sum ?? 0) +
    (m.funded_txo_sum ?? 0) -
    (m.spent_txo_sum ?? 0);
  return { balanceSats, txCount: (c.tx_count ?? 0) + (m.tx_count ?? 0) };
}

/** The same, in BTC — the canonical unit — with when it was read. */
export async function fetchAddressBalance(
  address: string
): Promise<{ balance_btc: number; tx_count: number; updated_at: string }> {
  const { balanceSats, txCount } = await fetchAddressStats(address);
  return {
    balance_btc: satsToBitcoin(Math.max(0, balanceSats)),
    tx_count: txCount,
    updated_at: new Date().toISOString(),
  };
}
