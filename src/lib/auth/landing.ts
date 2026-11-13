import { ROUTES } from '@/config/routes';
import { safeReturnPath } from '@/lib/oauth/handoff';

/**
 * Where a person lands after signing in, decided once for every way in.
 *
 * Three defaults had grown apart: the password and anonymous buttons went to
 * /dashboard, the Google/GitHub callback and the email confirmation went to
 * the Cat's welcome, and "/" sent a not-yet-onboarded person to a form. So a
 * new person's first screen depended on which button they pressed, and the
 * lead button led to the weakest one. Now: a new person meets the Cat; a
 * returning one gets their dashboard; a `from` that is our own path wins.
 */
export function landingAfterSignIn({
  from,
  isNewAccount,
  onboardingCompleted,
}: {
  /** The `from` query parameter; attacker-suppliable, so only same-origin paths count. */
  from: string | null | undefined;
  /** Known to be new without asking the profile: anonymous, or just registered. */
  isNewAccount: boolean;
  /** The profile's flag; undefined while the profile has not loaded. */
  onboardingCompleted: boolean | null | undefined;
}): string {
  const back = safeReturnPath(from);
  if (back) {
    return back;
  }
  // `null` is a profile that never finished onboarding; `undefined` is one we
  // have not read yet, and a returning person is the safer guess there.
  return isNewAccount || onboardingCompleted === false || onboardingCompleted === null
    ? ROUTES.DASHBOARD.CAT_WELCOME
    : ROUTES.DASHBOARD.HOME;
}
