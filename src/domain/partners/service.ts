/**
 * The partners, from data: the guild's members and what each has shipped.
 *
 * Reads the guild group by its configured slug, its members through the same
 * query the group page uses (public groups only), and each member's portfolio
 * through the profile's own public listing counts — so the number on the
 * partners page is the number a visitor finds when they click through.
 */
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { PARTNER_GUILD } from '@/config/partners';
import { ROUTES } from '@/config/routes';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { getGroupMembers } from '@/services/groups/queries/members';
import {
  fetchProfileListingCounts,
  type ProfileListingCounts,
} from '@/services/profile/listingCounts';

export interface Partner {
  userId: string;
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
  joinedAt: string;
  /** Public listings by type, and the total — the generated portfolio. */
  portfolio: ProfileListingCounts;
  /** The public profile, when the person has a username. */
  href: string | null;
}

export interface PartnersDirectory {
  /** Null when nobody has founded the guild yet. */
  guild: { id: string; slug: string; name: string } | null;
  partners: Partner[];
}

const MAX_PARTNERS = 100;

export async function getPartnersDirectory(
  supabase: AnySupabaseClient
): Promise<PartnersDirectory> {
  const { data } = await supabase
    .from(ENTITY_REGISTRY.group.tableName)
    .select('id, slug, name')
    .eq('slug', PARTNER_GUILD.slug)
    .eq('is_public', true)
    .maybeSingle();
  const guild = (data as { id: string; slug: string; name: string } | null) ?? null;
  if (!guild) {
    return { guild: null, partners: [] };
  }
  const result = await getGroupMembers(guild.id, { pageSize: MAX_PARTNERS }, supabase);
  const members = result.success ? (result.members ?? []) : [];
  const partners = await Promise.all(
    members.map(async member => ({
      userId: member.user_id,
      username: member.username,
      displayName: member.display_name || member.username || 'A partner',
      avatarUrl: member.avatar_url,
      joinedAt: member.joined_at,
      portfolio: await fetchProfileListingCounts(supabase, member.user_id),
      href: member.username ? ROUTES.PROFILES.VIEW(member.username) : null,
    }))
  );
  return { guild, partners };
}
