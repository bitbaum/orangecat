/**
 * GET /api/ai-assistants/[id]/library — the photos, files and links that
 * passed through this bot's chats with the caller, newest first.
 *
 * Read from the caller's own stored messages (services/companions/library):
 * nothing here is visible to the bot's creator or anyone else, by RLS and by
 * the user filter. A stored photo comes back as a ten-minute link, and only
 * when its path is in the caller's own folder.
 */
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import { apiInternalError, apiSuccess } from '@/lib/api/standardResponse';
import { getValidationError, validateUUID } from '@/lib/api/validation';
import { DATABASE_TABLES } from '@/config/database-tables';
import { isOwnChatImagePath, signedChatImageUrl } from '@/services/cat/chat-image-store';
import { libraryFrom, type LibraryRow } from '@/services/companions/library';
import { logger } from '@/utils/logger';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** The newest lines are the library; a chat years long is not read whole. */
const MAX_ROWS = 1500;

export const GET = withAuth(async (request: AuthenticatedRequest, context: RouteContext) => {
  const { id: assistantId } = await context.params;
  const idError = getValidationError(validateUUID(assistantId, 'companion ID'));
  if (idError) {
    return idError;
  }
  const { user, supabase } = request;
  try {
    const { data: conversations, error: convError } = await supabase
      .from(DATABASE_TABLES.AI_CONVERSATIONS)
      .select('id')
      .eq('assistant_id', assistantId)
      .eq('user_id', user.id);
    if (convError) {
      throw convError;
    }
    const ids = ((conversations ?? []) as Array<{ id: string }>).map(c => c.id);
    if (ids.length === 0) {
      return apiSuccess({ items: [] });
    }
    const { data: rows, error } = await supabase
      .from(DATABASE_TABLES.AI_MESSAGES)
      .select('role, content, created_at')
      .in('conversation_id', ids)
      .in('role', ['user', 'assistant'])
      .order('created_at', { ascending: false })
      .limit(MAX_ROWS);
    if (error) {
      throw error;
    }
    const items = await Promise.all(
      libraryFrom((rows ?? []) as LibraryRow[]).map(async ({ ref, ...item }) => {
        if (item.kind !== 'photo' || !ref || !isOwnChatImagePath(ref, user.id)) {
          return item;
        }
        const url = await signedChatImageUrl(ref).catch(() => null);
        return url ? { ...item, url } : item;
      })
    );
    return apiSuccess({ items }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    logger.error('Library could not be read', error, 'CompanionLibraryAPI');
    return apiInternalError('The library could not be read.');
  }
});
