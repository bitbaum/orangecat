import { DATABASE_TABLES } from '@/config/database-tables';
import type { AnySupabaseClient } from '@/lib/supabase/types';

export interface EntityOwner {
  id: string; // actor or profile ID (for wallet lookup)
  user_id: string; // auth.users ID (for self-purchase detection)
  username: string | null;
  name: string | null;
  avatar_url: string | null;
  /** profiles.created_at — drives the "On OrangeCat since <month year>" trust line. */
  created_at: string | null;
  /**
   * True when this owner is a placeholder for someone who has not accepted it
   * yet (ADR-0005). Such an owner has NO profile, so name/avatar come from the
   * actor row and `user_id` is empty — callers must not treat that as
   * "anonymous", and must not offer to pay them.
   */
  isUnclaimed?: boolean;
}

/**
 * Fetch the owner/creator profile for a public entity.
 * Handles both actor_id (actors table) and user_id/created_by (profiles table).
 */
export async function fetchEntityOwner(
  supabase: AnySupabaseClient,
  entity: { actor_id?: string | null; user_id?: string | null; created_by?: string | null }
): Promise<EntityOwner | null> {
  // Try actors table if actor_id is present. NOTE: deliberately two queries —
  // the live DB has no FK between actors.user_id and profiles, so a PostgREST
  // embed (`profiles:user_id (...)`) fails with PGRST200 and silently nulled
  // the owner for EVERY actor-owned entity (draft owner-preview then 404'd).
  if (entity.actor_id) {
    const { data: actorData } = await supabase
      .from(DATABASE_TABLES.ACTORS)
      .select('id, actor_type, user_id, group_id, display_name, avatar_url, slug')
      .eq('id', entity.actor_id)
      .maybeSingle();
    if (actorData) {
      type ActorRow = {
        id: string;
        user_id: string | null;
        actor_type?: string | null;
        display_name?: string | null;
        avatar_url?: string | null;
        slug?: string | null;
      };
      type ProfileRow = {
        username: string | null;
        name: string | null;
        avatar_url: string | null;
        created_at: string | null;
      };
      const actor = actorData as unknown as ActorRow;

      // An unclaimed placeholder has no profile by construction (the CHECK
      // requires user_id IS NULL), so the profile lookup below would return
      // nothing and this would render as "Anonymous" with a dead link. Its
      // name, avatar and public address live on the actor row itself.
      if (actor.actor_type === 'unclaimed') {
        return {
          id: actor.id,
          user_id: '',
          username: actor.slug ?? null,
          name: actor.display_name ?? null,
          avatar_url: actor.avatar_url ?? null,
          created_at: null,
          isUnclaimed: true,
        };
      }

      let profile: ProfileRow | null = null;
      if (actor.user_id) {
        const { data: profileData } = await supabase
          .from(DATABASE_TABLES.PROFILES)
          .select('username, name, avatar_url, created_at')
          .eq('id', actor.user_id)
          .maybeSingle();
        profile = profileData as ProfileRow | null;
      }
      return {
        id: actor.id,
        user_id: actor.user_id || '',
        username: profile?.username || null,
        name: profile?.name || null,
        avatar_url: profile?.avatar_url || null,
        created_at: profile?.created_at || null,
      };
    }
  }

  // Fallback to profiles table
  const profileId = entity.user_id || entity.created_by;
  if (profileId) {
    const { data: profileData } = await supabase
      .from(DATABASE_TABLES.PROFILES)
      .select('username, name, avatar_url, created_at')
      .eq('id', profileId)
      .maybeSingle();
    if (profileData) {
      const profile = profileData as Record<string, string | null>;
      return {
        id: profileId,
        user_id: profileId,
        username: profile.username,
        name: profile.name,
        avatar_url: profile.avatar_url,
        created_at: profile.created_at,
      };
    }
  }

  return null;
}
