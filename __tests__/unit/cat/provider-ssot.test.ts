/**
 * Guards the provider-list SSOT. Two lists, and the difference matters:
 * WIRED_PROVIDER_IDS is what the chat route can ROUTE; KEYABLE_PROVIDER_IDS
 * adds the Studio's media providers, which a user can save a key for but which
 * never answer a chat turn. Every other provider collection must be derived
 * from or contained in one of them — this test fails the build the moment a new
 * hand-maintained copy drifts (the drift that once let Anthropic/Google keys be
 * saved as "valid" and silently dropped from the routing chain), and the moment
 * a media provider leaks into the routing chain it cannot serve.
 */

import { AI_MODEL_REGISTRY, DEFAULT_MODEL_ID, DEFAULT_FREE_MODEL_ID } from '@/config/ai-models';
import {
  KEYABLE_PROVIDER_IDS,
  MEDIA_PROVIDER_IDS,
  WIRED_PROVIDER_IDS,
  aiProviders,
  mediaProviders,
  wiredProviders,
} from '@/data/aiProviders';
import {
  AUDIO_PROVIDER_RUNTIME,
  IMAGE_PROVIDER_RUNTIME,
  PROVIDER_BASE_URLS,
  PROVIDER_RUNTIME,
  VIDEO_PROVIDER_RUNTIME,
} from '@/config/ai-provider-runtime';

describe('provider SSOT invariants', () => {
  it('PROVIDER_BASE_URLS covers exactly the providers a key can be saved for', () => {
    // Widened from WIRED to KEYABLE when the Studio landed: a media provider
    // (Replicate) is storable and callable but never answers chat, so it needs
    // a base URL without belonging to the routing chain.
    expect(Object.keys(PROVIDER_BASE_URLS).sort()).toEqual([...KEYABLE_PROVIDER_IDS].sort());
  });

  it('every wired provider exists in the aiProviders display SSOT', () => {
    const displayIds = new Set(aiProviders.map(p => p.id));
    for (const id of WIRED_PROVIDER_IDS) {
      expect(displayIds.has(id)).toBe(true);
    }
    expect(wiredProviders.map(p => p.id).sort()).toEqual([...WIRED_PROVIDER_IDS].sort());
  });

  it('every media provider exists in the aiProviders display SSOT', () => {
    const displayIds = new Set(aiProviders.map(p => p.id));
    for (const id of MEDIA_PROVIDER_IDS) {
      expect(displayIds.has(id)).toBe(true);
    }
    expect(mediaProviders.map(p => p.id).sort()).toEqual([...MEDIA_PROVIDER_IDS].sort());
  });

  it('media providers are never in the chat routing chain', () => {
    // The whole reason MEDIA_PROVIDER_IDS is a separate list: a Replicate key
    // in the fallback chain would be picked for a chat turn it cannot serve.
    const wired = new Set<string>(WIRED_PROVIDER_IDS);
    for (const id of MEDIA_PROVIDER_IDS) {
      expect(wired.has(id)).toBe(false);
    }
  });

  it('image-capable providers are a subset of wired providers', () => {
    const wired = new Set<string>(WIRED_PROVIDER_IDS);
    for (const id of Object.keys(IMAGE_PROVIDER_RUNTIME)) {
      expect(wired.has(id)).toBe(true);
    }
  });

  it('every Studio video/audio provider can have a key saved for it', () => {
    const keyable = new Set<string>(KEYABLE_PROVIDER_IDS);
    for (const table of [VIDEO_PROVIDER_RUNTIME, AUDIO_PROVIDER_RUNTIME]) {
      for (const id of Object.keys(table)) {
        expect(keyable.has(id)).toBe(true);
      }
    }
  });

  it('PROVIDER_RUNTIME entries use base URLs from the URL SSOT', () => {
    for (const [id, runtime] of Object.entries(PROVIDER_RUNTIME)) {
      expect(runtime.baseUrl).toBe(PROVIDER_BASE_URLS[id as keyof typeof PROVIDER_BASE_URLS]);
    }
  });

  it('model defaults point at registered, available free models', () => {
    // A default pointing at a removed registry entry breaks every non-BYOK
    // consumer (chat fallback, platform-llm, offer-engine, form prefill).
    for (const id of [DEFAULT_MODEL_ID, DEFAULT_FREE_MODEL_ID]) {
      const model = AI_MODEL_REGISTRY[id];
      expect(model).toBeDefined();
      expect(model.isFree).toBe(true);
      expect(model.isAvailable).toBe(true);
    }
  });
});
