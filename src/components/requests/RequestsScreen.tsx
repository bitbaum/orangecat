'use client';

/**
 * RequestsScreen — asking a specific person for money, and seeing what's open.
 *
 * The third face of the money surface. Unlike a pay link (which anyone can use)
 * a request is addressed: the other person is notified and can pay in one tap
 * or decline. Nothing is charged — the copy says so, because an "ask" that
 * looked like a charge would be the fastest way to lose someone's trust.
 *
 * Every row names the other person. An earlier version listed bare amounts and
 * statuses, which is unreadable: "0.0005 BTC · Pending" gives you nothing to
 * decide with. And an incoming request now carries the Pay button itself, so
 * the answer to "someone asked me for money" doesn't depend on still having
 * their notification.
 */

import { useCallback, useEffect, useState } from 'react';
import { HandCoins, Inbox, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { MoneyLoading, MoneyPage } from '@/components/money/MoneyPage';
import { MoneyReceipt } from '@/components/money/MoneyReceipt';
import { AmountField } from '@/components/money/AmountField';
import { RequestList } from '@/components/requests/RequestList';
import { PayerStatus, isRequestablePayer } from '@/components/requests/PayerStatus';
import { useRecipientCheck } from '@/components/send/useRecipientCheck';
import { useRequireAuth } from '@/hooks/useAuth';
import {
  createRequest,
  closeRequest,
  fetchPaymentRequests,
  type PaymentRequestRow,
} from '@/services/payment-requests/request-client';
import { REQUEST_COPY, REQUEST_NOTE_MAX_LENGTH } from '@/config/payment-requests';
import { PAY_MAX_BTC, PAY_MIN_BTC } from '@/config/pay';
import { DEFAULT_TIP_BTC } from '@/config/tips';
import { haptic } from '@/lib/haptics';

interface SentRequest {
  name: string;
  amountBtc: number;
  note: string | null;
}

export function RequestsScreen() {
  const { user, isLoading: authLoading } = useRequireAuth();

  const [loading, setLoading] = useState(true);
  const [incoming, setIncoming] = useState<PaymentRequestRow[]>([]);
  const [outgoing, setOutgoing] = useState<PaymentRequestRow[]>([]);

  const [payer, setPayer] = useState('');
  const payerCheck = useRecipientCheck(payer);
  const [amount, setAmount] = useState(DEFAULT_TIP_BTC);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<SentRequest | null>(null);

  const load = useCallback(() => {
    fetchPaymentRequests()
      .then(({ incoming: i, outgoing: o }) => {
        setIncoming(i);
        setOutgoing(o);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (user?.id) {
      load();
    }
  }, [user?.id, load]);

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    setError(null);
    try {
      const request = await createRequest(payer, amount, note || undefined);
      setSent({
        name: request.counterparty_name ?? `@${payer.replace(/^@/, '')}`,
        amountBtc: amount,
        note: note || null,
      });
      setPayer('');
      setNote('');
      load();
    } catch (e) {
      haptic('error');
      setError(e instanceof Error ? e.message : 'Could not create that request.');
    } finally {
      setSubmitting(false);
    }
  }, [payer, amount, note, load]);

  const handleClose = useCallback(
    async (id: string, status: 'cancelled' | 'declined') => {
      // Optimistic: the row reflects the decision immediately, because the user
      // just made it and a spinner on their own choice reads as hesitation.
      const revert = { incoming, outgoing };
      const settle = (rows: PaymentRequestRow[]) =>
        rows.map(r => (r.id === id ? { ...r, status } : r));
      setIncoming(settle(incoming));
      setOutgoing(settle(outgoing));

      try {
        await closeRequest(id, status);
        toast.success(status === 'declined' ? REQUEST_COPY.declined : REQUEST_COPY.cancelled);
      } catch (e) {
        setIncoming(revert.incoming);
        setOutgoing(revert.outgoing);
        haptic('error');
        toast.error(e instanceof Error ? e.message : 'Could not update that request.');
      }
    },
    [incoming, outgoing]
  );

  if (authLoading || loading) {
    return <MoneyLoading />;
  }

  if (sent) {
    return (
      <MoneyPage title={REQUEST_COPY.title} subtitle={REQUEST_COPY.subtitle} icon={HandCoins}>
        <MoneyReceipt
          title={REQUEST_COPY.sent}
          amountBtc={sent.amountBtc}
          counterparty={sent.name}
          counterpartyLabel="From"
          note={sent.note}
          fallbackBody={REQUEST_COPY.sentBody(sent.name)}
        >
          <Button variant="outline" onClick={() => setSent(null)}>
            {REQUEST_COPY.submit}
          </Button>
        </MoneyReceipt>
      </MoneyPage>
    );
  }

  return (
    <MoneyPage title={REQUEST_COPY.title} subtitle={REQUEST_COPY.subtitle} icon={HandCoins}>
      <div className="space-y-4">
        <Input
          label={REQUEST_COPY.payerLabel}
          value={payer}
          onChange={e => setPayer(e.target.value)}
          placeholder={REQUEST_COPY.payerPlaceholder}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="min-h-11"
        />

        <PayerStatus check={payerCheck} handle={payer} />

        <AmountField
          value={amount}
          onChange={setAmount}
          minBtc={PAY_MIN_BTC}
          maxBtc={PAY_MAX_BTC}
        />

        <Input
          label={REQUEST_COPY.noteLabel}
          value={note}
          onChange={e => setNote(e.target.value.slice(0, REQUEST_NOTE_MAX_LENGTH))}
          placeholder={REQUEST_COPY.notePlaceholder}
          className="min-h-11"
        />

        {error && <p className="text-sm text-status-negative">{error}</p>}
        <p className="text-center text-xs text-fg-tertiary">{REQUEST_COPY.disclaimer}</p>

        <Button
          variant="accent"
          className="w-full"
          onClick={handleSubmit}
          disabled={submitting || !isRequestablePayer(payerCheck) || amount <= 0}
          isLoading={submitting}
        >
          {submitting ? REQUEST_COPY.submitting : REQUEST_COPY.submit}
        </Button>
      </div>

      <RequestList
        title={REQUEST_COPY.incomingTitle}
        emptyText={REQUEST_COPY.incomingEmpty}
        emptyIcon={Inbox}
        rows={incoming}
        direction="incoming"
        onClose={id => handleClose(id, 'declined')}
      />
      <RequestList
        title={REQUEST_COPY.outgoingTitle}
        emptyText={REQUEST_COPY.outgoingEmpty}
        emptyIcon={Send}
        rows={outgoing}
        direction="outgoing"
        onClose={id => handleClose(id, 'cancelled')}
      />
    </MoneyPage>
  );
}
