/**
 * Sending money — the outbound half of the payment domain.
 *
 * Until now this logic existed only inside the Cat's `send_payment` tool
 * handler, so the ONLY way to pay someone on OrangeCat was to ask the Cat to do
 * it. Lifting it here gives the /send screen and the Cat one implementation,
 * and fixes two things the handler's inline version got wrong:
 *
 *  - it resolved recipients by reading `wallets.lightning_address` directly,
 *    which silently missed NWC-only recipients that the receive side handles
 *    fine. It now uses `resolveUserWallet`, the same resolution a payer gets
 *    anywhere else.
 *  - it could only pay a person. A pasted or scanned invoice — the common case
 *    when someone hands you a QR — had no path at all.
 *
 * Every outcome is a typed result rather than a thrown error, because the
 * caller has to tell "you have no wallet" (fixable by the user) apart from "the
 * payment failed" (not) and say so in words a person can act on.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { NWCClient } from '@/lib/nostr/nwc';
import { decrypt, isEncryptionConfigured } from '@/domain/payments/encryptionService';
import { generateInvoice } from '@/domain/payments/invoiceGenerationService';
import { resolveLnurlRecipient } from '@/domain/lightning-address/lnurl-service';
import { resolveUserWallet } from '@/domain/payments/walletResolutionService';
import { getAdminClient } from '@/lib/supabase/admin';
import { DATABASE_TABLES } from '@/config/database-tables';
import { isPayableBolt11, normalizeBolt11, parseBolt11 } from '@/lib/bitcoin/bolt11';
import type { ResolvedWallet } from '@/domain/payments/types';
import { logger } from '@/utils/logger';

export type SendFailureReason =
  | 'no_sender_wallet'
  | 'wallet_unreadable'
  /** Our key is missing or rotated — nothing the payer can do about it. */
  | 'sending_unavailable'
  | 'recipient_not_found'
  | 'recipient_cannot_receive'
  | 'invalid_invoice'
  | 'invoice_failed'
  | 'payment_failed';

export interface SendSuccess {
  ok: true;
  paymentHash: string;
  amountBtc: number | null;
  /** What the payer should see they paid — an address, a username, or 'invoice'. */
  destination: string;
}

export interface SendFailure {
  ok: false;
  reason: SendFailureReason;
  message: string;
}

export type SendResult = SendSuccess | SendFailure;

const fail = (reason: SendFailureReason, message: string): SendFailure => ({
  ok: false,
  reason,
  message,
});

/**
 * The sender's own NWC connection, decrypted.
 *
 * Read through the admin client on purpose: `nwc_connection_uri` has no
 * client-role column grant (it is write-only for anon/authenticated), so it is
 * unreadable by the user's own session. Scoping to the caller's `profile_id` is
 * what keeps that safe — never accept a profile id from request input here.
 */
export async function resolveSenderNwcUri(userId: string): Promise<string | SendFailure> {
  const { data } = await (getAdminClient() as unknown as SupabaseClient)
    .from(DATABASE_TABLES.WALLETS)
    .select('nwc_connection_uri')
    .eq('profile_id', userId)
    .eq('is_active', true)
    .not('nwc_connection_uri', 'is', null)
    .order('is_primary', { ascending: false })
    .limit(1);

  const encrypted = data?.[0]?.nwc_connection_uri as string | undefined;
  if (!encrypted) {
    return fail(
      'no_sender_wallet',
      'Connect a Lightning wallet before sending. Any NWC-compatible wallet works.'
    );
  }

  try {
    return decrypt(encrypted);
  } catch {
    // Two very different failures used to share one message. With no key
    // configured, "reconnect it" is advice that cannot work — reconnecting has
    // to encrypt, which needs the same key — so it sends the payer chasing a
    // problem that is ours. Say so, and make it loud in the logs, because
    // nothing else on the box reports it.
    if (!isEncryptionConfigured()) {
      logger.error(
        'PAYMENT_ENCRYPTION_KEY is missing or invalid — no user can send from a connected wallet',
        { userId },
        'Payments'
      );
      return fail(
        'sending_unavailable',
        'Sending is temporarily unavailable on our side. Your wallet is fine — please try again shortly.'
      );
    }
    return fail(
      'wallet_unreadable',
      'We could not read your wallet connection. Reconnect it and try again.'
    );
  }
}

