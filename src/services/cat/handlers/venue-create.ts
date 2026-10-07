/**
 * The Cat's create_venue — a page for a place people come to.
 *
 * "Make a page for my bar, Espresso Bar, Bahnhofstrasse 5, Landquart" gives
 * the place an asset page (#1237: places are assets, and their page lists
 * what happens there). When the place belongs to someone who is not on
 * OrangeCat — a promoter setting up the bar for its owner — the page is owned
 * by a placeholder for that person (ADR-0005) and the user gets the link to
 * hand over. Until it is claimed, the user is its steward: they can list
 * events there; nobody can be paid through it.
 */

import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { STATUS } from '@/config/database-constants';
import { ROUTES } from '@/config/routes';
import { SITE_URL } from '@/config/brand';
import { createProfileClaim, declineProfileClaim } from '@/domain/profileClaims/service';
import { geocodeAddress } from '@/lib/nominatim';
import type { ActionHandler } from './types';

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/** "Bahnhofstrasse 5, 7302 Landquart" — the door as people write it. */
export async function placeLine(address: string): Promise<string> {
  const hit = await geocodeAddress(address);
  if (!hit?.venue_address || !hit.venue_city) {
    return address;
  }
  const cityLine = [hit.venue_postal_code, hit.venue_city].filter(Boolean).join(' ');
  return `${hit.venue_address}, ${cityLine}`;
}

export const createVenue: ActionHandler = async (supabase, userId, actorId, params) => {
  const name = text(params.name);
  const address = text(params.address);
  if (!name || !address) {
    return { success: false, error: 'A venue needs a name and an address.' };
  }
  const ownerName = text(params.owner_name);

  let ownerActorId = actorId;
  let claim: { id: string; token: string } | null = null;
  if (ownerName) {
    const made = await createProfileClaim({
      createdBy: userId,
      draft: { kind: 'person', profile: { name: ownerName } },
    });
    if (!made.ok) {
      return {
        success: false,
        error: 'message' in made ? made.message : `Could not set up a page for ${ownerName}`,
      };
    }
    ownerActorId = made.data.actorId;
    claim = { id: made.data.id, token: made.data.token };
  }

  const { data, error } = await supabase
    .from(ENTITY_REGISTRY.asset.tableName)
    .insert({
      owner_id: userId, // who set it up; the actor below is whose it is
      actor_id: ownerActorId,
      title: name,
      description: text(params.description) || null,
      type: 'business',
      location: await placeLine(address),
      currency: 'BTC',
      verification_status: 'unverified',
      public_visibility: true,
      // A venue page exists so that people find it — visible from the start.
      status: STATUS.ASSETS.ACTIVE,
    })
    .select('id, title, location')
    .single();

  if (error || !data) {
    if (claim) {
      await declineProfileClaim(claim.token);
    }
    return { success: false, error: error?.message ?? 'Could not create the venue' };
  }

  const pageUrl = `${SITE_URL}${ROUTES.ASSETS.VIEW(data.id as string)}`;
  if (claim) {
    const shareUrl = `${SITE_URL}${ROUTES.DASHBOARD.PROFILE_CLAIMS_SHARE(claim.id)}`;
    return {
      success: true,
      data: {
        ...data,
        pageUrl,
        url: shareUrl,
        displayMessage: `📍 ${name} is set up for ${ownerName} at ${data.location} — send ${ownerName} the link to take it over. Until then you can list events there.`,
      },
    };
  }
  return {
    success: true,
    data: {
      ...data,
      pageUrl,
      url: pageUrl,
      displayMessage: `📍 ${name} has a page, at ${data.location}`,
    },
  };
};
