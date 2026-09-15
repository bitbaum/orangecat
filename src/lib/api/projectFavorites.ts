/**
 * The prelude POST and DELETE on /api/projects/[id]/favorite both run before
 * they differ: throttle the write, prove the project exists, and see whether
 * this user has already favourited it.
 *
 * Written out once per verb, a change to the rate limit or the not-found copy
 * lands on one of them and not the other — and the two are only ever read
 * side by side when something has already gone wrong.
 */

import { apiNotFound, apiRateLimited } from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { getTableName } from '@/config/entity-registry';
import { DATABASE_TABLES } from '@/config/database-tables';
import type { AuthenticatedRequest } from '@/lib/api/withAuth';

/** A `stop` means "answer with this and go no further". */
export type FavoriteContext =
  { stop: ReturnType<typeof apiNotFound> } | { projectTitle: string; alreadyFavorited: boolean };

/**
 * Named for the rate limit on purpose. `__tests__/unit/api-route-guards.test.ts`
 * reads route SOURCES for evidence that a mutating route throttles writes, and
 * a helper called `loadX` would hide that evidence behind an import — the gate
 * would go quiet while the protection was still there, which is the shape of a
 * gate that later goes quiet when it is not.
 */
export async function rateLimitedFavoriteContext(
  request: AuthenticatedRequest,
  projectId: string
): Promise<FavoriteContext> {
  const { user, supabase } = request;

  const rl = await rateLimitWriteAsync(user.id);
  if (!rl.success) {
    return { stop: apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl)) };
  }

  const { data: project } = await supabase
    .from(getTableName('project'))
    .select('id, title')
    .eq('id', projectId)
    .single();
  if (!project) {
    return { stop: apiNotFound('Project not found') };
  }

  const { data: existing } = await supabase
    .from(DATABASE_TABLES.PROJECT_FAVORITES)
    .select('id')
    .eq('user_id', user.id)
    .eq('project_id', projectId)
    .maybeSingle();

  return { projectTitle: project.title, alreadyFavorited: !!existing };
}
