'use client';

import { Bitcoin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { AmountField } from '@/components/money/AmountField';
import { MoneyReceipt } from '@/components/money/MoneyReceipt';
import { PAYMENT_FLOW_COPY, receiptNote, type PaymentAct } from '@/config/payment-flow';
import { PUBLIC_API_BASE } from '@/config/public-api';
import {
  CONTRIBUTION_TERMS,
  contributionRange,
  type ContributionBoundsBtc,
} from '@/config/contribution-terms';
import { useDisplayCurrency } from '@/hooks/useDisplayCurrency';
import { useChosenAmountBtc } from '@/components/money/useOpeningAmountBtc';
import { usePublicPayment } from '@/hooks/usePublicPayment';
import { PublicPaymentProgress } from './PublicPaymentProgress';
import type { EntityType } from '@/config/entity-registry';

interface PublicSupportPanelProps {
  entityType: EntityType;
  entityId: string;
  entityTitle: string;
  /**
   * Who receives the money: the owner (a person or a group). The payment
   * settles in a wallet of theirs — one tied to this listing, else their own —
   * never in the listing's, so the card names them, not the listing.
   */
  recipientName?: string | null;
  /**
   * The minimum and maximum the entity states for one payment, in BTC (an
   * investment's ticket size). They bound the amount field, its opening amount
   * and its suggestions; the server refuses outside them as well.
   */
  bounds?: ContributionBoundsBtc | null;
  /** Overrides the card's title ("Support Mira" on a companion's page). */
  title?: string;
}

/** "You pay Cato directly for Remise Rosa…" — the payee, then what it is for. */
export function supportPayeeLines(entityTitle: string, recipientName?: string | null) {
  const payee = recipientName?.trim() || null;
  const forWhat = payee !== entityTitle ? ` for ${entityTitle}` : '';
  return {
    intro: `You pay ${payee ?? 'the owner'} directly${forWhat}; no account is required.`,
    custody: `OrangeCat never holds the money. It goes straight to ${payee ? `${payee}'s` : "the owner's"} wallet.`,
  };
}

/**
 * The card's words. An entity that states terms (an investment) is paid on
 * those terms, and the card says so; everything else is support. A payment
 * made here carries no account, so for an investment the card also says that
 * the payer keeps the record of who paid.
 */
export function supportCardWords(
  entityType: EntityType,
  entityTitle: string,
  recipientName?: string | null
) {
  const lines = supportPayeeLines(entityTitle, recipientName);
  const terms = CONTRIBUTION_TERMS[entityType];
  if (!terms) {
    return {
      ...lines,
      title: 'Support with Bitcoin',
      act: 'support' as PaymentAct,
      receiptFootnote: null as string | null,
      noun: 'contribution',
    };
  }
  const payee = recipientName?.trim() || 'the owner';
  return {
    title: `${terms.verb} with Bitcoin`,
    intro: `You ${terms.verb.toLowerCase()} on the terms on this page and pay ${payee} directly; no account is required.`,
    custody: `${lines.custody} Without an account OrangeCat does not record who paid, so keep your payment confirmation.`,
    act: 'invest' as PaymentAct,
    // The receipt repeats what the card said before the money moved.
    receiptFootnote:
      'Keep your payment confirmation. Without an account OrangeCat does not record who paid.',
    noun: terms.noun,
  };
}

export function PublicSupportPanel({
  entityType,
  entityId,
  entityTitle,
  recipientName,
  bounds = null,
  title,
}: PublicSupportPanelProps) {
  const words = {
    ...supportCardWords(entityType, entityTitle, recipientName),
    ...(title && { title }),
  };
  const range = contributionRange(bounds);
  const [amountBtc, setAmountBtc] = useChosenAmountBtc(range);
  const { formatAmountBtc } = useDisplayCurrency();
  const payment = usePublicPayment();
  const statedTerms = [
    bounds?.minBtc ? `Minimum ${formatAmountBtc(bounds.minBtc)}` : null,
    bounds?.maxBtc ? `Maximum ${formatAmountBtc(bounds.maxBtc)}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const amountReady =
    Number.isFinite(amountBtc) && amountBtc >= range.minBtc && amountBtc <= range.maxBtc;

  const createIntent = () =>
    payment.start(() =>
      fetch(`${PUBLIC_API_BASE}/payments/public`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          entity_type: entityType,
          entity_id: entityId,
          amount_btc: amountBtc,
        }),
      })
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bitcoin className="h-5 w-5 text-bitcoinOrange" />
          {words.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {payment.phase === 'choose' && (
          <>
            <p className="text-sm text-fg-secondary">
              {words.intro}
              {statedTerms && (
                <span className="mt-1 block font-medium text-fg-primary">{statedTerms}</span>
              )}
            </p>
            {range.unpayable ? (
              <p className="text-sm text-fg-primary">
                This minimum is more than one online payment can be ({formatAmountBtc(range.maxBtc)}
                ), so this {words.noun} cannot be paid here. Ask the owner how to take part.
              </p>
            ) : (
              <>
                <AmountField
                  value={amountBtc}
                  onChange={setAmountBtc}
                  minBtc={range.minBtc}
                  maxBtc={range.maxBtc}
                  label="How much"
                />
                <Button onClick={createIntent} disabled={!amountReady} className="w-full">
                  {amountReady
                    ? PAYMENT_FLOW_COPY.action(words.act, formatAmountBtc(amountBtc))
                    : PAYMENT_FLOW_COPY.enterAmount}
                </Button>
              </>
            )}
            <p className="text-center text-xs text-fg-tertiary">{words.custody}</p>
          </>
        )}

        <PublicPaymentProgress
          payment={payment}
          confirmationNote="They confirm this Lightning Address payment by hand before it counts in the public funding total. You do not need to pay again."
        />

        {payment.phase === 'paid' && payment.intent && (
          <MoneyReceipt
            title={PAYMENT_FLOW_COPY.paidTitle}
            amountBtc={payment.intent.payment_intent.amount_btc}
            counterparty={recipientName?.trim() || null}
            note={receiptNote(entityTitle, recipientName)}
            footnote={words.receiptFootnote}
          />
        )}
      </CardContent>
    </Card>
  );
}
