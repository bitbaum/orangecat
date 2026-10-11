/**
 * Buy a ticket without an account (Bitcoin).
 *
 * POST { name } — mints a Bitcoin invoice on the organizer's own wallet for the
 * event's price. The response carries the QR and a status token; the guest
 * polls /api/v1/payments/public/[intent] with it, and once the payment settles
 * that poll returns the ticket page, which is the guest's ticket.
 */
import { NextRequest } from 'next/server';
import {
  apiBadRequest,
  apiError,
  apiInternalError,
  apiRateLimited,
  apiSuccess,
} from '@/lib/api/standardResponse';
import {
  GuestTicketPurchaseError,
  initiateGuestTicketPurchase,
} from '@/domain/payments/guestTicketPurchase';
import { createPublicClient } from '@/lib/supabase/public';
import {
  rateLimitPaymentRecipient,
  rateLimitWriteAsync,
  retryAfterSeconds,
} from '@/lib/rate-limit';
import { clientIpKey } from '@/lib/client-ip';
import { logger } from '@/utils/logger';

type Ctx = { params: Promise<{ id: string }> };

/** Invoice failures a guest can act on; anything else is ours. */
const SAFE_INVOICE_ERRORS: Array<[string, string]> = [
  ['outside allowed range', 'The ticket price is outside what the organizer’s wallet accepts.'],
  ['LNURL', 'The organizer’s Lightning Address could not create an invoice. Try again later.'],
];

export async function POST(request: NextRequest, { params }: Ctx) {
  const limit = await rateLimitWriteAsync(`guest-ticket-purchase:${clientIpKey(request)}`);
  if (!limit.success) {
    return apiRateLimited('Too many tries. Please wait a moment.', retryAfterSeconds(limit));
  }

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { name?: unknown } | null;
  if (typeof body?.name !== 'string') {
    return apiBadRequest('Tell the host your name');
  }

  // Before the invoice: minting one goes through the organizer's wallet, and
  // per-IP alone leaves it open to someone rotating addresses.
  const recipientLimit = await rateLimitPaymentRecipient('event', id);
  if (!recipientLimit.success) {
    return apiRateLimited(
      'This event is receiving too many payment requests right now. Please try again shortly.',
      retryAfterSeconds(recipientLimit)
    );
  }

  try {
    const result = await initiateGuestTicketPurchase(createPublicClient(), {
      eventId: id,
      name: body.name,
    });
    return apiSuccess(result, { status: 201, cache: 'NONE' });
  } catch (error) {
    if (error instanceof GuestTicketPurchaseError) {
      return apiError(error.message, 'TICKET_PURCHASE', error.status);
    }
    const message = error instanceof Error ? error.message : '';
    logger.error('Guest ticket purchase failed', { eventId: id, error: message });
    for (const [pattern, safe] of SAFE_INVOICE_ERRORS) {
      if (message.toLowerCase().includes(pattern.toLowerCase())) {
        return apiBadRequest(safe);
      }
    }
    return apiInternalError('Could not create the Bitcoin payment request.');
  }
}
