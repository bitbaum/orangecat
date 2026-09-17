import { parseL402Authorization } from '@/domain/payments/l402-codec';
import { handleL402Challenge, handleL402Verify } from '@/lib/api/l402-handlers';

/**
 * GET /api/v1/pay/{entity_type}/{entity_id}?amount_btc=X — HTTP 402 inline payment.
 *
 * The standards-shaped face of the machine-payable flow (L402-style, see
 * domain/payments/l402.ts): no account, no API key —
 *   1. GET without Authorization → 402 Payment Required, WWW-Authenticate
 *      carries `token` + Lightning `invoice`; body mirrors the challenge.
 *   2. Pay the invoice with any Lightning wallet.
 *   3. GET again with `Authorization: L402 <token>:<preimage>` → 200 receipt
 *      (preimage verified against the invoice's payment_hash; settlement
 *      status is the fallback for on-chain).
 *
 * The JSON-contract flow (POST /api/v1/payments + polling) remains the
 * account-based sibling; this one exists so foreign agents that only speak
 * 402 can pay without learning our dialect.
 *
 * Both branches live in lib/api/l402-handlers — they carry different rate
 * budgets and different failure surfaces, and neither is the route's business.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ entity_type: string; entity_id: string }> }
) {
  const { entity_type, entity_id } = await params;
  const target = { entityType: entity_type, entityId: entity_id };

  // Retry-with-proof first: a caller holding credentials is answering a
  // challenge we already issued, not asking for a new one.
  const creds = parseL402Authorization(request.headers.get('authorization'));
  return creds ? handleL402Verify(creds, target) : handleL402Challenge(request, target);
}
