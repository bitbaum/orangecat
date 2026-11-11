/**
 * Identities — the names one person can hold (ADR-0014).
 *
 * An identity is a whole account of its own. This file is the one place that
 * says how many a person may hold and what address such an account carries.
 */

/**
 * How many additional identities one person may hold. A product limit; the
 * database has its own higher backstop (migration 20261112090000) so that a
 * bug here cannot mint accounts without end.
 */
export const MAX_IDENTITIES = 5;

/**
 * The mailbox an identity is created with. `.invalid` is reserved by RFC 2606
 * and can never be delivered to, so there is no inbox to phish and no reset to
 * intercept: the only way into an identity is through the account that holds
 * it. The Cat's account uses the same domain for the same reason
 * (src/services/mentions/cat-account.ts).
 */
export const IDENTITY_EMAIL_DOMAIN = 'orangecat.invalid';

/** True for an address no person can read: an identity's or the Cat's. */
export function isUnreachableEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase().endsWith('.invalid');
}

export const IDENTITY_NAME_MAX_LENGTH = 60;

export const IDENTITIES_COPY = {
  title: 'Your identities',
  intro:
    'Each identity is a separate account with its own name, page, wallet and inbox. ' +
    'Nobody else can see that they belong to the same person.',
  add: 'Add an identity',
  create: 'Create identity',
  switchTo: 'Switch',
  current: 'Signed in',
  main: 'Main account',
  remove: 'Delete',
  confirmRemove: 'Delete this identity and everything it owns? This cannot be undone.',
  limitReached: `You hold the maximum of ${MAX_IDENTITIES} identities.`,
  needsEmail:
    'Add an email address to your main account first, so you can always get back into it.',
  nameLabel: 'Name',
  usernameLabel: 'Username',
  usernameTaken: 'That username is taken. Choose another.',
  createFailed: 'Could not create the identity. Try again.',
  switchFailed: 'Could not switch. Try again.',
  removeFailed: 'Could not delete the identity. Try again.',
  removeCurrent: 'Switch to another identity before deleting this one.',
} as const;
