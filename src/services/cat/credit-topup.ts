/**
 * Cat Credits — Lightning top-up (Phase 2).
 *
 * A user buys credits by paying a Lightning invoice issued from OrangeCat's own
 * receiving wallet (platform NWC). On settlement we post a `topup` entry to the
 * cat_credit_entries ledger — idempotent via unique(kind, ref=payment_hash).
 *
 * Amounts are BTC end to end (canonical unit); sats appear ONLY when calling the
 * Lightning protocol (makeInvoice takes sats). Settlement is detected by polling
 * lookupInvoice — the same pattern OC already uses for seller payments — so no
 * webhook infra is needed. All server-only (uses the service-role client).
 *
 * Gated on PLATFORM_NWC_URI: when unset, initiate/check report "not enabled" and
 * the rest of Cat Credits is unaffected. See docs/architecture/CAT_CREDITS.md.
 */

import { getAdminClient } from '@/lib/supabase/admin';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { DATABASE_TABLES } from '@/config/database-tables';
import { getPlatformNwcClient, platformReceiveEnabled } from '@/lib/bitcoin/platform-wallet';
import { PAID_PLANS_OPEN } from '@/config/commerce';
import type { NWCClient } from '@/lib/nostr/nwc';
import { appendCreditEntry, getCreditBalance } from '@/services/cat/credits';
import { logger } from '@/utils/logger';

/** Top-up bounds in BTC (1-sat precision). 0.00001 BTC = 1k sats … 0.01 BTC = 1M sats. */
export { MIN_TOPUP_BTC, MAX_TOPUP_BTC } from '@/config/cat-plans';
import { MIN_TOPUP_BTC, MAX_TOPUP_BTC } from '@/config/cat-plans';
/** Invoice validity. */
const INVOICE_EXPIRY_SECONDS = 3600;
const SATS_PER_BTC = 100_000_000;

export interface TopUpInvoice {
  topupId: string;
  bolt11: string;
  paymentHash: string;
  amountBtc: number;
  expiresAt: string;
}

export type TopUpStatus =
  | { status: 'pending' }
  | { status: 'paid'; balanceBtc: number }
  | { status: 'expired' }
  | { status: 'not_found' }
  | { status: 'not_enabled' };

/**
 * How long past `expires_at` we keep ASKING the wallet before recording the
 * terminal `expired`.
 *
 * `expires_at` is our own `Date.now() + 3600s`, stamped after makeInvoice
 * returned — it is a local guess at the wallet's expiry, not the wallet's fact.
 * Server clock skew, a slow mint, or an HTLC still in flight all put a genuinely
 * payable invoice past our timestamp. Writing `expired` on that guess is
 * irreversible: the terminal short-circuit below then means the row is never
 * looked up again, so a payment that lands afterwards is money in the treasury
 * with no credit and nothing left to notice it.
 *
 * So the bound separates two different claims (the same split
 * services/payments/reconcile.ts makes for on-chain intents):
 *   - what we TELL the waiting user  → "past expires_at, start a new one" (now)
 *   - what we WRITE as terminal      → only once no payment is possible (+grace)
 */
export const TOPUP_EXPIRY_GRACE_MS = 24 * 60 * 60 * 1000;

/**
 * True once no payment can still arrive for this invoice — the ONLY condition
 * under which `expired` may be written. Exported so the reconcile sweep counts
 * retirements by the same rule that performs them, instead of restating it.
 */
export function isPastExpiryGrace(expiresAt: string, now: number = Date.now()): boolean {
  return new Date(expiresAt).getTime() + TOPUP_EXPIRY_GRACE_MS < now;
}

/** The columns any settlement decision needs. One list, both entry points. */
export const TOPUP_ROW_COLUMNS = 'id, user_id, amount_btc, payment_hash, status, expires_at';

export interface TopUpRow {
  id: string;
  user_id: string;
  amount_btc: number;
  payment_hash: string;
  status: string;
  expires_at: string;
}

