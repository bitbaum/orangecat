'use client';

/**
 * SendScreen — the outbound half of money on OrangeCat (/send).
 *
 * Two entry points, matching the two ways you actually get asked for money:
 * a person (username or Lightning address) or an invoice someone handed you.
 *
 * Both paths obey the same rule: nothing is spent until the payer has been
 * shown, in words, exactly what is about to happen.
 *  - The person path resolves the recipient while you type and then puts a
 *    review step in front of the send, because you typed both the name and the
 *    amount and either could be wrong.
 *  - The invoice path reads the amount locally and shows it before the confirm
 *    button appears. It needs no review step — you typed nothing to get it
 *    wrong, and an extra tap confirming a single fact already on screen is
 *    ceremony, not safety. An invoice with no amount is refused outright rather
 *    than paid blind.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { MoneyLoading, MoneyPage } from '@/components/money/MoneyPage';
import { MoneyReceipt } from '@/components/money/MoneyReceipt';
import { StatusNote } from '@/components/money/StatusNote';
import { AmountField } from '@/components/money/AmountField';
import { MoneyActionBar } from '@/components/money/MoneyActionBar';
import { RecipientStatus } from '@/components/send/RecipientStatus';
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
import { haptic } from '@/lib/haptics';
import { SEND_COPY, SEND_NOTE_MAX_LENGTH } from '@/config/send';
import { PAY_MAX_BTC, PAY_MIN_BTC } from '@/config/pay';
import { ROUTES } from '@/config/routes';

type Tab = 'person' | 'invoice';

const TABS = [
  { value: 'person' as const, label: SEND_COPY.personTab },
  { value: 'invoice' as const, label: SEND_COPY.invoiceTab },
];

export function SendScreen() {
  const { isLoading: authLoading } = useRequireAuth();
  const { formatAmountBtc } = useDisplayCurrency();

  const [tab, setTab] = useState<Tab>('person');
  const [recipient, setRecipient] = useState('');
  // Empty until typed. A prefilled amount is a payment the person did not choose.
  const [amount, setAmount] = useState(0);
  const [memo, setMemo] = useState('');
  const [invoice, setInvoice] = useState('');

  const [capability, setCapability] = useState<SendCapability | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<SendOutcome | null>(null);

  // Asked once, before the form is offered — see fetchSendCapability.
  useEffect(() => {
    let active = true;
    void fetchSendCapability().then(c => {
      if (active) {
        setCapability(c);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const recipientCheck = useRecipientCheck(tab === 'person' ? recipient : '');

  // Read locally so the payer sees the figure before committing to it.
  const parsedInvoice = useMemo(() => (invoice.trim() ? parseBolt11(invoice) : null), [invoice]);
  const invoiceAmount = parsedInvoice?.amountBtc ?? null;
  const invoiceIsPayable = parsedInvoice?.network === 'mainnet' && invoiceAmount !== null;

  const reset = useCallback(() => {
    setOutcome(null);
    setError(null);
    setInvoice('');
    setRecipient('');
    setMemo('');
    setReviewing(false);
  }, []);

  const handleSend = useCallback(async () => {
    setSending(true);
    setError(null);
    try {
      setOutcome(
        tab === 'invoice'
          ? await sendInvoice(invoice)
          : await sendToPerson(recipient, amount, memo || undefined)
      );
    } catch (e) {
      haptic('error');
      setReviewing(false);
      setError(e instanceof Error ? e.message : 'The payment did not go through.');
    } finally {
      setSending(false);
    }
  }, [tab, invoice, recipient, amount, memo]);

  if (authLoading || !capability) {
    return <MoneyLoading />;
  }

  // Nothing on this screen can work without a wallet to spend from, so say so
  // instead of rendering a form that ends in a refusal.
  if (!capability.canSend) {
    // "Connect a wallet" is the right ask only when the wallet is the problem.
    // When it's our key that's missing, their wallet is already connected and
    // sending them to set one up blames them for our outage.
    const oursNotTheirs = capability.reason === 'sending_unavailable';
    return (
      <MoneyPage
        title={oursNotTheirs ? SEND_COPY.unavailableTitle : SEND_COPY.noWalletTitle}
        subtitle={capability.message ?? SEND_COPY.noWalletBody}
        icon={Wallet}
      >
        {!oursNotTheirs && (
          <Button variant="accent" href={ROUTES.DASHBOARD.WALLETS}>
            {SEND_COPY.noWalletCta}
          </Button>
        )}
      </MoneyPage>
    );
  }

  if (outcome) {
    return (
      <MoneyPage title={SEND_COPY.title} subtitle={SEND_COPY.subtitle} icon={ArrowUpRight}>
        <MoneyReceipt
          title={SEND_COPY.sentTitle}
          amountBtc={outcome.amountBtc}
          counterparty={outcome.destination === 'invoice' ? null : outcome.destination}
          counterpartyLabel={SEND_COPY.reviewTo}
          note={memo || null}
          fallbackBody={SEND_COPY.sentFallback}
        >
          <Button variant="accent" onClick={reset}>
            {SEND_COPY.again}
          </Button>
        </MoneyReceipt>
      </MoneyPage>
    );
  }

  const canReview = tab === 'invoice' ? invoiceIsPayable : recipientCheck.payable && amount > 0;

  return (
    <MoneyPage title={SEND_COPY.title} subtitle={SEND_COPY.subtitle} icon={ArrowUpRight}>
      {reviewing ? (
        <SendReviewStep
          recipientName={recipientCheck.name ?? recipient}
          amountLabel={formatAmountBtc(amount)}
          note={memo}
          sending={sending}
          onBack={() => setReviewing(false)}
          onConfirm={handleSend}
          error={error}
        />
      ) : (
        <>
          <SegmentedControl
            label="Send method"
            items={TABS}
            value={tab}
            onChange={value => {
              setTab(value);
              setError(null);
            }}
          />

          <div className="mt-6 space-y-4">
            {tab === 'person' ? (
              <>
                <Input
                  label={SEND_COPY.recipientLabel}
                  value={recipient}
                  onChange={e => setRecipient(e.target.value)}
                  placeholder={SEND_COPY.recipientPlaceholder}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="min-h-11"
                />

                <RecipientStatus check={recipientCheck} handle={recipient} />

                <AmountField
                  value={amount}
                  onChange={setAmount}
                  minBtc={PAY_MIN_BTC}
                  maxBtc={PAY_MAX_BTC}
                />

                <Input
                  label={SEND_COPY.memoLabel}
                  value={memo}
                  onChange={e => setMemo(e.target.value.slice(0, SEND_NOTE_MAX_LENGTH))}
                  placeholder={SEND_COPY.memoPlaceholder}
                  className="min-h-11"
                />
              </>
            ) : (
              <>
                <Textarea
                  label={SEND_COPY.invoiceLabel}
                  value={invoice}
                  onChange={e => setInvoice(e.target.value)}
                  placeholder={SEND_COPY.invoicePlaceholder}
                  rows={4}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="resize-none font-mono text-xs"
                />

                {invoice.trim() && (
                  <StatusNote tone={invoiceIsPayable ? 'neutral' : 'warning'}>
                    {invoiceIsPayable
                      ? SEND_COPY.invoiceReads(formatAmountBtc(invoiceAmount as number))
                      : parsedInvoice && parsedInvoice.network !== 'mainnet'
                        ? SEND_COPY.invoiceWrongNetwork(parsedInvoice.network)
                        : SEND_COPY.invoiceUnreadable}
                  </StatusNote>
                )}
              </>
            )}

            {error && <p className="text-sm text-status-negative">{error}</p>}
            <p className="text-center text-xs text-fg-tertiary">{SEND_COPY.disclaimer}</p>

            <MoneyActionBar>
              <Button
                variant="accent"
                className="w-full"
                onClick={() => (tab === 'invoice' ? void handleSend() : setReviewing(true))}
                disabled={!canReview || sending}
                isLoading={sending}
              >
                {sending
                  ? SEND_COPY.sending
                  : tab === 'invoice'
                    ? SEND_COPY.confirm
                    : SEND_COPY.review}
              </Button>
            </MoneyActionBar>
          </div>
        </>
      )}
    </MoneyPage>
  );
}
