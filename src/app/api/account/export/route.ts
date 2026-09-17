/**
 * GET /api/account/export — download the user's data as JSON (data controls).
 *
 * GDPR / Swiss-DSG "export my data": one authenticated endpoint that returns
 * the personal data the platform stores about the requesting user, as a
 * downloadable JSON file. Reads go through the request-scoped (RLS) client, so
 * the export can only ever contain rows the user is allowed to see.
 *
 * Scope (listed in the manifest so the file is honest about coverage):
 * - profile, AI preferences, notification preferences
 * - Cat: conversations, messages, memories (content — embedding vectors are
 *   internal derivatives, not personal data), economic profile
 * - credit ledger: entries + top-ups
 * - user-to-user messages the USER sent (other participants' messages belong
 *   to them and are not exported)
 * Encrypted BYOK API keys are deliberately excluded.
 */

import { apiRateLimited, handleApiError } from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import { DATABASE_TABLES, OWN_PROFILE_VIEW } from '@/config/database-tables';
import { ACCOUNT_EXPORT_FILENAME } from '@/config/api-routes';
import type { AnySupabaseClient } from '@/lib/supabase/types';

async function rows(
  supabase: AnySupabaseClient,
  table: string,
  column: string,
  userId: string,
  select = '*'
): Promise<unknown[]> {
  const { data, error } = await supabase.from(table).select(select).eq(column, userId);
  if (error) {
    throw new Error(`Export failed reading ${table}: ${error.message}`);
  }
  return data ?? [];
}

export const GET = withAuth(async (request: AuthenticatedRequest) => {
  const { user, supabase } = request;

  // Heavy read — use the stricter write-tier limit to prevent hammering.
  const rl = await rateLimitWriteAsync(user.id);
  if (!rl.success) {
    return apiRateLimited('Too many export requests. Please slow down.', retryAfterSeconds(rl));
  }

  try {
    const [
      profile,
      aiPreferences,
      notificationPreferences,
      catConversations,
      catMessages,
      catMemories,
      economicProfile,
      creditEntries,
      creditTopups,
      sentMessages,
    ] = await Promise.all([
      // The owner-scoped view, not the table: a data export must contain the
      // person's email, phone and contact email, and `authenticated` can no
      // longer read those columns off `profiles` (20260917163100). The view is
      // already confined to auth.uid(), so the `id` filter is belt-and-braces.
      rows(supabase, OWN_PROFILE_VIEW, 'id', user.id),
      rows(supabase, DATABASE_TABLES.USER_AI_PREFERENCES, 'user_id', user.id),
      rows(supabase, DATABASE_TABLES.NOTIFICATION_PREFERENCES, 'user_id', user.id),
      rows(supabase, DATABASE_TABLES.CAT_CONVERSATIONS, 'user_id', user.id),
      rows(supabase, DATABASE_TABLES.CAT_MESSAGES, 'user_id', user.id),
      rows(
        supabase,
        DATABASE_TABLES.CAT_MEMORIES,
        'user_id',
        user.id,
        'id, content, source, source_conversation_id, created_at'
      ),
      rows(supabase, DATABASE_TABLES.USER_ECONOMIC_PROFILE, 'user_id', user.id),
      rows(supabase, DATABASE_TABLES.CAT_CREDIT_ENTRIES, 'user_id', user.id),
      rows(supabase, DATABASE_TABLES.CAT_CREDIT_TOPUPS, 'user_id', user.id),
      rows(supabase, DATABASE_TABLES.MESSAGES, 'sender_id', user.id),
    ]);

    const payload = {
      manifest: {
        product: 'OrangeCat',
        exported_at: new Date().toISOString(),
        user_id: user.id,
        scope: [
          'profile',
          'ai_preferences',
          'notification_preferences',
          'cat_conversations',
          'cat_messages',
          'cat_memories (content only — embedding vectors excluded)',
          'economic_profile',
          'credit_entries',
          'credit_topups',
          'sent_messages (only messages you sent; other participants’ messages are theirs)',
        ],
        excluded: ['encrypted BYOK API keys'],
      },
      profile,
      ai_preferences: aiPreferences,
      notification_preferences: notificationPreferences,
      cat_conversations: catConversations,
      cat_messages: catMessages,
      cat_memories: catMemories,
      economic_profile: economicProfile,
      credit_entries: creditEntries,
      credit_topups: creditTopups,
      sent_messages: sentMessages,
    };

    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${ACCOUNT_EXPORT_FILENAME}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
});
