/**
 * The cleanup cron's tasks (src/app/api/cron/cleanup/route.ts): each one
 * independent — a failure is reported in its result, never thrown — so one
 * stuck table does not stop the others. Add a task here; the route widens.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { DATABASE_TABLES } from '@/config/database-tables';
import { pruneDeliveredWebhookDeliveries } from '@/services/webhooks/deliveryService';
import { pruneAbandonedDcrClients } from '@/services/auth/oauthRegistration';
import { deleteStaleEphemeralConversations } from '@/services/cat/conversation-history';
import { TEMPORARY_CHAT_MAX_AGE_MS } from '@/lib/chat/temporary-chat';

export interface CleanupResult {
  task: string;
  deleted: number;
  error?: string;
}

export async function pruneOldDeliveredWebhooks(): Promise<CleanupResult> {
  try {
    const deleted = await pruneDeliveredWebhookDeliveries();
    return { task: 'webhook_deliveries_delivered', deleted };
  } catch (error) {
    return {
      task: 'webhook_deliveries_delivered',
      deleted: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function pruneAbandonedSelfRegisteredClients(): Promise<CleanupResult> {
  try {
    const deleted = await pruneAbandonedDcrClients();
    return { task: 'oauth_clients_dcr_abandoned', deleted };
  } catch (error) {
    return {
      task: 'oauth_clients_dcr_abandoned',
      deleted: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** A temporary chat nobody came back to leave is gone within a day regardless. */
export async function pruneStaleTemporaryChats(): Promise<CleanupResult> {
  try {
    const deleted = await deleteStaleEphemeralConversations(
      createAdminClient(),
      new Date(Date.now() - TEMPORARY_CHAT_MAX_AGE_MS)
    );
    return { task: 'cat_conversations_temporary', deleted };
  } catch (error) {
    return {
      task: 'cat_conversations_temporary',
      deleted: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function pruneExpiredIdempotencyResults(): Promise<CleanupResult> {
  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  const { count, error } = await admin
    .from(DATABASE_TABLES.IDEMPOTENCY_RESULTS)
    .delete({ count: 'exact' })
    .lt('expires_at', nowIso);

  if (error) {
    return {
      task: 'idempotency_results',
      deleted: 0,
      error: error.message,
    };
  }

  return { task: 'idempotency_results', deleted: count ?? 0 };
}

export const CLEANUP_TASKS: Array<() => Promise<CleanupResult>> = [
  pruneExpiredIdempotencyResults,
  pruneOldDeliveredWebhooks,
  pruneAbandonedSelfRegisteredClients,
  pruneStaleTemporaryChats,
];
