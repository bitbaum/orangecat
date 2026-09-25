/**
 * Which listing statuses a public profile hides — ONE definition for the two
 * reads that must agree: the profile tab listing
 * (api/profiles/[userId]/entities/[entityType]) and the tab badge counts
 * (services/profile/listingCounts). Each used to carry its own `.neq('status',
 * 'draft')`, so a cancelled test loan for 2.9M CHF sat on a public profile.
 *
 * - draft: not published yet.
 * - cancelled: withdrawn by the owner — history, not an offer.
 * - archived: put away by the owner.
 *
 * `paused` stays visible on purpose: it is a live listing the card labels as
 * paused, and hiding it would make the owner's work vanish on a toggle.
 */
export const PROFILE_HIDDEN_STATUSES = ['draft', 'cancelled', 'archived'] as const;

/** PostgREST `in` list for `.not('status', 'in', …)`. */
export const PROFILE_HIDDEN_STATUS_FILTER = `(${PROFILE_HIDDEN_STATUSES.join(',')})`;
