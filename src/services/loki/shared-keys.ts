/**
 * A person's provider keys that stay on Loki and can answer their bots here.
 *
 * One person, two linked accounts, one key. The key is never copied: Loki
 * keeps it, and a bot turn here asks Loki to make the model call for the
 * linked account (services/ai/loki-key-service.ts). A key answers only after
 * its owner switched it on, either in Loki or here while signed in.
 *
 * This file lists and switches. It calls no model, so a page load may read
 * it; the call that spends is in loki-key-service.ts.
 */
import { ECOSYSTEM, LOKI_ENDPOINTS } from '@/config/ecosystem';
import { getUserActorId } from '@/domain/actors';
import type { OwnKey } from '@/services/ai/own-key';
import type { AnySupabaseClient } from '@/lib/supabase/types';

import { postSignedToLoki, type SignedPostOptions } from './signed-post';

export interface LokiHeldKey {
  /** Loki's vendor id, which is our provider id where we know the provider. */
  vendor: string;
  /** The provider's name as Loki writes it. */
  label: string;
  /** The model the person chose for this key in Loki. */
  model: string | null;
  /** "…abcd". Never more of the key than that. */
  keyHint: string | null;
  /** Switched on for this person's OrangeCat bots. */
  shared: boolean;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
/** Loki not answering is remembered briefly, so a turn does not wait on it twice. */
const MISS_TTL_MS = 60 * 1000;
const LIST_TIMEOUT_MS = 3_000;
const MAX_KEYS = 20;
const MAX_CACHE_ENTRIES = 500;

const cache = new Map<string, { until: number; value: LokiHeldKey[] | null }>();

export function lokiModelUrl(): string {
  return (
    process.env.LOKI_MODEL_URL || new URL(LOKI_ENDPOINTS.model, ECOSYSTEM.loki.siteUrl).toString()
  );
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** The answer crosses a product boundary: keep only what type-checks. */
export function parseLokiKeys(body: string): LokiHeldKey[] | null {
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return null;
  }
  const keys = (json as { keys?: unknown } | null)?.keys;
  if (!Array.isArray(keys)) {
    return null;
  }
  return keys
    .flatMap(raw => {
      const k = (raw ?? {}) as Record<string, unknown>;
      const vendor = str(k.vendor);
      return vendor
        ? [
            {
              vendor,
              label: str(k.label) ?? vendor,
              model: str(k.model),
              keyHint: str(k.keyHint),
              shared: k.shared === true,
            },
          ]
        : [];
    })
    .slice(0, MAX_KEYS);
}

export function forgetLokiKeys(actorId: string): void {
  cache.delete(actorId);
}

/** One signed request to the door, as this actor. */
export function askLokiModelDoor(
  actorId: string,
  request: Record<string, unknown>,
  opts: SignedPostOptions = {}
) {
  return postSignedToLoki(
    lokiModelUrl(),
    { actorId, issuedAt: new Date().toISOString(), request },
    opts
  );
}

/** The keys this actor holds on Loki, or null when Loki is not linked or did not answer. */
export async function fetchLokiKeys(
  actorId: string,
  opts: SignedPostOptions = {}
): Promise<LokiHeldKey[] | null> {
  const hit = cache.get(actorId);
  if (hit && hit.until > Date.now()) {
    return hit.value;
  }
  const res = await askLokiModelDoor(
    actorId,
    { do: 'keys' },
    { timeoutMs: LIST_TIMEOUT_MS, ...opts }
  );
  const value = res.ok ? parseLokiKeys(res.body) : null;
  if (cache.size >= MAX_CACHE_ENTRIES) {
    cache.clear();
  }
  cache.set(actorId, { until: Date.now() + (value ? CACHE_TTL_MS : MISS_TTL_MS), value });
  return value;
}

/** Switch one key on or off for this actor's bots. The sentence is Loki's own when it refuses. */
export async function shareLokiKey(
  actorId: string,
  vendor: string,
  on: boolean,
  opts: SignedPostOptions = {}
): Promise<{ ok: true; shared: boolean } | { ok: false; message: string }> {
  const res = await askLokiModelDoor(actorId, { do: 'share', vendor, on }, opts);
  forgetLokiKeys(actorId);
  if (!res.ok) {
    let detail: string | null = null;
    try {
      detail = str((JSON.parse(res.body ?? '') as { detail?: unknown }).detail);
    } catch {
      // Not JSON: the transport sentence below is all there is.
    }
    return { ok: false, message: detail ?? res.error };
  }
  return { ok: true, shared: on };
}

/** The model names a switched-on key can use, and the one chosen in Loki. */
export async function listLokiModels(
  actorId: string,
  vendor: string,
  opts: SignedPostOptions = {}
): Promise<{ chosen: string | null; models: string[] }> {
  const res = await askLokiModelDoor(
    actorId,
    { do: 'models', vendor },
    { timeoutMs: 10_000, ...opts }
  );
  if (!res.ok) {
    return { chosen: null, models: [] };
  }
  try {
    const json = JSON.parse(res.body) as { chosen?: unknown; models?: unknown };
    return {
      chosen: str(json.chosen),
      models: Array.isArray(json.models)
        ? json.models.filter((m): m is string => typeof m === 'string')
        : [],
    };
  } catch {
    return { chosen: null, models: [] };
  }
}

/**
 * The person's switched-on Loki keys, in the shape a bot turn reads keys in
 * (ai/own-key.ts). `key` is empty on purpose: there is no key on this side.
 */
export async function sharedLokiOwnKeys(
  supabase: AnySupabaseClient,
  userId: string
): Promise<OwnKey[]> {
  const actorId = await getUserActorId(supabase, userId).catch(() => null);
  if (!actorId) {
    return [];
  }
  const keys = await fetchLokiKeys(actorId).catch(() => null);
  return (keys ?? [])
    .filter(k => k.shared)
    .map(k => ({ provider: k.vendor, key: '', lokiActorId: actorId, model: k.model ?? undefined }));
}
