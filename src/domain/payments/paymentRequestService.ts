/**
 * Person-to-person payment requests — "Lena asks Marco for 0.0005 BTC".
 *
 * A request records the ASK, not a payment. Deliberately no invoice is minted
 * here: a BOLT11 expires in about an hour and a request has to survive until
 * the person actually opens it. The payer gets a normal pay link, and the
 * invoice is created when they arrive — the same alias-backed rule the public
 * /pay/<username> page follows.
 *
 * Marking a request paid is a SYSTEM write, never a party write. Both people
 * have an interest in the answer, so neither gets to assert it; RLS allows them
 * only to cancel or decline, and settlement is observed through the payment
 * path exactly as everywhere else in this domain.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getAdminClient } from '@/lib/supabase/admin';
import { fromTable } from '@/lib/supabase/untyped';
import { DATABASE_TABLES } from '@/config/database-tables';
import { NotificationDispatcher } from '@/services/notifications/dispatcher';
import { resolveLnurlRecipient } from '@/domain/lightning-address/lnurl-service';
import { buildPayUrl } from '@/config/pay';
import { SITE_URL } from '@/config/brand';
import { PAY_MAX_BTC, PAY_MIN_BTC } from '@/config/pay';
import { formatBtcForUser } from '@/services/currency/format-for-user.server';
import { formatCurrency } from '@/services/currency/formatting';
import {
  askToBtcOrNull,
  FIAT_ASK_TOLERANCE,
  isAskCurrency,
  roundAsk,
  type RequestAsk,
} from '@/domain/payments/requestAsk';
import type { PaymentIntent } from '@/domain/payments/types';
import { logger } from '@/utils/logger';

export type PaymentRequestStatus = 'pending' | 'paid' | 'declined' | 'cancelled';

export interface PaymentRequestRow {
  id: string;
  requester_id: string;
  payer_id: string;
  amount_btc: number;
  /** Set when the ask was made in a currency; amount_btc is then only what it was worth when asked. */
  ask_amount: number | null;
  ask_currency: string | null;
  note: string | null;
  status: PaymentRequestStatus;
  created_at: string;
  paid_at: string | null;
  /**
   * The OTHER party, from the caller's point of view — who asked you, or who
   * you asked. A list of amounts without names is unreadable: "0.0005 BTC,
   * pending" tells you nothing about whether to pay it.
   */
  counterparty_username: string | null;
  counterparty_name: string | null;
}

/** A profile embed arrives as an object or a one-element array depending on
 *  how PostgREST resolves the relationship — both are handled at the read. */
type EmbeddedProfile = { username: string | null; name: string | null };

type RawPaymentRequestRow = Omit<
  PaymentRequestRow,
  'counterparty_username' | 'counterparty_name'
> & {
  requester: EmbeddedProfile | EmbeddedProfile[] | null;
  payer: EmbeddedProfile | EmbeddedProfile[] | null;
};

export type RequestFailureReason =
  | 'payer_not_found'
  | 'self_request'
  | 'invalid_amount'
  | 'no_rate'
  | 'requester_cannot_receive'
  | 'not_found'
  | 'not_pending';

export interface RequestFailure {
  ok: false;
  reason: RequestFailureReason;
  message: string;
}

const fail = (reason: RequestFailureReason, message: string): RequestFailure => ({
  ok: false,
  reason,
  message,
});

/**
 * Create a request addressed to another OrangeCat user.
 *
 * The requester's ability to RECEIVE is checked first: asking for money you
 * have no way to accept wastes the other person's time and makes the platform
 * look broken at the worst possible moment.
 */
