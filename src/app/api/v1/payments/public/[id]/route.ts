import { apiBadRequest, apiNotFound, apiRateLimited, apiSuccess } from '@/lib/api/standardResponse';
import { acknowledgePublicPayment, checkPublicPaymentStatus } from '@/domain/payments';
import { publicPaymentActionSchema } from '@/lib/validation/finance';
import { validateUUID, getValidationError } from '@/lib/api/validation';
import { rateLimitPaymentClaim, rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { clientIpKey } from '@/lib/client-ip';

// Same per-IP keying as ../route.ts — anonymous callers, so IP is the only handle.
function requestKey(request: Request): string {
  return `public-payment-action:${clientIpKey(request)}`;
}

function readToken(request: Request): string | null {
  const token = request.headers.get('x-payment-token');
  return token && token.length >= 32 && token.length <= 128 ? token : null;
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const idError = getValidationError(validateUUID(id, 'payment ID'));
  if (idError) {
    return idError;
  }
  const token = readToken(request);
  if (!token) {
    return apiNotFound('Payment not found');
  }

  try {
    return apiSuccess(await checkPublicPaymentStatus(id, token), { cache: 'NONE' });
  } catch {
    return apiNotFound('Payment not found');
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const limit = await rateLimitWriteAsync(requestKey(request));
  if (!limit.success) {
    return apiRateLimited(
      'Too many payment requests. Please try again shortly.',
      retryAfterSeconds(limit)
    );
  }

  const { id } = await context.params;
  const idError = getValidationError(validateUUID(id, 'payment ID'));
  if (idError) {
    return idError;
  }
  const token = readToken(request);
  if (!token) {
    return apiNotFound('Payment not found');
  }

  const parsed = publicPaymentActionSchema.safeParse(await request.json());
  if (!parsed.success) {
    return apiBadRequest('Invalid payment action', parsed.error.issues);
  }

  try {
    // The recipient-side budget lives here, in the HTTP layer that owns
    // policy; the domain decides only WHEN to ask (once, on the real
    // transition). See ClaimGuard in paymentStatusFlow.
    const claimGuard = async (entityType: string, entityId: string) =>
      (await rateLimitPaymentClaim(entityType, entityId)).success;

    return apiSuccess(await acknowledgePublicPayment(id, token, claimGuard), { cache: 'NONE' });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('automatically')) {
      return apiBadRequest('This payment is confirmed automatically.');
    }
    if (message.includes('expired')) {
      return apiBadRequest('This payment request has expired.');
    }
    if (message.includes('Too many payment claims')) {
      return apiRateLimited(
        'This recipient has received too many payment claims right now. Try again shortly.'
      );
    }
    return apiNotFound('Payment not found');
  }
}
