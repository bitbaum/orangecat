'use client';

/**
 * Buying a fixed-price listing without an account, as a real order.
 *
 * The buyer gives a name (and, if they like, how to reach them), and gets a
 * code for exactly the price, minted on the seller's own wallet. The order is
 * written with it, so once the payment lands the seller sees who bought and
 * the buyer has a receipt with the order's reference. It replaces the panel
 * that showed the seller's bare address and asked the buyer to type the price
 * into their wallet, which recorded nothing.
 *
 * An unpaid code is kept on this device, so closing the tab mid-payment comes
 * back to the same code; a paid order's reference is kept too.
 */

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Bitcoin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import { MoneyReceipt } from '@/components/money/MoneyReceipt';
import { PublicPaymentProgress } from './PublicPaymentProgress';
import { usePublicPayment } from '@/hooks/usePublicPayment';
import { useDisplayCurrency } from '@/hooks/useDisplayCurrency';
import { useDisplayDate } from '@/hooks/useDisplayDate';
import { API_ROUTES } from '@/config/api-routes';
import { GUEST_ORDER_NOTE_MAX, ORDER_COPY } from '@/config/orders';
import { PAYMENT_FLOW_COPY, payeeLine, receiptNote } from '@/config/payment-flow';
import { GUEST_NAME_MAX } from '@/domain/events/tickets';
import type { EntityType } from '@/config/entity-registry';

const pendingKey = (entityId: string) => `oc:guest-purchase:${entityId}`;
const receiptKey = (entityId: string) => `oc:guest-order:${entityId}`;

interface SavedReceipt {
  ref: string;
  at: string;
}

function readReceipt(entityId: string): SavedReceipt | null {
  try {
    const raw = window.localStorage.getItem(receiptKey(entityId));
    const saved = raw ? (JSON.parse(raw) as Partial<SavedReceipt>) : null;
    return saved?.ref && saved.at ? { ref: saved.ref, at: saved.at } : null;
  } catch {
    return null;
  }
}

export const GUEST_PURCHASE_COPY = {
  title: 'Buy with Bitcoin',
  noAccount: 'No account is required.',
  nameLabel: 'Your name',
  nameHint: 'So the seller knows who bought it.',
  noteLabel: 'How the seller reaches you',
  noteHint: 'An email, a handle, or where to send it. Only the seller sees this.',
  /** The receipt says what the seller now holds — nothing about delivery, which is theirs. */
  receipt: (ref: string | null, seller: string, hasNote: boolean) =>
    `${ref ? `${ORDER_COPY.ref(ref)}: keep this reference. ` : ''}${seller} has your name${hasNote ? ' and your note' : ''}.`,
  bought: (ref: string, date: string) => `You bought this on ${date}. ${ORDER_COPY.ref(ref)}.`,
  claimNote:
    'The seller confirms this Lightning Address payment by hand. Your order is recorded when they do; you do not need to pay again.',
  haveAccount: 'Have an account?',
  signIn: 'Sign in',
} as const;

interface GuestPurchasePanelProps {
  entityType: EntityType;
  entityId: string;
  entityTitle: string;
  /** Who is paid (the owner's name). */
  recipientName?: string | null;
  /** The price in the listing's own currency, as shown on the page. */
  priceAmount: number;
  priceCurrency?: string;
  signInHref: string;
}

export function GuestPurchasePanel({
  entityType,
  entityId,
  entityTitle,
  recipientName,
  priceAmount,
  priceCurrency,
  signInHref,
}: GuestPurchasePanelProps) {
  const { formatPrice } = useDisplayCurrency();
  const { formatDate } = useDisplayDate();
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [orderRef, setOrderRef] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedReceipt | null>(null);
  const seller = recipientName?.trim() || 'The seller';

  useEffect(() => {
    setSaved(readReceipt(entityId));
  }, [entityId]);

  const onPaid = useCallback(
    ({ order_ref: ref }: { order_ref?: string }) => {
      setOrderRef(ref ?? null);
      if (!ref) {
        return;
      }
      try {
        window.localStorage.setItem(
          receiptKey(entityId),
          JSON.stringify({ ref, at: new Date().toISOString() })
        );
      } catch {
        // Storage blocked: the receipt on screen is still the receipt.
      }
    },
    [entityId]
  );
  const payment = usePublicPayment({ resumeKey: pendingKey(entityId), onPaid });

  function submit(e: FormEvent) {
    e.preventDefault();
    void payment.start(() =>
      fetch(API_ROUTES.PAYMENTS.PUBLIC_PURCHASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_type: entityType,
          entity_id: entityId,
          name,
          note: note.trim() || null,
        }),
      })
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bitcoin className="h-5 w-5 text-bitcoinOrange" aria-hidden="true" />
          {GUEST_PURCHASE_COPY.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {payment.phase === 'choose' && (
          <>
            {saved && (
              <p className="rounded-md border border-subtle bg-surface-raised/40 px-3 py-2 text-sm text-fg-secondary">
                {GUEST_PURCHASE_COPY.bought(saved.ref, formatDate(saved.at))}
              </p>
            )}
            <p className="text-sm text-fg-secondary">
              {payeeLine(recipientName, entityTitle)} {GUEST_PURCHASE_COPY.noAccount}
            </p>
            <form onSubmit={submit} className="space-y-3">
              <Input
                label={GUEST_PURCHASE_COPY.nameLabel}
                name="name"
                autoComplete="name"
                required
                maxLength={GUEST_NAME_MAX}
                value={name}
                onChange={e => setName(e.target.value)}
                description={GUEST_PURCHASE_COPY.nameHint}
              />
              <Textarea
                label={GUEST_PURCHASE_COPY.noteLabel}
                name="note"
                rows={2}
                maxLength={GUEST_ORDER_NOTE_MAX}
                value={note}
                onChange={e => setNote(e.target.value)}
                description={GUEST_PURCHASE_COPY.noteHint}
              />
              <Button type="submit" className="w-full" disabled={!name.trim()}>
                {PAYMENT_FLOW_COPY.action('pay', formatPrice(priceAmount, priceCurrency))}
              </Button>
            </form>
            <p className="text-center text-xs text-fg-tertiary">{PAYMENT_FLOW_COPY.custody}</p>
            <p className="mb-0 text-center text-sm text-fg-secondary">
              {GUEST_PURCHASE_COPY.haveAccount}{' '}
              <Link
                href={signInHref}
                className="-my-3 inline-flex min-h-11 items-center underline underline-offset-4"
              >
                {GUEST_PURCHASE_COPY.signIn}
              </Link>
            </p>
          </>
        )}

        <PublicPaymentProgress
          payment={payment}
          fixedAmount
          confirmationNote={GUEST_PURCHASE_COPY.claimNote}
        />

        {payment.phase === 'paid' && payment.intent && (
          <MoneyReceipt
            title={PAYMENT_FLOW_COPY.paidTitle}
            amountBtc={payment.intent.payment_intent.amount_btc}
            counterparty={recipientName?.trim() || null}
            note={receiptNote(entityTitle, recipientName)}
            footnote={GUEST_PURCHASE_COPY.receipt(orderRef, seller, note.trim().length > 0)}
          />
        )}
      </CardContent>
    </Card>
  );
}