export async function createPaymentRequest(
  supabase: SupabaseClient,
  requesterId: string,
  input: {
    payerUsername: string;
    amountBtc?: number;
    ask?: { amount: number; currency: string };
    note?: string;
  }
): Promise<{ ok: true; request: PaymentRequestRow } | RequestFailure> {
  const { payerUsername, note } = input;

  // An ask in a currency is held in that currency. The BTC beside it is worked
  // out HERE from our own rate, never taken from the browser: it is what the
  // bounds are checked against and what the lists fall back on.
  let ask: RequestAsk | null = null;
  let amountBtc = input.amountBtc ?? NaN;
  if (input.ask) {
    if (!isAskCurrency(input.ask.currency) || !(input.ask.amount > 0)) {
      return fail('invalid_amount', 'Enter an amount we can actually request.');
    }
    ask = { amount: roundAsk(input.ask.amount, input.ask.currency), currency: input.ask.currency };
    const priced = await askToBtcOrNull(ask);
    if (priced === null) {
      return fail(
        'no_rate',
        `We can't price ${ask.currency} right now. Enter the amount in BTC, or try again in a minute.`
      );
    }
    amountBtc = priced;
  }

  if (!Number.isFinite(amountBtc) || amountBtc < PAY_MIN_BTC || amountBtc > PAY_MAX_BTC) {
    return fail('invalid_amount', 'Enter an amount we can actually request.');
  }

  const username = payerUsername.trim().replace(/^@/, '');
  const payer = await resolveLnurlRecipient(username);
  if (!payer) {
    return fail('payer_not_found', `We couldn't find @${username} on OrangeCat.`);
  }
  if (payer.userId === requesterId) {
    return fail('self_request', "You can't request money from yourself.");
  }

  // Written through the CALLER's client, so the insert policy (you may only ask
  // on your own behalf) is what actually enforces authorship.
  const { data, error } = await fromTable(supabase, DATABASE_TABLES.PAYMENT_REQUESTS)
    .insert({
      requester_id: requesterId,
      payer_id: payer.userId,
      amount_btc: amountBtc,
      ask_amount: ask?.amount ?? null,
      ask_currency: ask?.currency ?? null,
      note: note?.trim() || null,
    })
    .select(
      'id, requester_id, payer_id, amount_btc, ask_amount, ask_currency, note, status, created_at, paid_at'
    )
    .single();

  if (error || !data) {
    logger.error('payment request insert failed', { error }, 'PaymentRequest');
    return fail('not_found', 'Could not create that request. Try again.');
  }

  // The counterparty here is the payer — we resolved them a moment ago, so the
  // row we hand back matches the shape the list returns rather than a lookalike
  // missing exactly the fields the UI renders.
  const request: PaymentRequestRow = {
    ...(data as Omit<PaymentRequestRow, 'counterparty_username' | 'counterparty_name'>),
    counterparty_username: payer.username,
    counterparty_name: payer.displayName,
  };

  await notifyPayer(request, requesterId);
  return { ok: true, request };
}

/** Tell the payer they've been asked, with a link that pays it in one tap. */
async function notifyPayer(request: PaymentRequestRow, requesterId: string): Promise<void> {
  try {
    const admin = getAdminClient();
    const { data: requester } = await fromTable(admin, DATABASE_TABLES.PROFILES)
      .select('username, display_name:name')
      .eq('id', requesterId)
      .maybeSingle();

    const row = requester as { username?: string; display_name?: string } | null;
    const name = row?.display_name || row?.username || 'Someone';
    const forNote = request.note ? ` for ${request.note}` : '';
    // What was asked, in the words it was asked in: "CHF 20.00" for an ask in
    // francs; otherwise the BTC in the payer's own currency, not "0.00023 BTC".
    const amount =
      request.ask_amount && request.ask_currency
        ? formatCurrency(Number(request.ask_amount), request.ask_currency)
        : await formatBtcForUser(admin, request.payer_id, request.amount_btc);

    await NotificationDispatcher.dispatch({
      userId: request.payer_id,
      type: 'payment',
      title: `${name} asked you for ${amount}`,
      message: `${name} asked you for ${amount}${forNote}. Pay it in one tap, or decline.`,
      // Deep-links to the pay page with the ask pre-filled — still editable,
      // because a request is a suggestion and the payer stays in control. It
      // names the request, so the payment that follows can answer it.
      actionUrl: row?.username
        ? buildPayUrl(SITE_URL, row.username, {
            amountBtc: request.amount_btc,
            note: request.note ?? undefined,
            requestId: request.id,
          })
        : undefined,
      data: { kind: 'payment_request', requestId: request.id },
    });
  } catch (error) {
    // A delivered request that failed to notify is still a real request the
    // payer will see in their list — never fail the creation over this.
    logger.warn('payment request notification failed', { error: String(error) }, 'PaymentRequest');
  }
}

