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

/** How long a hand-over link works. After that the holder offers again. */
export const HANDOVER_TTL_DAYS = 7;

/** The page a hand-over link opens. The token is the last path segment. */
export function handoverAcceptPath(token: string): string {
  return `/identities/accept/${token}`;
}

export const IDENTITIES_COPY = {
  title: 'Your identities',
  intro:
    'Each identity is a separate account with its own name, page, wallet and inbox. ' +
    'Nobody else can see that they belong to the same person.',
  add: 'Add an identity',
  create: 'Create identity',
  switchTo: 'Switch',
  switchLabel: 'Switch identity',
  waiting: (count: number) => `${count > 99 ? '99+' : count} unread`,
  continueAs: 'Or continue as',
  noEmailToShare: 'Ask for your email address (this identity has none, so none is shared)',
  current: 'Signed in',
  main: 'Main account',
  remove: 'Delete',
  removeThis: 'Delete this identity',
  confirmRemove: 'Delete it and everything it owns? This cannot be undone.',
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
  handOver: 'Hand over',
  handOverIntro:
    'Create a link and send it to the person who should have this identity. ' +
    'When they open it and accept, the identity and everything it owns, including its wallets, is theirs, and you can no longer switch to it.',
  handOverCreate: 'Create hand-over link',
  handOverLinkLabel: 'Hand-over link',
  handOverLinkNote: `Shown once. It works for ${HANDOVER_TTL_DAYS} days, for whoever opens it first.`,
  handOverCopy: 'Copy link',
  handOverCopied: 'Copied',
  handOverOpen: 'A hand-over link is open.',
  handOverCancel: 'Cancel hand-over',
  handOverFailed: 'Could not create the link. Try again.',
  handOverCancelFailed: 'Could not cancel. Try again.',
  acceptTitle: (name: string) => `Take over ${name}?`,
  acceptIntro:
    'This identity was offered to you. Accepting makes it your account, with everything it owns. ' +
    'The person who offered it loses access.',
  acceptEmailLabel: 'Your email',
  acceptEmailNote: 'You will sign in to this account with this address from now on.',
  acceptButton: 'Accept and sign in',
  acceptSignedInNote:
    'You are signed in to another account in this browser. Accepting signs you in to this one here instead.',
  acceptGoneTitle: 'This link no longer works',
  acceptGone: 'It was used, withdrawn or has expired. Ask the person who sent it for a new one.',
  acceptEmailTaken:
    'That address already has an OrangeCat account. Use another address, or sign in to that account instead.',
  acceptInvalidEmail: 'Enter a valid email address.',
  acceptFailed: 'Could not complete the hand-over. Nothing has changed. Try again.',
} as const;
