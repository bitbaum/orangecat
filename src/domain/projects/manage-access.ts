import type { AnySupabaseClient } from '@/lib/supabase/types';
import { checkOwnership } from '@/services/actors';
import { getEntityStewardUserId } from '@/domain/profileClaims/stewardship';

/** The public project's controls include members authorised to manage a group project. */
export async function canManageProject(input: {
  projectId: string;
  actorId: string | null | undefined;
  viewerId: string | null;
  ownerUserId: string | null;
  unclaimed: boolean;
  supabase: AnySupabaseClient;
}): Promise<boolean> {
  const { projectId, actorId, viewerId, ownerUserId, unclaimed, supabase } = input;
  if (!viewerId) {
    return false;
  }
  if (ownerUserId && viewerId === ownerUserId) {
    return true;
  }
  if (unclaimed && (await getEntityStewardUserId('project', projectId)) === viewerId) {
    return true;
  }
  return checkOwnership({ actor_id: actorId ?? null }, viewerId, supabase);
}
