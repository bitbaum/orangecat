/**
 * Which handles to offer while someone types `@`, and in what order.
 *
 * Pure: given a query and some candidate profiles, it returns the menu. No
 * fetching, because the people query already exists — `/api/profiles?search=`
 * searches username and name, escapes LIKE metacharacters, and hides CI fixture
 * accounts. Writing a second query here would have re-inherited none of that,
 * and the fixture filter is exactly the kind of rule that gets fixed in one
 * copy and stays broken in the other.
 *
 * So the only new thing is the ORDER, and the order encodes one product
 * decision: THE CAT COMES FIRST.
 *
 * That is not favouritism, it is the fix for a discoverability bug. The Cat
 * answers to `@cat` on the wall and in DMs, and nobody guesses that. A feature
 * you have to be told about does not exist for the people who were not told —
 * so typing `@` shows it, before any name, on the first keystroke. It is the
 * difference between shipping the Cat and shipping a rumour about the Cat.
 */

import { CAT_USERNAME } from '@/config/cat-identity';
import { normalizeUsername } from '@/config/usernames';
import { parseMentionCandidates } from '@/domain/mentions/parse';

/** A profile as the people endpoint returns it, narrowed to what a menu needs. */
export interface MentionCandidateProfile {
  id: string;
  username: string | null;
  name?: string | null;
  avatar_url?: string | null;
}

/** One row of the suggestion menu. */
export interface MentionSuggestion {
  id: string;
  /** The handle that gets inserted. Never null — profiles without one are dropped. */
  username: string;
  /** Display name, falling back to the handle so a row is never blank. */
  name: string;
  avatarUrl: string | null;
  /** Renders the Cat differently, and explains why it is at the top. */
  isCat: boolean;
  /**
   * This profile has no display name, so `name` above is just the handle again.
   *
   * Worth a flag rather than leaving the renderer to compare the two strings:
   * it is the difference between a row you can recognise and a row you cannot,
   * and both the order and the markup depend on it. Measured on production
   * 2026-08-28: 14 of the first 20 profiles, because the handle-retirement
   * fix correctly stopped inventing display names out of email local parts —
   * NULL is honest, and it means most accounts genuinely have no name yet.
   */
  isAnonymous: boolean;
}

/** How many rows the menu shows. Enough to choose from, few enough to scan. */
export const MENTION_SUGGESTION_LIMIT = 6;

const isCatHandle = (username: string): boolean =>
  normalizeUsername(username) === normalizeUsername(CAT_USERNAME);

/**
 * Does the Cat belong in the menu for this query?
 *
 * Only when the query is a prefix of its handle — an empty query (bare `@`),
 * `c`, `ca`, `cat`. Typing `@dan` must not offer the Cat; a suggestion that
 * ignores what you typed is worse than no suggestion.
 */
export function catMatchesQuery(query: string): boolean {
  return normalizeUsername(CAT_USERNAME).startsWith(normalizeUsername(query));
}

/**
 * Does this text tag the Cat?
 *
 * Uses `parseMentionCandidates`, so it agrees with the resolver that decides
 * whether the Cat actually answers. Anything else here would be a fourth
 * opinion about what an `@handle` is, and the last time this codebase had three
 * the renderer linked one person while the resolver notified another.
 *
 * `@catalogue` is not the Cat: the parser yields candidates longest-first, and
 * only an exact match after normalization counts.
 */
export function activeMentionsCat(text: string): boolean {
  const wanted = normalizeUsername(CAT_USERNAME);
  for (const mention of parseMentionCandidates(text)) {
    if (mention.candidates.some(candidate => normalizeUsername(candidate) === wanted)) {
      return true;
    }
  }
  return false;
}

function toSuggestion(profile: MentionCandidateProfile): MentionSuggestion | null {
  const username = profile.username?.trim();
  if (!username) {
    return null;
  }
  const name = profile.name?.trim();
  return {
    id: profile.id,
    username,
    name: name || username,
    avatarUrl: profile.avatar_url ?? null,
    isCat: isCatHandle(username),
    isAnonymous: !name,
  };
}

/**
 * Rank within the people, once the Cat has been taken out.
 *
 * Someone typing `@geo` means the person whose handle STARTS with it far more
 * often than the one whose name merely contains it, so prefix beats contains,
 * and handle beats display name. Ties keep the order the query returned rather
 * than being re-sorted alphabetically, because that order is already
 * newest-first and stable.
 *
 * A nameless profile sinks below every named one, UNLESS the query matches its
 * handle — in which case it is plainly the row being asked for and leads. The
 * asymmetry is the point: `user_d58c7dccec41` is unrecognisable, so offering it
 * to someone who has typed nothing about it is noise, while offering it to
 * someone typing `user_d58` is precisely right.
 */
function score(suggestion: MentionSuggestion, query: string): number {
  const q = normalizeUsername(query);
  if (q.length === 0) {
    return 0;
  }
  const handle = normalizeUsername(suggestion.username);

  if (handle === q) {
    return -3;
  }
  if (handle.startsWith(q)) {
    return -2;
  }
  // Only for a real name. For a nameless profile `name` is the handle again, so
  // this would silently re-run the check above and promote a row nobody can read.
  if (!suggestion.isAnonymous && suggestion.name.toLowerCase().startsWith(query.toLowerCase())) {
    return -1;
  }
  return 0;
}

/**
 * @param query what has been typed after the `@` (may be empty).
 * @param people candidates from the people search, in the order it returned them.
 * @param cat the Cat's own profile, fetched separately because it must be
 *   offerable even when the people page it would appear on is full of other
 *   matches. Pass null if it could not be loaded — the menu then simply has no
 *   Cat in it rather than showing a fake row that inserts a handle which may
 *   not resolve.
 */
export function rankMentionSuggestions(
  query: string,
  people: MentionCandidateProfile[],
  cat: MentionCandidateProfile | null,
  limit: number = MENTION_SUGGESTION_LIMIT
): MentionSuggestion[] {
  const catSuggestion = cat ? toSuggestion(cat) : null;
  const showCat = catSuggestion !== null && catMatchesQuery(query);

  const others = people
    .map(toSuggestion)
    .filter((s): s is MentionSuggestion => s !== null)
    // The Cat is placed deliberately, so drop it from the general pool rather
    // than letting the people search list it a second time further down.
    .filter(s => !s.isCat)
    // On a bare `@` there is nothing to match on, so a nameless profile is a
    // row of hex offered to someone who cannot possibly be looking for it —
    // and with most accounts unnamed it is what the menu opened with. You
    // cannot be searching for a name that does not exist; type any of the
    // handle and they come back immediately via the prefix rules above.
    .filter(s => query.length > 0 || !s.isAnonymous)
    .map((s, index) => ({ s, index, rank: score(s, query) }))
    // Match quality first, then recognisability, then the order the query
    // returned. The middle term matters because most accounts have no name:
    // `@u` matches both `ursula` and `user_d58c7dccec41` as handle prefixes,
    // equally well by any measure the score can see, and only one of them is a
    // row a human can act on.
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        Number(a.s.isAnonymous) - Number(b.s.isAnonymous) ||
        a.index - b.index
    )
    .map(entry => entry.s);

  const deduped: MentionSuggestion[] = [];
  const seen = new Set<string>();
  for (const suggestion of showCat && catSuggestion ? [catSuggestion, ...others] : others) {
    if (seen.has(suggestion.id)) {
      continue;
    }
    seen.add(suggestion.id);
    deduped.push(suggestion);
    if (deduped.length >= limit) {
      break;
    }
  }
  return deduped;
}
