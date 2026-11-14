/**
 * Who the Cat is, as an account.
 *
 * The Cat is a real profile rather than a rendering convention, and that single
 * decision is what keeps the rest of the system from needing special cases: a
 * Cat reply is an ordinary `messages` row and an ordinary `timeline_events`
 * row, so read receipts, search, deletion, threading, moderation and realtime
 * all work on it without branching.
 *
 * This file is the only place that knows the handle. `config/usernames.ts`
 * imports it for the reserved list, so the name the Cat answers to and the name
 * nobody else may take can never drift apart.
 */

/** The handle the Cat answers to. Lowercase; comparisons are normalized. */
export const CAT_USERNAME = 'cat';

/** How the Cat introduces itself. */
export const CAT_DISPLAY_NAME = 'Cat';

/** What a person types to summon it, for use in copy and placeholders. */
export const CAT_MENTION = `@${CAT_USERNAME}`;

/**
 * How many recent messages the Cat reads to answer "what do you think about
 * this?" — the question that makes tagging worth having, since "this" means the
 * conversation rather than the sentence.
 *
 * Deliberately a window and not the whole history: the Cat should see enough to
 * be useful and no more, and the number is here so that limit is a stated
 * product decision rather than whatever a query happened to default to.
 */
export const CAT_CONTEXT_MESSAGE_WINDOW = 20;

/**
 * Is this handle the Cat's? The handle is reserved (config/usernames.ts), so
 * nobody else can hold it: a message or a seat whose profile carries it is the
 * agent's, and is shown as an agent's wherever people and the Cat share a
 * conversation.
 */
export function isCatUsername(username: string | null | undefined): boolean {
  return (username ?? '').trim().toLowerCase() === CAT_USERNAME;
}

/**
 * The Cat's face as a picture URL: the brand icon tile, safe to crop round
 * (the generated maskable asset, kept in step with the mark by
 * `pnpm run generate:brand` and its sync test). React surfaces draw
 * <CatAvatar> (components/cat/CatAvatar.tsx), which is the same drawing; this
 * is for the places that only take a URL.
 */
export const CAT_AVATAR_PATH = '/icons/icon-512-maskable.png';

/**
 * The picture a profile is shown with. The Cat always wears its own face,
 * whatever its row holds, so it cannot drift between surfaces.
 */
export function avatarUrlFor(
  username: string | null | undefined,
  avatarUrl: string | null | undefined
): string | null {
  return isCatUsername(username) ? CAT_AVATAR_PATH : avatarUrl || null;
}
