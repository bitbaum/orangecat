/**
 * The sign-in code step, remembered for this tab.
 *
 * Reading the code means leaving the page: on a phone that is the mail app,
 * and the browser is free to discard the tab meanwhile. It then reloads on
 * return, and without this the person lands back on the password form with an
 * empty code field — and asking again spends one of three codes per fifteen
 * minutes. sessionStorage survives exactly that reload and nothing wider: it
 * is per tab and gone when the tab closes.
 */

const KEY = 'oc.auth.email-code';

/**
 * How long the step is offered again. Not the code's lifetime (that is the
 * auth server's setting, unknown here): past this the person is better served
 * by a fresh start, and an expired code is refused in words either way.
 */
const MAX_AGE_MS = 15 * 60_000;

export interface PendingEmailCode {
  email: string;
  /** What the person had typed so far. */
  code: string;
  /** When the code was asked for (epoch ms). */
  sentAt: number;
}

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    // Storage can be blocked outright (private modes, embedded views).
    return null;
  }
}

export function readPendingEmailCode(now: number = Date.now()): PendingEmailCode | null {
  const store = storage();
  if (!store) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(store.getItem(KEY) ?? 'null');
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    const { email, code, sentAt } = parsed as Record<string, unknown>;
    if (typeof email !== 'string' || !email || typeof sentAt !== 'number') {
      return null;
    }
    if (now - sentAt > MAX_AGE_MS || now < sentAt) {
      store.removeItem(KEY);
      return null;
    }
    return { email, code: typeof code === 'string' ? code : '', sentAt };
  } catch {
    return null;
  }
}

export function writePendingEmailCode(pending: PendingEmailCode): void {
  try {
    storage()?.setItem(KEY, JSON.stringify(pending));
  } catch {
    // Full or blocked storage: the step simply is not remembered.
  }
}

export function clearPendingEmailCode(): void {
  try {
    storage()?.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}

/**
 * What to say when the server answers 429, from its Retry-After seconds.
 * Names the wait, and points at the code the person may already hold.
 */
export function codeRateLimitMessage(retryAfterSeconds: number | null): string {
  const wait =
    retryAfterSeconds === null || !Number.isFinite(retryAfterSeconds) || retryAfterSeconds <= 0
      ? 'a few minutes'
      : retryAfterSeconds <= 90
        ? 'a minute'
        : `about ${Math.ceil(retryAfterSeconds / 60)} minutes`;
  return `Too many codes asked for. You can ask for another in ${wait}. If a code already reached you, enter the newest one.`;
}
