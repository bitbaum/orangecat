/**
 * The OrangeCat → FleetCrown signed rail, in one place.
 *
 * Three callers now sign a JSON body with `ORANGECAT_WEBHOOK_SECRET` and POST
 * it under `x-orangecat-signature`: the entitlement grant, the settled-payment
 * event, and (new) commissioning a site. The first two each carried their own
 * copy of the same eight lines. A third copy is where this fleet's own rule
 * bites — first time fix it, second time notice, there is no third — so the
 * bytes-to-signature relationship lives here instead.
 *
 * Why that relationship is worth isolating rather than just deduplicating:
 * the signature is over the EXACT body string that is sent. A caller that
 * builds an object, signs `JSON.stringify(obj)`, and then hands `obj` to a
 * fetch wrapper that serialises it again has signed a different string than it
 * sent whenever key order or number formatting differs by a byte. The receiver
 * reports "invalid signature" and the sender is certain the secret is right.
 * Here the body is serialised ONCE and both the signature and the request use
 * that same string, so the bug is unavailable rather than avoided.
 *
 * Never throws. Every caller is a side path — a settlement notification, a
 * background grant, an action Cat is taking for a user — and none of them
 * should be able to fail the thing they are reporting on.
 */
import { createHmac } from 'crypto';

/** Outcome of one signed call. `ok` is transport + HTTP, never business truth. */
export type SignedPostResult =
  | { ok: true; status: number; body: string }
  | { ok: false; status: number | null; error: string; body?: string };

export interface SignedPostOptions {
  /** Deadline for the whole request. */
  timeoutMs?: number;
  /** Injected for tests. Defaults to global fetch. */
  fetchImpl?: typeof fetch;
  /** Injected for tests. Defaults to ORANGECAT_WEBHOOK_SECRET. */
  secret?: string;
}

const DEFAULT_TIMEOUT_MS = 12_000;

/** True when the shared rail is armed. Both ends stay inert without it. */
export function fleetCrownRailConfigured(secret = process.env.ORANGECAT_WEBHOOK_SECRET): boolean {
  return Boolean(secret && secret.length >= 32);
}

/**
 * Sign `payload` and POST it to `url`.
 *
 * Returns the response body as text so a caller can surface the receiver's own
 * message. That matters more than it looks: FleetCrown answers a 409 with a
 * sentence written for a person ("sign in to FleetCrown once, then try
 * again"), and a caller that discarded the body could only say "it failed".
 */
export async function postSignedToFleetCrown(
  url: string,
  payload: unknown,
  opts: SignedPostOptions = {}
): Promise<SignedPostResult> {
  const secret = opts.secret ?? process.env.ORANGECAT_WEBHOOK_SECRET;
  if (!fleetCrownRailConfigured(secret)) {
    return { ok: false, status: null, error: 'The FleetCrown rail is not configured here.' };
  }

  // Serialised once; signed and sent as the same bytes. See the header.
  const body = JSON.stringify(payload);
  const signature =
    'sha256=' +
    createHmac('sha256', secret as string)
      .update(body)
      .digest('hex');
  const doFetch = opts.fetchImpl ?? fetch;

  try {
    const res = await doFetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-orangecat-signature': signature },
      body,
      signal: AbortSignal.timeout(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
    const text = await res.text().catch(() => '');
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: `FleetCrown answered ${res.status}`,
        body: text,
      };
    }
    return { ok: true, status: res.status, body: text };
  } catch (err) {
    const name = err instanceof Error ? err.name : '';
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      status: null,
      error:
        name === 'TimeoutError' || name === 'AbortError'
          ? 'FleetCrown did not answer in time.'
          : `FleetCrown could not be reached (${message}).`,
    };
  }
}