/** Round a BTC amount to 8 dp (1-sat precision) — guards float drift. */
function toBtc8(n: number): number {
  return Math.round(n * SATS_PER_BTC) / SATS_PER_BTC;
}

/**
 * Issue a Lightning invoice from the platform wallet for `amountBtc` and record
 * a pending top-up tied to the user. Returns null if top-up isn't enabled or the
 * amount is out of bounds.
 */
export async function initiateTopUp(
  userId: string,
  amountBtc: number
): Promise<TopUpInvoice | null> {
  // The commercial gate comes FIRST, and is separate from the wallet check
  // below on purpose: a configured wallet means we CAN take money, and this
  // means we MAY. Until the company exists the answer is no, however good the
  // plumbing is. See config/commerce.ts.
  if (!PAID_PLANS_OPEN) {
    return null;
  }
  if (!platformReceiveEnabled()) {
    return null;
  }
  const amount = toBtc8(amountBtc);
  if (!(amount >= MIN_TOPUP_BTC) || amount > MAX_TOPUP_BTC) {
    return null;
  }

  const client = await getPlatformNwcClient();
  if (!client) {
    return null;
  }

  try {
    // Sats only here — the Lightning protocol boundary.
    const sats = Math.round(amount * SATS_PER_BTC);
    const invoice = await client.makeInvoice(
      sats,
      'OrangeCat — Cat Credits top-up',
      INVOICE_EXPIRY_SECONDS
    );

    const expiresAt = new Date(Date.now() + INVOICE_EXPIRY_SECONDS * 1000).toISOString();
    const admin = getAdminClient() as unknown as AnySupabaseClient;
    const { data, error } = await admin
      .from(DATABASE_TABLES.CAT_CREDIT_TOPUPS)
      .insert({
        user_id: userId,
        amount_btc: amount,
        payment_hash: invoice.payment_hash,
        bolt11: invoice.invoice,
        expires_at: expiresAt,
      })
      .select('id')
      .single();

    if (error || !data) {
      logger.error('Failed to record top-up', { error }, 'CatCredits');
      return null;
    }

    return {
      topupId: (data as { id: string }).id,
      bolt11: invoice.invoice,
      paymentHash: invoice.payment_hash,
      amountBtc: amount,
      expiresAt,
    };
  } catch (err) {
    logger.error('initiateTopUp threw', { err }, 'CatCredits');
    return null;
  } finally {
    client.disconnect();
  }
}

/**
 * Settle ONE top-up row against the wallet: if its invoice has settled, credit
 * the ledger (once) and mark it paid. Crediting goes to the row's recorded
 * owner, never to whoever asked, so a poller can't claim someone else's payment.
 *
 * The caller owns `client`'s lifecycle so a sweep can reuse one NWC connection
 * across a batch instead of reconnecting per row.
 *
 * This is the ONE settlement implementation. Both entry points run it — the
 * owner's browser poll (`checkTopUp`) and the server-side backstop sweep
 * (services/cat/topup-reconcile) — so a top-up cannot settle differently
 * depending on who noticed it.
 */
