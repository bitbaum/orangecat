/**
 * What a claim is allowed to write onto the profile that claims it.
 *
 * A claim is a GIFT, not an overwrite. Someone who already has an account —
 * with their own name, bio and handle — may open a link a friend made for
 * them, and claiming it must add to their profile without replacing a single
 * thing they wrote themselves.
 *
 * The version this replaced wrote `name` and `bio` unconditionally, so an
 * established user lost both the moment they accepted a gift (ADR-0004 D6,
 * defect #2). Pure and exported so the rule is testable on its own, rather
 * than only reachable through a compare-and-swap and two Supabase clients.
 */

import { isMintedHandle } from '@/config/usernames';
import type { ProfileClaimDraft } from './types';

/**
 * Blank means "nothing is there": null, undefined, whitespace-only text, an
 * empty array, or an empty object. A `social_links` column holding `{}` is as
 * empty as one holding null, and must not block a gift that carries links.
 */
export function isBlank(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true;
  }
  if (typeof value === 'string') {
    return value.trim() === '';
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  if (typeof value === 'object') {
    return Object.keys(value as object).length === 0;
  }
  return false;
}

export interface ExistingProfileFields {
  name?: unknown;
  bio?: unknown;
  avatar_url?: unknown;
  banner_url?: unknown;
  website?: unknown;
  social_links?: unknown;
  username?: unknown;
}

/**
 * Build the `profiles` update for a claim.
 *
 * Returns ONLY the columns that are currently blank on the claimer's row and
 * that the draft actually has a value for. An empty result is a legitimate
 * outcome — an established user may have nothing left to fill — and callers
 * must treat it as success rather than issuing an empty UPDATE.
 */
/**
 * Should the claim try to give the account this handle? Only when the account
 * has none, or has one the platform minted (`user_<hex>`) — never over a
 * handle a person chose (ADR-0005 D7: the shared URL keeps working).
 */
export function wantsHandle(
  currentUsername: string | null | undefined,
  desired: string | null | undefined
): boolean {
  return !!desired && (!currentUsername || isMintedHandle(currentUsername));
}

export function buildProfileFill(
  draft: ProfileClaimDraft,
  existing: ExistingProfileFields | null | undefined,
  allocatedUsername: string | null
): Record<string, unknown> {
  const current = existing ?? {};

  const fill = (column: keyof ExistingProfileFields, value: unknown): Record<string, unknown> =>
    value !== undefined && value !== null && isBlank(current[column]) ? { [column]: value } : {};

  return {
    ...fill('name', draft.name),
    ...fill('bio', draft.bio),
    ...fill('avatar_url', draft.avatarUrl),
    ...fill('banner_url', draft.bannerUrl),
    ...fill('website', draft.website),
    ...fill('social_links', draft.socialLinks?.length ? { links: draft.socialLinks } : undefined),
    // A handle is a Lightning address and the target of every @mention, so it
    // is the last thing a gift may quietly reassign — but a minted `user_<hex>`
    // is nobody's choice, and wantsHandle() already decided the allocation
    // under exactly that rule. Seen live 2026-09-10: the slug was allocated and
    // then dropped here, because a minted handle is not blank.
    ...(allocatedUsername &&
    (isBlank(current.username) || isMintedHandle(current.username as string | null | undefined))
      ? { username: allocatedUsername }
      : {}),
  };
}
