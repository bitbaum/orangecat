/**
 * Money in a conversation: what the Messenger's "+" offers besides files.
 *
 * Both actions are OrangeCat's existing, non-custodial flows; the Messenger
 * only gives them a place in the conversation they belong to.
 *
 * - "Send money" opens the other person's pay page.
 * - "Request money" makes a payment request (the same one /dashboard/wallet
 *   makes) and puts it in the conversation as a card. The person asked gets a
 *   Pay button tied to the request, so paying it marks it paid.
 */

import type { MessengerConversation } from '@bitbaum/chatkit/messenger';
import type { MessengerComposerAction } from '@bitbaum/chatkit/messenger';
import { API_ROUTES } from '@/config/api-routes';
import { REQUEST_NOTE_MAX_LENGTH } from '@/config/payment-requests';
import { ROUTES } from '@/config/routes';
import { apiErrorMessage } from '@/lib/api/errorMessage';
import { formatBTC, formatCurrency } from '@/services/currency/formatting';
import { PAYMENT_REQUEST_CARD } from './lib/messenger-mapping';

/** The one other person in a direct conversation, if that is what it is. An
 *  agent is not somebody to pay, and a group has no single person to ask. */
export function payablePerson(
  conversation: MessengerConversation,
  viewerId: string
): { id: string; handle: string; name: string } | null {
  const others = conversation.participants.filter(p => p.actorId !== viewerId);
  const [only] = others;
  if (others.length !== 1 || !only || only.kind === 'ai' || !only.handle) {
    return null;
  }
  return { id: only.actorId, handle: only.handle, name: only.name };
}

export function moneyActions(options: {
  viewerId: string;
  /** The currency the viewer thinks in ("CHF", "BTC"). */
  currency: string;
  navigate: (href: string) => void;
  /** Say that something did not work, in the app's own way (a toast). */
  onError: (message: string) => void;
}): MessengerComposerAction[] {
  const { viewerId, currency, navigate, onError } = options;
  const available = (conversation: MessengerConversation) =>
    payablePerson(conversation, viewerId) !== null;
  return [
    {
      id: 'send-money',
      label: 'Send money',
      detail: 'Opens their pay page',
      available,
      onPick: ({ conversation }) => {
        const person = payablePerson(conversation, viewerId);
        if (person) {
          navigate(ROUTES.PAY(person.handle));
        }
      },
    },
    {
      id: 'request-money',
      label: 'Request money',
      detail: 'They get a Pay button in this conversation',
      amount: { unit: currency, confirm: 'Request', noteMaxLength: REQUEST_NOTE_MAX_LENGTH },
      available,
      onPick: async ({ conversation, amount, note, send }) => {
        const person = payablePerson(conversation, viewerId);
        if (!person || !amount) {
          return;
        }
        try {
          const response = await fetch(API_ROUTES.PAYMENT_REQUESTS.BASE, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              payer_username: person.handle,
              ...(currency === 'BTC' ? { amount_btc: amount } : { ask: { amount, currency } }),
              ...(note ? { note } : {}),
            }),
          });
          const payload = await response.json().catch(() => null);
          if (!response.ok) {
            onError(apiErrorMessage(payload, 'Could not create that request.'));
            return;
          }
          const request = (payload?.data?.request ?? payload?.request) as
            { id: string } | undefined;
          if (!request?.id) {
            onError('Could not create that request.');
            return;
          }
          await send('', {
            kind: PAYMENT_REQUEST_CARD,
            title: 'Payment request',
            amount: currency === 'BTC' ? formatBTC(amount) : formatCurrency(amount, currency),
            ...(note ? { note } : {}),
            status: 'Waiting to be paid',
            tone: 'pending',
            data: { paymentRequestId: request.id },
          });
        } catch {
          onError('Could not create that request. Check your connection and try again.');
        }
      },
    },
  ];
}