/** Pay an already-minted invoice over the sender's NWC connection. */
async function payOverNwc(
  nwcUri: string,
  bolt11: string,
  amountBtc: number | null,
  destination: string
): Promise<SendResult> {
  const client = new NWCClient(nwcUri);
  try {
    await client.connect();
    const result = await client.payInvoice(bolt11);
    return { ok: true, paymentHash: result.payment_hash, amountBtc, destination };
  } catch (error) {
    logger.warn('Lightning send failed', { error: String(error) }, 'SendPayment');
    return fail(
      'payment_failed',
      'The payment did not go through. Check your wallet has enough balance and try again.'
    );
  } finally {
    client.disconnect();
  }
}

/**
 * Pay a BOLT11 invoice the user pasted or scanned.
 *
 * The amount is read from the invoice and returned so the caller can show what
 * was actually paid; zero-amount invoices are refused rather than paid blind,
 * since the sender never named a figure and neither did the invoice.
 */
export async function payInvoice(userId: string, rawInvoice: string): Promise<SendResult> {
  const bolt11 = normalizeBolt11(rawInvoice);
  const parsed = parseBolt11(bolt11);

  if (!parsed) {
    return fail('invalid_invoice', "That doesn't look like a Lightning invoice.");
  }
  if (!isPayableBolt11(bolt11)) {
    return fail('invalid_invoice', `That is a ${parsed.network} invoice, not a real-Bitcoin one.`);
  }
  if (parsed.amountBtc === null) {
    return fail(
      'invalid_invoice',
      "This invoice doesn't specify an amount. Ask for one with the amount included."
    );
  }

  const nwc = await resolveSenderNwcUri(userId);
  if (typeof nwc !== 'string') {
    return nwc;
  }
  return payOverNwc(nwc, bolt11, parsed.amountBtc, 'invoice');
}

/**
 * Pay a person: an OrangeCat username, or any Lightning address.
 *
 * For a username we run the full receive-side resolution, so anyone who can be
 * paid through the platform at all can be paid here — including NWC-only
 * recipients, which the previous inline implementation silently could not reach.
 */
export async function sendToRecipient(
  userId: string,
  recipient: string,
  amountBtc: number,
  memo = 'Payment via OrangeCat'
): Promise<SendResult> {
  const trimmed = recipient.trim().replace(/^@/, '');
  if (!trimmed) {
    return fail('recipient_not_found', 'Enter a username or Lightning address.');
  }
  if (amountBtc <= 0) {
    return fail('invalid_invoice', 'Enter an amount greater than zero.');
  }

  const admin = getAdminClient() as unknown as SupabaseClient;
  let wallet: ResolvedWallet | null;

  if (trimmed.includes('@')) {
    wallet = { method: 'lightning_address', wallet_id: 'external', lightning_address: trimmed };
  } else {
    // Same handle lookup as the Lightning address, so a rename does not make
    // the old name unpayable, and `_` in a username is not a wildcard.
    const recipient = await resolveLnurlRecipient(trimmed);
    if (!recipient) {
      return fail('recipient_not_found', `We couldn't find @${trimmed} on OrangeCat.`);
    }

    wallet = await resolveUserWallet(admin, recipient.userId);
    if (!wallet) {
      return fail(
        'recipient_cannot_receive',
        `@${trimmed} can't receive Bitcoin payments right now.`
      );
    }
    if (wallet.method === 'onchain') {
      return fail(
        'recipient_cannot_receive',
        `@${trimmed} can only receive on-chain, which this screen can't send to yet.`
      );
    }
  }

  const nwc = await resolveSenderNwcUri(userId);
  if (typeof nwc !== 'string') {
    return nwc;
  }

  let invoice;
  try {
    invoice = await generateInvoice(wallet, amountBtc, memo);
  } catch (error) {
    logger.warn('Recipient invoice generation failed', { error: String(error) }, 'SendPayment');
    return fail('invoice_failed', `We couldn't get an invoice from ${trimmed}. Try again shortly.`);
  }

  if (!invoice.bolt11) {
    return fail('invoice_failed', `${trimmed} didn't return a payable invoice.`);
  }

  return payOverNwc(nwc, invoice.bolt11, amountBtc, trimmed);
}
