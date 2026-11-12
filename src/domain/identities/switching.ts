/**
 * Switching between the identities of one circle (ADR-0014 D4): the only
 * place a session changes hands. The API route and the consent screen's
 * "Continue as" both go through switchSessionTo, so neither can skip the
 * circle check or exchange a code on its own.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/utils/logger';
import { circleForCaller, fail, type Caller, type IdentityResult } from './service';

/**
 * A one-time sign-in code for `targetId`, if the caller's circle contains it.
 *
 * GoTrue only generates the code here (admin generateLink sends nothing); the
 * route exchanges it on the caller's cookie-bound client, which replaces the
 * session. The same mechanism as sign-in by emailed code
 * (src/services/auth/emailCode.ts), minus the email.
 */
export async function mintSwitchCode(
  admin: SupabaseClient,
  caller: Caller,
  targetId: string
): Promise<IdentityResult<{ email: string; code: string }>> {
  const userId = caller.userId;
  const circle = await circleForCaller(admin, caller);
  // Never a switch to yourself, and never from a withheld circle. A withheld
  // identity's circle still lists itself; "switching" to itself minted a fresh
  // one-time-code session, which the gate then read as a switch, and handed a
  // password or passkey login the whole circle back (found in review). Here,
  // in the one function every switch goes through, so no caller can forget it.
  if (circle.withheld || targetId === userId) {
    logger.warn(
      'Identity switch refused: withheld or to itself',
      { userId, targetId },
      'Identities'
    );
    return fail('not_in_circle');
  }
  if (!circle.members.some(m => m.id === targetId)) {
    // Logged: outside the UI this is someone probing for another account.
    logger.warn(
      'Identity switch refused: target not in circle',
      { userId, targetId },
      'Identities'
    );
    return fail('not_in_circle');
  }

  const { data: target, error: targetError } = await admin.auth.admin.getUserById(targetId);
  const email = target?.user?.email;
  if (targetError || !email) {
    return fail(targetId === circle.holderId ? 'holder_needs_email' : 'failed');
  }

  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  const code = data?.properties?.email_otp;
  if (error || !code) {
    logger.error('Identity switch code refused', { code: error?.code, targetId }, 'Identities');
    return fail('failed');
  }
  return { ok: true, data: { email, code } };
}

/** What the caller's cookie-bound client must be able to do for a switch. */
interface SessionClient {
  auth: {
    verifyOtp(params: {
      email: string;
      token: string;
      type: 'email';
    }): Promise<{ error: { code?: string; message?: string } | null }>;
  };
}

/**
 * Replace the caller's session with one for `targetId`, if their circle
 * contains it. The one place a switch happens: the API route and the consent
 * screen's "Continue as" both call this, so neither can skip the circle check
 * or exchange a code on its own.
 */
export async function switchSessionTo(
  admin: SupabaseClient,
  session: SessionClient,
  caller: Caller,
  targetId: string
): Promise<IdentityResult<{ id: string }>> {
  const minted = await mintSwitchCode(admin, caller, targetId);
  if (!minted.ok) {
    return minted;
  }
  const { error } = await session.auth.verifyOtp({
    email: minted.data.email,
    token: minted.data.code,
    type: 'email',
  });
  if (error) {
    logger.error('Identity switch exchange failed', { code: error.code, targetId }, 'Identities');
    return fail('failed');
  }
  logger.info('Identity switched', { from: caller.userId, to: targetId }, 'Identities');
  return { ok: true, data: { id: targetId } };
}
