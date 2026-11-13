import { signInErrorKind } from '@bitbaum/accountkit';

/**
 * What the sign-in page says when a sign-in came back unfinished.
 *
 * The page used to print the `?error=` parameter as it arrived, so anyone
 * could send a link to orangecat.ch/auth?error=… with words of their choosing
 * on OrangeCat's own sign-in card. The routes now send a code, and the page
 * shows only fixed copy for it; an unknown value is treated as "failed"
 * (accountkit's rule: never print the provider's code or the URL's words).
 */
export const AUTH_URL_ERROR = {
  /** An email confirmation link that expired or was already used. */
  link_expired:
    'That confirmation link has expired or was already used. Sign in, or ask for a new email.',
  failed: 'Signing in did not finish. Please try again.',
  denied: 'Sign-in was cancelled. Try again whenever you are ready.',
  configuration: 'Signing in is not available right now. Please try again in a few minutes.',
} as const;

export type AuthUrlErrorCode = keyof typeof AUTH_URL_ERROR;

/** The fixed sentence for a `?error=` value; never the value itself. */
export function authUrlErrorMessage(param: string | null | undefined): string | null {
  if (!param) {
    return null;
  }
  if (param === 'link_expired') {
    return AUTH_URL_ERROR.link_expired;
  }
  return AUTH_URL_ERROR[signInErrorKind(param)];
}