export async function settleTopUpRow(
  admin: AnySupabaseClient,
  topup: TopUpRow,
  client: NWCClient
): Promise<TopUpStatus> {
  if (topup.status === 'paid') {
    return { status: 'paid', balanceBtc: await getCreditBalance(admin, topup.user_id) };
  }
  if (topup.status === 'expired') {
    return { status: 'expired' };
  }

  try {
    const invoice = await client.lookupInvoice(topup.payment_hash);
    if (invoice.settled_at) {
      // Credit the OWNER first — idempotent on payment_hash (unique ref in the
      // ledger), so a retried settlement never double-credits. Mark paid ONLY if
      // the credit actually landed: if the append fails (transient DB error), we
      // must NOT flip status to paid, or the next poll short-circuits on 'paid'
      // and the user's Lightning payment is lost with no credit. Leaving it
      // pending lets the next attempt retry the (idempotent) credit.
      const balanceBtc = await appendCreditEntry(admin, topup.user_id, {
        kind: 'topup',
        amountBtc: topup.amount_btc,
        ref: topup.payment_hash,
        metadata: { source: 'lightning', topupId: topup.id },
      });
      if (balanceBtc === null) {
        logger.warn(
          'top-up settled but crediting failed — staying pending for retry',
          { topupId: topup.id },
          'CatCredits'
        );
        return { status: 'pending' };
      }
      await admin
        .from(DATABASE_TABLES.CAT_CREDIT_TOPUPS)
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('id', topup.id);
      return { status: 'paid', balanceBtc };
    }
  } catch (err) {
    // Transient relay/lookup failure — report pending so it is asked again.
    logger.warn('top-up lookup failed', { err, topupId: topup.id }, 'CatCredits');
    return { status: 'pending' };
  }

  // Not settled. Past its window the user should start a new invoice, but only
  // record the terminal `expired` once no payment can still arrive — see
  // TOPUP_EXPIRY_GRACE_MS for why those are two different moments.
  if (new Date(topup.expires_at).getTime() >= Date.now()) {
    return { status: 'pending' };
  }
  if (isPastExpiryGrace(topup.expires_at)) {
    await admin
      .from(DATABASE_TABLES.CAT_CREDIT_TOPUPS)
      .update({ status: 'expired' })
      .eq('id', topup.id);
  }
  return { status: 'expired' };
}

/**
 * The caller's most recent top-up that can still be paid.
 *
 * An invoice does not stop being payable because its dialog was closed, but
 * nothing in the UI referenced a pending top-up once that happened — the only
 * handle on it was component state that went away with the modal. A user who
 * closed the dialog (or reloaded, or came back on their phone) had no way to
 * reach the invoice again and no evidence it existed, so the honest options
 * were "pay a QR I can no longer see" or "make a second one".
 *
 * Read with the caller's own client so RLS scopes it; expired rows are excluded
 * because resuming one would only produce a payment that cannot land.
 */
export async function getResumableTopUp(
  supabase: AnySupabaseClient,
  userId: string
): Promise<TopUpInvoice | null> {
  const { data } = await supabase
    .from(DATABASE_TABLES.CAT_CREDIT_TOPUPS)
    .select('id, bolt11, payment_hash, amount_btc, expires_at')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) {
    return null;
  }
  const row = data as {
    id: string;
    bolt11: string;
    payment_hash: string;
    amount_btc: number | string;
    expires_at: string;
  };
  return {
    topupId: row.id,
    bolt11: row.bolt11,
    paymentHash: row.payment_hash,
    amountBtc: Number(row.amount_btc),
    expiresAt: row.expires_at,
  };
}

/**
 * Poll one of YOUR top-ups. Scoped to the caller by user_id; terminal rows
 * answer without a wallet round-trip.
 */
export async function checkTopUp(userId: string, topupId: string): Promise<TopUpStatus> {
  // Deliberately NOT gated on PAID_PLANS_OPEN. Closing the till must never
  // strand money already in flight: if someone paid an invoice while it was
  // open, they are owed the credit whatever the switch says afterwards.
  // Refusing to honour a payment already made is a worse failure than the one
  // the gate exists to prevent.
  if (!platformReceiveEnabled()) {
    return { status: 'not_enabled' };
  }

  const admin = getAdminClient() as unknown as AnySupabaseClient;
  const { data: row } = await admin
    .from(DATABASE_TABLES.CAT_CREDIT_TOPUPS)
    .select(TOPUP_ROW_COLUMNS)
    .eq('id', topupId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!row) {
    return { status: 'not_found' };
  }
  const topup = row as TopUpRow;

  if (topup.status === 'paid') {
    return { status: 'paid', balanceBtc: await getCreditBalance(admin, topup.user_id) };
  }
  if (topup.status === 'expired') {
    return { status: 'expired' };
  }

  const client = await getPlatformNwcClient();
  if (!client) {
    return { status: 'not_enabled' };
  }
  try {
    return await settleTopUpRow(admin, topup, client);
  } finally {
    client.disconnect();
  }
}
