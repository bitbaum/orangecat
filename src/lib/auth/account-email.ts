/**
 * Whether an account has an email a person can sign in with.
 *
 * An anonymous account (started without signing up) has none: it exists only
 * in the browser that made it. Settings and the profile used to talk to it as
 * if it had one ("the email associated with your account" above an empty
 * field); they ask this instead and offer to add one.
 */
export interface AccountEmailFacts {
  email?: string | null;
  is_anonymous?: boolean | null;
}

export function accountHasNoEmail(user: AccountEmailFacts | null | undefined): boolean {
  if (!user) {
    return false;
  }
  return user.is_anonymous === true || !user.email?.trim();
}
