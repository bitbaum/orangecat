import { ROUTES } from '@/config/routes';

/**
 * The link that opens a message to a listing's owner about that listing: the
 * owner card's "Ask … about this", and the "Ask how to pay" a listing offers
 * when its owner has no wallet a payment can reach. One builder, so the two
 * can never drift apart on the query the messages page reads (to, about, ref).
 */
export function buildInquiryHref({
  to,
  about,
  ref,
}: {
  to: string;
  about: string;
  ref: string;
}): string {
  return `${ROUTES.MESSAGES}?${new URLSearchParams({ to, about, ref }).toString()}`;
}

/**
 * The same link for someone who may be signed out: through sign-in, back to the
 * message. `from` is the parameter /auth reads (useAuthForm), so the visitor
 * lands in the conversation rather than on the dashboard.
 */
export function withSignIn(href: string, isSignedIn: boolean): string {
  return isSignedIn ? href : `${ROUTES.AUTH}?mode=login&from=${encodeURIComponent(href)}`;
}
