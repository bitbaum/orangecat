/**
 * Paying a pay-page invoice from the payer's own OrangeCat wallet, in one tap.
 *
 * The pay page already mints an invoice against the recipient's wallet and
 * watches it settle. A payer who is signed in with a wallet connected need not
 * carry that invoice to another app: this pays it over their own NWC
 * connection. Everything after the payment is the ordinary path — the status
 * poll observes settlement, the recipient is notified, a request is marked
 * paid — because the payment is made AGAINST the same intent, not beside it.
 *
 * The amount is read from the intent, never from the request, so nothing the
 * browser sends can change what is paid. The status token that proves the
 * caller minted the invoice is checked first.
 *
 * The payer is recorded on the intent (buyer_id): that is what lets the
 * recipient be told WHO paid. It is done only here, where the payer is signed
 * in and chose to pay from their own wallet; a payer who scans with another
 * wallet stays anonymous, as before.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { DATABASE_TABLES } from '@/config/database-tables';
import { STATUS } from '@/config/database-constants';
import { getAdminClient } from '@/lib/supabase/admin';
import { hashPublicStatusToken } from '@/domain/payments/paymentFlowHelpers';
import {
  payOverNwc,
  resolveSenderNwcUri,
  type SendFailure,
  type SendResult,
} from '@/domain/payments/sendPaymentService';

const gone = (message: string): SendFailure => ({
  ok: false,
  reason: 'invoice_failed',
  message,
});

interface IntentRow {
  id: string;
  seller_id: string;
  bolt11: string | null;
  amount_btc: number | string;
  status: string;
  intent_kind: string;
  public_status_token_hash: string | null;
  expires_at: string | null;
}

export async function payTipFromWallet(
  userId: string,
  intentId: string,
  statusToken: string
): Promise<SendResult> {
  const admin = getAdminClient() as unknown as SupabaseClient;
  const { data } = await admin
    .from(DATABASE_TABLES.PAYMENT_INTENTS)
    .select(
      'id, seller_id, bolt11, amount_btc, status, intent_kind, public_status_token_hash, expires_at'
    )
    .eq('id', intentId)
    .maybeSingle();
  const intent = data as IntentRow | null;

  // One answer for "no such request", "not yours" and "not a pay-page request":
  // the token is the only proof, and a wrong one must learn nothing.
  if (
    !intent ||
    intent.intent_kind !== 'tip' ||
    intent.public_status_token_hash !== hashPublicStatusToken(statusToken)
  ) {
    return gone('That payment request was not found.');
  }
  if (intent.status === STATUS.PAYMENT_INTENTS.PAID) {
    return gone('This has already been paid.');
  }
  if (
    intent.status === STATUS.PAYMENT_INTENTS.EXPIRED ||
    intent.status === STATUS.PAYMENT_INTENTS.FAILED ||
    (intent.expires_at && new Date(intent.expires_at).getTime() <= Date.now())
  ) {
    return gone('This payment request expired. Start a new one.');
  }
  if (intent.seller_id === userId) {
    return { ok: false, reason: 'self_send', message: "That's you. Pick someone else to pay." };
  }
  if (!intent.bolt11) {
    return gone('This one is paid to an on-chain address, which a wallet connection cannot send.');
  }

  const nwc = await resolveSenderNwcUri(userId);
  if (typeof nwc !== 'string') {
    return nwc;
  }

  // Before the money moves, so the settlement note can name the payer. Only
  // ever claims an intent nobody has claimed.
  await admin
    .from(DATABASE_TABLES.PAYMENT_INTENTS)
    .update({ buyer_id: userId })
    .eq('id', intent.id)
    .is('buyer_id', null);

  return payOverNwc(userId, nwc, intent.bolt11, Number(intent.amount_btc), intent.seller_id);
}
