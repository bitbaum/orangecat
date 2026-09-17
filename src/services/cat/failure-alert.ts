/**
 * Tell the operator when a user's Cat turn failed outright.
 *
 * Until now a total provider-chain failure was logged server-side and shown to
 * the user, and that was all — nobody was told. The only standing signal was
 * the nightly eval, which runs against a test account and can pass at 03:00
 * while real users are being turned away at noon. Six real accounts were failed
 * in June 2026 and nothing surfaced it; see failed-turn.ts.
 *
 * The coalescing — one unread row per failure CODE, bumping `occurrences` —
 * now lives in `ops-alert.ts`, because the health check needs the same rules
 * and a second copy of them is a second thing to drift.
 */
import { getAdminClient } from '@/lib/supabase/admin';
import { DATABASE_TABLES } from '@/config/database-tables';
import { logger } from '@/utils/logger';
import { alertOps } from './ops-alert';

const SOURCE = 'cat/chat';

interface FailureAlertParams {
  /** Whose turn failed. Resolved to a username so the alert can be triaged. */
  userId: string;
  /** Structured error code already shown to the client (e.g. ALL_PROVIDERS_DOWN). */
  code: string;
  provider?: string;
  model?: string;
}

function describe(username: string | null, { code, provider, model }: FailureAlertParams): string {
  const who = username ? `@${username}` : 'someone';
  const link = [provider, model].filter(Boolean).join('/');
  return `${who} asked Cat something and got nothing back (${code}${link ? ` on ${link}` : ''}).`;
}

/**
 * Fire-and-forget. Never throws and never blocks the response: a chat that
 * already failed must not fail differently because the alert could not be
 * written.
 */
export async function alertCatChatFailure(params: FailureAlertParams): Promise<void> {
  try {
    const supabase = getAdminClient();

    // Name the person. "someone got nothing back" cannot be triaged: the whole
    // question this alert exists to answer is whether a REAL user was turned
    // away or whether it was our own eval / founder account. One indexed
    // lookup, on a request that has already failed.
    const { data: profile } = await supabase
      .from(DATABASE_TABLES.PROFILES)
      .select('username')
      .eq('id', params.userId)
      .maybeSingle();

    const message = describe(profile?.username ?? null, params);

    await alertOps({
      code: params.code,
      message,
      source: SOURCE,
      metadata: {
        provider: params.provider ?? null,
        model: params.model ?? null,
        lastFailedUserId: params.userId,
      },
    });
  } catch (err) {
    logger.warn('Failed to raise Cat failure alert', { err }, 'cat/chat');
  }
}
