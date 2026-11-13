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
