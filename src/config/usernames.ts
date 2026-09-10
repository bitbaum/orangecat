/**
 * Everything that decides whether a username is allowed — in one place.
 *
 * The rules were previously written out three times with three different
 * answers: `USERNAME_PATTERN` in lib/validation/base.ts allowed 3–30,
 * `registerSchema` allowed 3–20, and `profileSchema` allowed 3–30. So a name you
 * could not register was one you could switch to afterwards by editing your
 * profile. Anything that asks a question about usernames now asks it here.
 */

import { CAT_USERNAME } from '@/config/cat-identity';

/** Characters a username may contain, and how long it may be. */
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;
export const USERNAME_PATTERN = /^[a-zA-Z0-9_-]{3,30}$/;
export const USERNAME_RULE_MESSAGE =
  'Username can only contain letters, numbers, underscores and hyphens';

/**
 * Handles nobody may register.
 *
 * The reason this exists at all: `@handle` is already tokenized and linked by
 * utils/markdown.tsx, so a handle is not just a profile address — it is what
 * every mention of that name across the platform points at. A reserved name is
 * one where being wrong about who owns it is harmful, not merely confusing.
 *
 * Reservations are compared after NORMALIZATION (see `normalizeUsername`):
 * lowercased with `_`, `-` and `.` removed. That is deliberate — `C-A-T` and
 * `c.a.t` read as "cat" to a human skimming a mention, and impersonation only
 * has to fool a human. Matching is exact after normalizing, so ordinary words
 * that merely contain a reserved word ("category") are unaffected.
 */
export const RESERVED_USERNAMES: ReadonlyArray<{ name: string; why: string }> = [
  // The Cat's own handle, and the near-misses that would be mistaken for it.
  { name: CAT_USERNAME, why: "the Cat's handle — every @cat on the platform points here" },
  { name: 'thecat', why: 'reads as the Cat in a mention' },
  { name: 'mycat', why: 'reads as the Cat in a mention ("My Cat" is the product name)' },
  { name: 'catbot', why: 'reads as the Cat in a mention' },
  { name: 'orangecat', why: 'the platform itself' },

  // System and support identities. Someone holding these can impersonate the
  // platform to any user who sees the mention.
  { name: 'admin', why: 'impersonates platform staff' },
  { name: 'support', why: 'impersonates platform staff' },
  { name: 'help', why: 'impersonates platform staff' },
  { name: 'system', why: 'impersonates the platform' },
  { name: 'official', why: 'impersonates the platform' },
  { name: 'security', why: 'impersonates platform staff — the highest-value phish' },
  { name: 'billing', why: 'impersonates platform staff on a money topic' },
  { name: 'payments', why: 'impersonates platform staff on a money topic' },
  { name: 'moderator', why: 'impersonates platform staff' },
  { name: 'root', why: 'impersonates the platform' },
];

const RESERVED_SET: ReadonlySet<string> = new Set(
  RESERVED_USERNAMES.map(entry => normalizeUsername(entry.name))
);

/**
 * The form used for comparing two handles for sameness.
 *
 * Lowercase because the database's unique index on `username` is case-sensitive
 * btree — `Cat` and `cat` are two different rows to Postgres — and two accounts
 * that differ only in case are indistinguishable in a mention. Separators are
 * dropped for the same reason.
 */
export function normalizeUsername(username: string): string {
  return username
    .trim()
    .toLowerCase()
    .replace(/[_\-.]/g, '');
}

/** @returns the reason a handle is reserved, or null if it is free to take. */
export function reservedReason(username: string): string | null {
  const normalized = normalizeUsername(username);
  const hit = RESERVED_USERNAMES.find(entry => normalizeUsername(entry.name) === normalized);
  return hit ? hit.why : null;
}

export function isReservedUsername(username: string): boolean {
  return RESERVED_SET.has(normalizeUsername(username));
}

export function isValidUsername(username: string): boolean {
  if (!username || typeof username !== 'string') {
    return false;
  }
  return USERNAME_PATTERN.test(username.trim());
}

/**
 * A handle the platform minted, not one the person chose: `user_<hex>`. Two
 * places already special-cased it (the display-name nudge and the public
 * directory); a claim adopts the placeholder's slug over one of these, so the
 * URL her friends were sent keeps working — a minted handle is not a choice.
 */
export const MINTED_HANDLE_RE = /^user_[0-9a-f]{8,}$/i;

export function isMintedHandle(username: string | null | undefined): boolean {
  return !!username && MINTED_HANDLE_RE.test(username);
}
