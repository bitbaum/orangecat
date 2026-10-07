/**
 * The one way an event-payout route answers: a PayoutError becomes the
 * status that matches it, anything else is logged and a 500.
 */
import { apiError, apiSuccess } from '@/lib/api/standardResponse';
import { PayoutError, type EventPayout } from '@/domain/events/payouts';
import { logger } from '@/utils/logger';

const STATUS_FOR: Record<PayoutError['code'], number> = {
  forbidden: 403,
  not_found: 404,
  invalid: 400,
  already: 409,
  send_failed: 402,
};

export async function payoutResponse(run: () => Promise<EventPayout>, what: string) {
  try {
    return apiSuccess({ payout: await run() }, { status: 201 });
  } catch (error) {
    if (error instanceof PayoutError) {
      return apiError(error.message, error.code.toUpperCase(), STATUS_FOR[error.code]);
    }
    logger.error(`Event ${what} failed`, error, 'EventPayouts');
    return apiError(`Could not complete the ${what}`, 'PAYOUT_FAILED', 500);
  }
}