/** Requests I sent, and requests waiting on me. */
export async function listPaymentRequests(
  supabase: SupabaseClient,
  userId: string
): Promise<{ incoming: PaymentRequestRow[]; outgoing: PaymentRequestRow[] }> {
  // Both parties are embedded because either one can be "the other person"
  // depending on which side of the ask the caller is on. Two FKs point at
  // profiles, so each embed names its constraint — PostgREST cannot guess.
  const { data } = await fromTable(supabase, DATABASE_TABLES.PAYMENT_REQUESTS)
    .select(
      `id, requester_id, payer_id, amount_btc, ask_amount, ask_currency, note, status, created_at, paid_at,
       requester:profiles!payment_requests_requester_id_fkey(username, name),
       payer:profiles!payment_requests_payer_id_fkey(username, name)`
    )
    .order('created_at', { ascending: false })
    .limit(100);

  const rows = (data ?? []) as unknown as RawPaymentRequestRow[];
  const view = (row: RawPaymentRequestRow) => {
    // The caller already knows who they are; the useful name is the other one.
    const other = row.payer_id === userId ? row.requester : row.payer;
    const profile = Array.isArray(other) ? other[0] : other;
    const { requester: _requester, payer: _payer, ...rest } = row;
    return {
      ...rest,
      counterparty_username: profile?.username ?? null,
      counterparty_name: profile?.name ?? profile?.username ?? null,
    };
  };

  return {
    incoming: rows.filter(r => r.payer_id === userId).map(view),
    outgoing: rows.filter(r => r.requester_id === userId).map(view),
  };
}

/**
 * Withdraw from an open request: the asker cancels, the person asked declines.
 * RLS decides which of those the caller is allowed to do — this only names the
 * transition, it does not authorise it.
 */
export async function closePaymentRequest(
  supabase: SupabaseClient,
  requestId: string,
  status: 'cancelled' | 'declined'
): Promise<{ ok: true } | RequestFailure> {
  const { data, error } = await fromTable(supabase, DATABASE_TABLES.PAYMENT_REQUESTS)
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', requestId)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();

  if (error) {
    logger.warn('payment request close failed', { error, requestId }, 'PaymentRequest');
    return fail('not_pending', 'That request is no longer open.');
  }
  if (!data) {
    // Either it doesn't exist, isn't ours, or already closed — all the same to
    // the caller, and deliberately indistinguishable so this can't enumerate.
    return fail('not_pending', 'That request is no longer open.');
  }
  return { ok: true };
}

/** What a payment may fall short of an ask by before it stops counting as the answer. */
const REQUEST_PAID_TOLERANCE = 0.999;

/**
 * The open request a pay link names, if it really is open and really is
 * addressed to this recipient (they are the one being paid). Anything else
 * returns null and the payment simply is not tied to a request.
 */
export async function findOpenRequestFor(
  recipientId: string,
  requestId: string
): Promise<{ id: string; amount_btc: number } | null> {
  const { data } = await fromTable(getAdminClient(), DATABASE_TABLES.PAYMENT_REQUESTS)
    .select('id, amount_btc')
    .eq('id', requestId)
    .eq('requester_id', recipientId)
    .eq('status', 'pending')
    .maybeSingle();
  const row = data as { id: string; amount_btc: number | string } | null;
  return row ? { id: row.id, amount_btc: Number(row.amount_btc) } : null;
}

/**
 * Where a request stands, as the person being paid sees it — for the pay page
 * a request link opens on. Read with the admin client: the link holds an
 * unguessable id, and only the status leaves this function.
 */
export async function getRequestStatusFor(
  recipientId: string,
  requestId: string
): Promise<PaymentRequestStatus | null> {
  const { data } = await fromTable(getAdminClient(), DATABASE_TABLES.PAYMENT_REQUESTS)
    .select('status')
    .eq('id', requestId)
    .eq('requester_id', recipientId)
    .maybeSingle();
  return (data as { status: PaymentRequestStatus } | null)?.status ?? null;
}

/**
 * What an open request asked in a currency comes to in Bitcoin TODAY — for the
 * pay page, which would otherwise show the number frozen into the link when the
 * ask was made. Null for a request made in BTC (the link's number is already
 * exact), for one that is not open, or when there is no rate: the page then
 * falls back to the link, which is still a suggestion the payer can change.
 */
