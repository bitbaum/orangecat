import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { DATABASE_TABLES } from '@/config/database-tables';
import { slugify } from '@/utils/string';
import { GROUP_LABELS, isGroupLabel } from '@/config/group-labels';
import { geocodeAddress } from '@/lib/nominatim';
import type { ActionHandler } from './types';

export const organizationHandlers: Record<string, ActionHandler> = {
  invite_to_organization: async (supabase, userId, _actorId, params) => {
    // group_invitations: group_id (= organization_id), user_id, role, invited_by (inviter's userId)
    // Accepts either `username` (Cat-friendly) or `user_id` (UUID). Resolves username → user_id.
    let inviteeId = params.user_id as string | undefined;

    if (!inviteeId && params.username) {
      const rawUsername = (params.username as string).replace(/^@/, '');
      const { data: profile, error: profileError } = await supabase
        .from(DATABASE_TABLES.PROFILES)
        .select('id')
        .eq('username', rawUsername)
        .maybeSingle();
      if (profileError || !profile) {
        return { success: false, error: `User @${rawUsername} not found on OrangeCat` };
      }
      inviteeId = profile.id as string;
    }

    if (!inviteeId) {
      return { success: false, error: 'Provide either username or user_id for the invitee' };
    }

    const { data, error } = await supabase
      .from(DATABASE_TABLES.GROUP_INVITATIONS)
      .insert({
        group_id: params.organization_id,
        user_id: inviteeId,
        role: (params.role as string) || 'member',
        invited_by: userId,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }
    const role = (params.role as string) || 'member';
    const recipientDisplay = params.username
      ? (params.username as string).startsWith('@')
        ? params.username
        : `@${params.username}`
      : `user ${inviteeId.slice(0, 8)}`;
    return {
      success: true,
      data: {
        ...data,
        displayMessage: `📨 Invitation sent to ${recipientDisplay} (role: ${role})`,
      },
    };
  },

  create_organization: async (supabase, userId, _actorId, params) => {
    // groups table has: name, slug (UNIQUE NOT NULL), label (not type), created_by
    // label enum: the ids in @bitbaum/collective-kinds (GROUP_LABEL_IDS). A word
    // the model invented ("bar", "venue") is not a kind: a place people come to
    // is a company, anything else falls back to the neutral circle.
    const name = params.name as string;
    const slug = slugify(name, { maxLength: 60, randomSuffix: true });
    const address = typeof params.address === 'string' ? params.address.trim() : '';
    const asked = (params.label as string | null) ?? (params.type as string | null);
    const label = isGroupLabel(asked) ? asked : address ? 'company' : 'circle';

    // A venue's door: the address said, resolved to street, town and a pin.
    // The place is all-or-nothing (country, region, locality) because a group
    // with half a place fails the place rule on its own settings page.
    const place = address ? await geocodeAddress(address) : null;
    const placeFields =
      place?.country_code && place.region && place.venue_city
        ? {
            country_code: place.country_code,
            region: place.region.slice(0, 80),
            locality: place.venue_city.slice(0, 80),
            street_address: place.venue_address,
            postal_code: place.venue_postal_code,
            latitude: place.latitude,
            longitude: place.longitude,
          }
        : {};

    // Create the group (organization)
    const { data: group, error: groupError } = await supabase
      .from(ENTITY_REGISTRY.group.tableName)
      .insert({
        name,
        slug,
        description: params.description || null,
        label,
        ...placeFields,
        created_by: userId,
      })
      .select()
      .single();

    if (groupError) {
      return { success: false, error: groupError.message };
    }

    // The creator's founder membership and the group's `actors` row are written
    // by the `groups_get_an_identity_and_an_owner` trigger, atomically with the
    // group row above.
    //
    // This path used to insert the membership itself with `role: 'admin'`,
    // which no DELETE policy on `groups` accepts — both require 'founder'. It
    // had never fired in production (zero 'admin' memberships exist), but it
    // would have minted undeletable groups the moment it did.

    const where =
      'street_address' in placeFields && placeFields.street_address
        ? ` at ${placeFields.street_address}, ${placeFields.locality}`
        : address
          ? ` (could not place "${address}" on the map — add the address on its page)`
          : '';
    return {
      success: true,
      data: {
        ...group,
        displayMessage: `👥 ${GROUP_LABELS[label].name} "${name}" created${where}`,
      },
    };
  },
};
