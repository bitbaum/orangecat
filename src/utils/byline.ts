/**
 * The name an author signs their work with.
 *
 * A person who never set a name has `user_<hex>` as their handle, and the
 * profile editor used to copy that handle into `name` too, so the newest
 * essay on /articles, its page and its share card were all signed
 * `user_df091395b2ca` (media#9). A minted handle is not a name and is never
 * printed as one: the byline falls back to a neutral phrase, and the link to
 * the profile still says who it is.
 */
import { APP_NAME } from '@/config/brand';
import { isMintedHandle } from '@/config/usernames';

export const ANONYMOUS_BYLINE = `An ${APP_NAME} member`;

export function bylineName(
  name: string | null | undefined,
  username: string | null | undefined
): string {
  const chosen = name?.trim();
  if (chosen && !isMintedHandle(chosen)) {
    return chosen;
  }
  const handle = username?.trim();
  if (handle && !isMintedHandle(handle)) {
    return handle;
  }
  return ANONYMOUS_BYLINE;
}

/** True when this person's work would be signed with the neutral fallback. */
export function needsBylineName(
  name: string | null | undefined,
  username: string | null | undefined
): boolean {
  return bylineName(name, username) === ANONYMOUS_BYLINE;
}

/**
 * Who a post is signed by, as every feed card prints it.
 *
 * The article page went through `bylineName`; the feed did not, so the same
 * essay was "An OrangeCat member" on its page and `user_df091395b2ca
 * @user_df091395b2ca` on /community. One rule for every place a post author is
 * drawn: a chosen name, else a chosen handle, else the neutral phrase; the
 * `@handle` line is printed only for a handle somebody chose; the avatar letter
 * comes from the signed name, never from the minted handle. The link still
 * goes to the real profile, whatever its slug is.
 */
export interface PostAuthorSource {
  id?: string | null;
  name?: string | null;
  username?: string | null;
}

export interface PostAuthor {
  /** The name to print. Never a minted handle. */
  name: string;
  /** The handle to print after `@`, or null when there is none worth printing. */
  handle: string | null;
  /** Where the name and avatar link to, or null when the author is unknown. */
  profileHref: string | null;
  /** True when `name` is the neutral fallback, so there is no letter to draw. */
  anonymous: boolean;
}

export function postAuthor(source: PostAuthorSource | null | undefined): PostAuthor {
  const username = source?.username?.trim() || null;
  const id = source?.id?.trim() || null;
  const name = bylineName(source?.name, username);
  const slug = username || id;
  return {
    name,
    handle: username && !isMintedHandle(username) ? username : null,
    profileHref: slug ? `/profiles/${encodeURIComponent(slug)}` : null,
    anonymous: name === ANONYMOUS_BYLINE,
  };
}

/** The author a card shows: the original one on a repost, else the poster. */
export function postAuthorSource(
  actor: (PostAuthorSource & { avatar?: string | null }) | null | undefined,
  metadata?: {
    original_actor_id?: unknown;
    original_actor_name?: unknown;
    original_actor_username?: unknown;
    original_actor_avatar?: unknown;
  } | null,
  preferOriginal = false
): PostAuthorSource & { avatar: string | null } {
  const text = (value: unknown): string | null =>
    typeof value === 'string' && value.trim() ? value : null;
  if (!preferOriginal) {
    return {
      id: actor?.id ?? null,
      name: actor?.name ?? null,
      username: actor?.username ?? null,
      avatar: actor?.avatar ?? null,
    };
  }
  return {
    id: text(metadata?.original_actor_id) ?? actor?.id ?? null,
    name: text(metadata?.original_actor_name) ?? actor?.name ?? null,
    username: text(metadata?.original_actor_username) ?? actor?.username ?? null,
    avatar: text(metadata?.original_actor_avatar) ?? actor?.avatar ?? null,
  };
}
