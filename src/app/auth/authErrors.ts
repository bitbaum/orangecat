/**
 * What the /auth form says when something goes wrong, and whether pressing
 * "Try again" could change the outcome.
 *
 * One banner used to carry every failure with a "Try Again" button, so a
 * mistyped password or an empty field offered a retry that could only fail
 * the same way. A field problem now sits under its field (validateAuthFields),
 * and the banner offers "Try again" only where the cause is outside the
 * person's hands: the connection, the server, a throttle that passes.
 */

export type AuthFieldErrors = Partial<Record<'email' | 'password' | 'confirmPassword', string>>;

export interface AuthFailure {
  message: string;
  /** True when the same attempt could succeed a moment later. */
  retryable: boolean;
}

export const AUTH_ERROR_COPY = {
  emailMissing: 'Enter your email address.',
  emailInvalid: 'Enter an email address like name@example.com.',
  passwordMissing: 'Enter your password.',
  confirmMismatch: 'The two passwords do not match.',
  badCredentials: 'That email and password do not match. Check both and try again.',
  unconfirmed: 'Open the confirmation link we emailed you, then sign in.',
  alreadyRegistered: 'There is already an account with this email. Sign in instead.',
  timeout: 'This is taking too long. Check your connection and try again.',
  fallback: 'Could not sign you in. Please try again.',
} as const;

// Deliberately loose: the auth server is the judge of a valid address. This
// only catches what is plainly not one ("ana", "ana@"), before a round trip.
const LOOKS_LIKE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Field-by-field problems the person can fix before anything is sent. */
export function validateAuthFields(
  mode: 'login' | 'register' | 'forgot',
  data: { email: string; password: string; confirmPassword: string }
): AuthFieldErrors {
  const errors: AuthFieldErrors = {};
  const email = data.email.trim();
  if (!email) {
    errors.email = AUTH_ERROR_COPY.emailMissing;
  } else if (!LOOKS_LIKE_EMAIL.test(email)) {
    errors.email = AUTH_ERROR_COPY.emailInvalid;
  }
  if (mode === 'forgot') {
    return errors;
  }
  if (!data.password) {
    errors.password = AUTH_ERROR_COPY.passwordMissing;
  }
  if (mode === 'register' && data.confirmPassword !== data.password) {
    errors.confirmPassword = AUTH_ERROR_COPY.confirmMismatch;
  }
  return errors;
}

const TIMED_OUT = /time(d)?\s?out|taking too long|abort/i;

/** Turn what the auth server answered into words for a person, and a retry decision. */
export function describeAuthFailure(raw: string): AuthFailure {
  if (raw.includes('Invalid login credentials')) {
    return { message: AUTH_ERROR_COPY.badCredentials, retryable: false };
  }
  if (raw.includes('Email not confirmed')) {
    return { message: AUTH_ERROR_COPY.unconfirmed, retryable: false };
  }
  if (/already (been )?registered|already exists/i.test(raw)) {
    return { message: AUTH_ERROR_COPY.alreadyRegistered, retryable: false };
  }
  if (TIMED_OUT.test(raw)) {
    return { message: AUTH_ERROR_COPY.timeout, retryable: true };
  }
  // Anything else came from the connection or the server (a throttle, an
  // outage) and may be momentary.
  return { message: raw || AUTH_ERROR_COPY.fallback, retryable: true };
}
