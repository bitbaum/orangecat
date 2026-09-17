/**
 * Payment Status Service
 *
 * Checks payment status using the appropriate method:
 * - NWC: lookup_invoice via Nostr relay
 * - Lightning Address: LNURL-verify (LUD-21) when the provider supports it,
 *   otherwise buyer-confirmed (no server-side verification)
 * - On-chain: Mempool.space API polling
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { NWCClient } from '@/lib/nostr/nwc';
import { getAdminClient } from '@/lib/supabase/admin';
import { DATABASE_TABLES } from '@/config/database-tables';
import { checkAddressPayment, type OnchainPaymentCheck } from '@/lib/bitcoin/mempool';
import { decrypt } from './encryptionService';
import { logger } from '@/utils/logger';
import { bitcoinToSats } from '@/services/currency';
import type { PaymentIntent } from './types';

/**
 * Check if an NWC payment has been settled by looking up the invoice on the relay.
 *
 * Returns true if paid, false otherwise.
 */
export async function checkNWCPaymentStatus(paymentIntent: PaymentIntent): Promise<boolean> {
  if (!paymentIntent.payment_hash) {
    return false;
  }

  // Read the seller's wallet through the admin client: detection is a system
  // operation on the SELLER's secret, and the caller is usually the buyer (or
  // anonymous). It only worked under caller clients because wallets_select is
  // currently public-read — tightening that policy must not silently kill
  // payment detection.
  const admin = getAdminClient() as unknown as SupabaseClient;

  // Use the exact wallet selected when the invoice was created. The fallback
  // keeps pre-migration intents checkable, but new intents must never search an
  // arbitrary NWC wallet belonging to the same recipient.
  let walletQuery = admin
    .from(DATABASE_TABLES.WALLETS)
    .select('nwc_connection_uri')
    .not('nwc_connection_uri', 'is', null);
  walletQuery = paymentIntent.receiving_wallet_id
    ? walletQuery.eq('id', paymentIntent.receiving_wallet_id)
    : walletQuery.eq('profile_id', paymentIntent.seller_id).limit(1);
  const { data: wallet } = await walletQuery.maybeSingle();

  if (!wallet?.nwc_connection_uri) {
    return false;
  }

  let nwcUri: string;
  try {
    nwcUri = decrypt(wallet.nwc_connection_uri);
  } catch {
    // warn, not error — a permanent, owner-fixable state (the stored URI
    // predates the current PAYMENT_ENCRYPTION_KEY), already disclosed on the
    // owner's wallet card. See walletResolutionService for the full note.
    logger.warn('NWC URI could not be decrypted for status check; treating as unpaid', {
      sellerId: paymentIntent.seller_id,
      remedy: 'owner must reconnect the wallet',
    });
    return false;
  }

  const client = new NWCClient(nwcUri);

  try {
    await client.connect();
    const invoice = await client.lookupInvoice(paymentIntent.payment_hash);

    // NWC invoice is settled when settled_at is set
    return !!invoice.settled_at;
  } catch (error) {
    logger.warn('NWC invoice lookup failed', {
      paymentHash: paymentIntent.payment_hash,
      error,
    });
    return false;
  } finally {
    client.disconnect();
  }
}

/**
 * Check if a lightning_address payment has settled via its LUD-21 verify URL.
 *
 * The verify endpoint returns `{ status: "OK", settled: boolean, ... }`.
 * Returns true only on an explicit `settled: true`. Never throws — network or
 * provider errors are logged and treated as "not settled yet".
 */
export async function checkLnurlVerifyPaymentStatus(
  paymentIntent: Pick<PaymentIntent, 'id' | 'lnurl_verify_url'>
): Promise<boolean> {
  if (!paymentIntent.lnurl_verify_url) {
    return false;
  }

  try {
    const response = await fetch(paymentIntent.lnurl_verify_url, {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      return false;
    }

    const data = (await response.json()) as { status?: string; settled?: boolean };
    return data.status === 'OK' && data.settled === true;
  } catch (error) {
    logger.warn('LNURL-verify check failed', {
      paymentIntentId: paymentIntent.id,
      error,
    });
    return false;
  }
}

/**
 * Check if an on-chain Bitcoin payment has been received at the expected address.
 *
 * Uses the Mempool.space API to look for transactions paying to the address.
 * Returns an object describing what was found:
 * - `confirmed` (>= 1 confirmation) -> caller should mark as paid
 * - `in_mempool` (0 confirmations) -> caller should mark as pending_confirmation
 * - `not_found` -> no matching transaction yet
 *
 * Never throws — Mempool API errors are caught and logged internally.
 */
export async function checkOnchainPaymentStatus(
  paymentIntent: Pick<PaymentIntent, 'id' | 'onchain_address' | 'amount_btc' | 'created_at'>
): Promise<'confirmed' | 'in_mempool' | 'not_found'> {
  if (!paymentIntent.onchain_address || !paymentIntent.amount_btc) {
    return 'not_found';
  }

  // Use the payment intent's created_at as a lower bound so we don't match
  // older transactions to the same address
  const sinceTimestamp = paymentIntent.created_at
    ? Math.floor(new Date(paymentIntent.created_at).getTime() / 1000)
    : undefined;

  // Convert BTC to sats for mempool API (protocol level)
  const expectedAmountSats = bitcoinToSats(paymentIntent.amount_btc);
  const result: OnchainPaymentCheck = await checkAddressPayment({
    address: paymentIntent.onchain_address,
    expectedAmountSats,
    sinceTimestamp,
  });

  if (!result.found) {
    return 'not_found';
  }

  logger.info(
    'On-chain payment detected',
    {
      paymentIntentId: paymentIntent.id,
      txid: result.txid,
      confirmations: result.confirmations,
      amountSats: result.amountSats,
    },
    'mempool'
  );

  if (result.confirmations && result.confirmations >= 1) {
    return 'confirmed';
  }

  return 'in_mempool';
}
