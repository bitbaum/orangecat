/**
 * Which Studio mediums a given user can actually use, and with which key.
 *
 * One place decides this so the capability probe, the generate route and the
 * poll route can never disagree — the failure that produces a UI offering a
 * button the API then refuses.
 *
 * Created: 2026-09-13
 */

import type { AnySupabaseClient } from '@/lib/supabase/types';
import {
  AUDIO_PROVIDER_RUNTIME,
  IMAGE_PROVIDER_RUNTIME,
  VIDEO_PROVIDER_RUNTIME,
  getAudioProviderRuntime,
  getImageProviderRuntime,
  getVideoProviderRuntime,
} from '@/config/ai-provider-runtime';
import { STUDIO_MEDIUMS, type StudioMedium } from '@/config/studio';
import { createApiKeyService } from '@/services/ai/api-key-service';

/** Providers that can serve each medium. Writing needs no BYOK key at all. */
const PROVIDERS_BY_MEDIUM: Record<StudioMedium, Record<string, unknown>> = {
  video: VIDEO_PROVIDER_RUNTIME,
  music: AUDIO_PROVIDER_RUNTIME,
  image: IMAGE_PROVIDER_RUNTIME,
  // Writing runs on the platform's own text models, like every other writing
  // surface on OrangeCat. An empty table means "no key required".
  writing: {},
};

export function mediumNeedsKey(medium: StudioMedium): boolean {
  return Object.keys(PROVIDERS_BY_MEDIUM[medium]).length > 0;
}

/** Provider ids that can serve a medium — used by the UI to name what to add. */
export function providersForMedium(medium: StudioMedium): string[] {
  return Object.keys(PROVIDERS_BY_MEDIUM[medium]);
}

export interface MediumAccess {
  medium: StudioMedium;
  /** Null when the user has no key for this medium (writing is always true). */
  provider: string | null;
  available: boolean;
}

/**
 * Read the user's keys once and answer for every medium. Key order is the
 * user's own fallback-chain order, so the first match is the one they ranked
 * highest.
 */
export async function studioAccess(
  supabase: AnySupabaseClient,
  userId: string
): Promise<MediumAccess[]> {
  const keys = await createApiKeyService(supabase).getKeys(userId);
  const validProviders = keys.filter(k => k.is_valid).map(k => k.provider);

  return STUDIO_MEDIUMS.map(medium => {
    if (!mediumNeedsKey(medium)) {
      return { medium, provider: null, available: true };
    }
    const provider = validProviders.find(p => p in PROVIDERS_BY_MEDIUM[medium]) ?? null;
    return { medium, provider, available: Boolean(provider) };
  });
}

export interface ResolvedMediaKey {
  apiKey: string;
  providerId: string;
  baseUrl: string;
  model: string;
  api: 'openai-videos' | 'replicate';
}

/**
 * The decrypted key + runtime for a job medium, in the user's own key order.
 * Null when they have nothing that can render this medium.
 */
export async function resolveMediaKey(
  supabase: AnySupabaseClient,
  userId: string,
  medium: 'video' | 'music'
): Promise<ResolvedMediaKey | null> {
  const keys = await createApiKeyService(supabase).listDecryptedKeysOrdered(userId);
  const table = PROVIDERS_BY_MEDIUM[medium];
  const match = keys.find(k => k.provider in table);
  if (!match) {
    return null;
  }
  const runtime =
    medium === 'video'
      ? getVideoProviderRuntime(match.provider)
      : getAudioProviderRuntime(match.provider);
  if (!runtime) {
    return null;
  }
  return {
    apiKey: match.key,
    providerId: match.provider,
    baseUrl: runtime.baseUrl,
    model: runtime.defaultModel,
    api: runtime.api,
  };
}

/** Same resolution for the image medium, which uses its own runtime table. */
export async function resolveImageKey(supabase: AnySupabaseClient, userId: string) {
  const keys = await createApiKeyService(supabase).listDecryptedKeysOrdered(userId);
  const match = keys.find(k => k.provider in IMAGE_PROVIDER_RUNTIME);
  if (!match) {
    return null;
  }
  const runtime = getImageProviderRuntime(match.provider);
  return runtime ? { apiKey: match.key, providerId: match.provider, ...runtime } : null;
}
