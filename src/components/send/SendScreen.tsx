'use client';

/**
 * SendScreen — the outbound half of money on OrangeCat (/send).
 *
 * One field. It reads a username, a Lightning address, an invoice, or a code
 * from a camera (someone's Receive QR, a wallet's `lightning:` QR) and says
 * what it found before an amount is asked for. The person/invoice switch this
 * replaces was a second row of tabs under the first; the text already says
 * which it is.
 *
 * Both paths obey the same rule: nothing is spent until the payer has been
 * shown, in words, exactly what is about to happen.
 *  - A person gets a review step, because you typed both the name and the
 *    amount and either could be wrong.
 *  - An invoice shows its amount before the confirm button appears and needs
 *    no review step — you typed nothing to get it wrong, and an extra tap
 *    confirming a single fact already on screen is ceremony, not safety. An
 *    invoice with no amount is refused rather than paid blind.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { MoneyLoading, MoneyPage } from '@/components/money/MoneyPage';
import { MoneyReceipt } from '@/components/money/MoneyReceipt';
import { StatusNote } from '@/components/money/StatusNote';
import { AmountField } from '@/components/money/AmountField';
import { MoneyActionBar } from '@/components/money/MoneyActionBar';
import { OptionalNoteField } from '@/components/money/OptionalNoteField';
import { RecipientStatus } from '@/components/send/RecipientStatus';
import { SendDestinationField } from '@/components/send/SendDestinationField';
import { SendReviewStep } from '@/components/send/SendReviewStep';
import { useRecipientCheck } from '@/components/send/useRecipientCheck';
import { useRequireAuth } from '@/hooks/useAuth';
import { useDisplayCurrency } from '@/hooks/useDisplayCurrency';
import {
  sendInvoice,
  sendToPerson,
  fetchSendCapability,
  type SendOutcome,
  type SendCapability,
} from '@/services/send/send-client';
import { parseBolt11 } from '@/lib/bitcoin/bolt11';
import { classifyDestination } from '@/lib/payments/send-destination';
import { haptic } from '@/lib/haptics';
import { SEND_COPY, SEND_NOTE_MAX_LENGTH } from '@/config/send';
import { PAY_MAX_BTC, PAY_MIN_BTC } from '@/config/pay';
import { ROUTES } from '@/config/routes';

export function SendScreen() {
  const { isLoading: authLoading } = useRequireAuth();
  const { formatAmountBtc } = useDisplayCurrency();

  const [raw, setRaw] = useState('');
  // Empty until typed. A prefilled amount is a payment the person did not choose —
  // unless it came in a code they scanned, which is the other person's ask.
  const [amount, setAmount] = useState(0);
  const [memo, setMemo] = useState('');

  const [capability, setCapability] = useState<SendCapability | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<SendOutcome | null>(null);

  // Asked once, before the form is offered — see fetchSendCapability.
  useEffect(() => {
    let active = true;
    void fetchSendCapability().then(c => active && setCapability(c));
    return () => {
      active = false;
    };
  }, []);

  const destination = useMemo(() => classifyDestination(raw), [raw]);
  const recipientHandle =
    destination.kind === 'username'
      ? destination.username
      : destination.kind === 'address'
        ? destination.address
        : '';
  const recipientCheck = useRecipientCheck(recipientHandle);

  // A scanned pay link carries what the other person asked for.
  useEffect(() => {
    if (destination.kind === 'username' && destination.amountBtc) {
      setAmount(destination.amountBtc);
      setMemo(destination.note ?? '');
    }
  }, [destination]);

  // Read locally so the payer sees the figure before committing to it.
  const parsedInvoice = useMemo(
    () => (destination.kind === 'invoice' ? parseBolt11(destination.invoice) : null),
    [destination]
  );
  const invoiceAmount = parsedInvoice?.amountBtc ?? null;
  const invoiceIsPayable = parsedInvoice?.network === 'mainnet' && invoiceAmount !== null;
  const isInvoice = destination.kind === 'invoice';

  const reset = useCallback(() => {
    setOutcome(null);
    setError(null);
    setRaw('');
    setMemo('');
    setAmount(0);
    setReviewing(false);
  }, []);

  const handleSend = useCallback(async () => {
    setSending(true);
    setError(null);
    try {
      setOutcome(
        destination.kind === 'invoice'
          ? await sendInvoice(destination.invoice)
          : await sendToPerson(recipientHandle, amount, memo || undefined)
      );
    } catch (e) {
      haptic('error');
      setReviewing(false);
      setError(e instanceof Error ? e.message : 'The payment did not go through.');
    } finally {
      setSending(false);
    }
  }, [destination, recipientHandle, amount, memo]);

  if (authLoading || !capability) {
    return <MoneyLoading />;
  }

  // Nothing on this screen can work without a wallet to spend from, so say so
  // instead of rendering a form that ends in a refusal. "Connect a wallet" is
  // the right ask only when the wallet is the problem; when our key is missing,
  // sending them to set one up blames them for our outage.
  if (!capability.canSend) {
    const oursNotTheirs = capability.reason === 'sending_unavailable';
    return (
      <MoneyPage
        title={oursNotTheirs ? SEND_COPY.unavailableTitle : SEND_COPY.noWalletTitle}
        subtitle={capability.message ?? SEND_COPY.noWalletBody}
      >
        {!oursNotTheirs && (
          <Button variant="primary" href={ROUTES.DASHBOARD.WALLETS}>
            {SEND_COPY.noWalletCta}
          </Button>
        )}
      </MoneyPage>
    );
  }

  if (outcome) {
    return (
      <MoneyPage title={SEND_COPY.title} subtitle={SEND_COPY.subtitle}>
        <MoneyReceipt
          title={SEND_COPY.sentTitle}
          amountBtc={outcome.amountBtc}
          counterparty={outcome.destination === 'invoice' ? null : outcome.destination}
          counterpartyLabel={SEND_COPY.reviewTo}
          note={memo || null}
          fallbackBody={SEND_COPY.sentFallback}
        >
          <Button variant="primary" onClick={reset}>
            {SEND_COPY.again}
          </Button>
        </MoneyReceipt>
      </MoneyPage>
    );
  }

  const canReview = isInvoice ? invoiceIsPayable : recipientCheck.payable && amount > 0;

  return (
    <MoneyPage title={SEND_COPY.title} subtitle={SEND_COPY.subtitle}>
      {reviewing ? (
        <SendReviewStep
          recipientName={recipientCheck.name ?? recipientHandle}
          amountLabel={formatAmountBtc(amount)}
          note={memo}
          sending={sending}
          onBack={() => setReviewing(false)}
          onConfirm={handleSend}
          error={error}
        />
      ) : (
        <div className="space-y-4">
          <SendDestinationField
            value={raw}
            onChange={next => {
              setRaw(next);
              setError(null);
            }}
            suggestPeople={destination.kind === 'username' && !/^https?:/i.test(raw)}
          />

          {isInvoice ? (
            <StatusNote tone={invoiceIsPayable ? 'neutral' : 'warning'}>
              {invoiceIsPayable
                ? SEND_COPY.invoiceReads(formatAmountBtc(invoiceAmount as number))
                : parsedInvoice && parsedInvoice.network !== 'mainnet'
                  ? SEND_COPY.invoiceWrongNetwork(parsedInvoice.network)
                  : SEND_COPY.invoiceUnreadable}
            </StatusNote>
          ) : (
            <RecipientStatus check={recipientCheck} handle={recipientHandle} />
          )}

          {!isInvoice && recipientCheck.payable && (
            <>
              <AmountField
                value={amount}
                onChange={setAmount}
                minBtc={PAY_MIN_BTC}
                maxBtc={PAY_MAX_BTC}
              />
              <OptionalNoteField
                value={memo}
                onChange={setMemo}
                maxLength={SEND_NOTE_MAX_LENGTH}
                label={SEND_COPY.memoLabel}
                addLabel={SEND_COPY.memoAdd}
                placeholder={SEND_COPY.memoPlaceholder}
              />
            </>
          )}

          {error && <p className="text-sm text-status-negative">{error}</p>}
          <p className="text-center text-xs text-fg-tertiary">{SEND_COPY.disclaimer}</p>

          <MoneyActionBar>
            <Button
              variant="primary"
              className="w-full"
              onClick={() => (isInvoice ? void handleSend() : setReviewing(true))}
              disabled={!canReview || sending}
              isLoading={sending}
            >
              {sending ? SEND_COPY.sending : isInvoice ? SEND_COPY.confirm : SEND_COPY.review}
            </Button>
          </MoneyActionBar>
        </div>
      )}
    </MoneyPage>
  );
}