export async function getOpenAskBtcNow(
  recipientId: string,
  requestId: string
): Promise<number | null> {
  const { data } = await fromTable(getAdminClient(), DATABASE_TABLES.PAYMENT_REQUESTS)
    .select('ask_amount, ask_currency')
    .eq('id', requestId)
    .eq('requester_id', recipientId)
    .eq('status', 'pending')
    .maybeSingle();
  const row = data as { ask_amount: number | string | null; ask_currency: string | null } | null;
  if (!row?.ask_amount || !isAskCurrency(row.ask_currency)) {
    return null;
  }
  return askToBtcOrNull({ amount: Number(row.ask_amount), currency: row.ask_currency });
}

/**
 * Settlement found a payment that was minted for a request: if it covers the
 * ask, mark the request paid (the system write the table was designed for) and
 * tell the person who asked, by name, in their own currency.
 *
 * A payment that falls short leaves the request open — the payer chose a
 * smaller number on a link that only suggested one, and "paid" must mean the
 * ask was met. Returns true when the request was settled, so the caller can
 * skip the generic "you were paid" note in favour of this one.
 */
export async function settlePaymentRequest(intent: PaymentIntent): Promise<boolean> {
  const requestId = intent.payment_request_id;
  if (!requestId) {
    return false;
  }
  try {
    const admin = getAdminClient();
    const { data: found } = await fromTable(admin, DATABASE_TABLES.PAYMENT_REQUESTS)
      .select('id, payer_id, amount_btc, ask_amount, ask_currency, note')
      .eq('id', requestId)
      .eq('requester_id', intent.seller_id)
      .eq('status', 'pending')
      .maybeSingle();
    const request = found as {
      id: string;
      payer_id: string;
      amount_btc: number | string;
      ask_amount: number | string | null;
      ask_currency: string | null;
      note: string | null;
    } | null;
    if (!request) {
      return false;
    }

    // An ask in a currency is met by what that currency buys today; the stored
    // BTC is only the fallback when there is no rate to ask.
    const priced =
      request.ask_amount && isAskCurrency(request.ask_currency)
        ? await askToBtcOrNull({
            amount: Number(request.ask_amount),
            currency: request.ask_currency,
          })
        : null;
    const required = priced ?? Number(request.amount_btc);
    const tolerance = request.ask_amount ? FIAT_ASK_TOLERANCE : REQUEST_PAID_TOLERANCE;
    if (Number(intent.amount_btc) < required * tolerance) {
      return false;
    }

    // The status is the lock: only one observer moves it, so only one tells the asker.
    const { data: moved } = await fromTable(admin, DATABASE_TABLES.PAYMENT_REQUESTS)
      .update({
        status: 'paid',
        paid_intent_id: intent.id,
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', request.id)
      .eq('status', 'pending')
      .select('id');
    if (!moved || moved.length === 0) {
      return true;
    }

    const { data: payer } = await fromTable(admin, DATABASE_TABLES.PROFILES)
      .select('username, display_name:name')
      .eq('id', request.payer_id)
      .maybeSingle();
    const who = payer as { username?: string; display_name?: string } | null;
    const name = who?.display_name || who?.username || 'Someone';
    const amount = await formatBtcForUser(admin, intent.seller_id, Number(intent.amount_btc));
    const forNote = request.note ? ` for ${request.note}` : '';

    void NotificationDispatcher.dispatch({
      userId: intent.seller_id,
      type: 'payment',
      title: `${name} paid you ${amount}`,
      message: `${name} paid your request${forNote} — ${amount}, straight to your wallet.`,
      data: {
        kind: 'payment_request_paid',
        requestId: request.id,
        paymentIntentId: intent.id,
        amount_btc: Number(intent.amount_btc),
        // The live Receive screen reads these to say who paid and what for.
        payerName: name,
        note: request.note,
      },
      actionUrl: '/requests',
    });
    return true;
  } catch (error) {
    // The payment has happened; a request that fails to flip is logged, never thrown.
    logger.error(
      'Could not settle the payment request for a paid intent',
      { error: String(error), paymentIntentId: intent.id },
      'PaymentRequest'
    );
    return false;
  }
}
