/**
 * Browser side of identities (ADR-0014): the two calls every surface that
 * lists or switches identities makes, so the settings section and the header
 * menu cannot drift apart.
 */

import { API_ROUTES } from '@/config/api-routes';
import { IDENTITIES_COPY } from '@/config/identities';
import { ROUTES } from '@/config/routes';

export interface IdentityMember {
  id: string;
  username: string | null;
  name: string | null;
  avatarUrl: string | null;
  isHolder: boolean;
  isCurrent: boolean;
  /** A hand-over link is open for this identity. */
  handoverOpen?: boolean;
}

export interface IdentityCircle {
  members: IdentityMember[];
  max: number;
}

/** The message a failed identities call carries, or `fallback`. */
export async function readIdentityError(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string | { message?: string } };
    const message = typeof body.error === 'string' ? body.error : body.error?.message;
    return message || fallback;
  } catch {
    return fallback;
  }
}

/** The signed-in person's circle. Throws on a failed request. */
export async function fetchIdentityCircle(): Promise<IdentityCircle> {
  const res = await fetch(API_ROUTES.IDENTITIES.BASE);
  if (!res.ok) {
    throw new Error(`identities list failed (${res.status})`);
  }
  const body = (await res.json()) as { data: IdentityCircle };
  return body.data;
}

/**
 * Become another identity. On success the tab is reloaded onto the dashboard
 * and this never returns: every store and cache in the tab belongs to the
 * account that just stopped being signed in. On failure, resolves to the
 * message to show.
 */
export async function switchToIdentity(id: string): Promise<string> {
  try {
    const res = await fetch(API_ROUTES.IDENTITIES.SWITCH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) {
      return await readIdentityError(res, IDENTITIES_COPY.switchFailed);
    }
    window.location.assign(ROUTES.DASHBOARD.HOME);
    return new Promise<string>(() => {});
  } catch {
    return IDENTITIES_COPY.switchFailed;
  }
}
