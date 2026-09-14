/**
 * Guards the provider-list SSOT: WIRED_PROVIDER_IDS (src/data/aiProviders)
 * is the one list of routable providers. Every other provider collection
 * must be derived from or contained in it — this test fails the build the
 * moment a new hand-maintained copy drifts (the drift that once let
 * Anthropic/Google keys be saved as "valid" and silently dropped from the
 * routing chain).
 */

import { AI_MODEL_REGISTRY, DEFAULT_MODEL_ID, DEFAULT_FREE_MODEL_ID } from '@/config/ai-models';
import {
  CUSTOM_PROVIDER_ID,
  WIRED_PROVIDER_IDS,
  WIRED_VENDOR_IDS,
  aiProviders,
  wiredProviders,
} from '@/data/aiProviders';
import {
  IMAGE_PROVIDER_RUNTIME,
  PROVIDER_BASE_URLS,
  PROVIDER_RUNTIME,
} from '@/config/ai-provider-runtime';

describe('provider SSOT invariants', () => {
  it('PROVIDER_BASE_URLS covers exactly the wired vendors', () => {
    expect(Object.keys(PROVIDER_BASE_URLS).sort()).toEqual([...WIRED_VENDOR_IDS].sort());
  });

  it('the wired list is the vendors plus the one provider with no fixed host', () => {
    // The user's own endpoint has no base URL in code by construction — it
    // is the row's. It must still be WIRED, or the key schema rejects it and
    // "any model" is back to "six vendors".
    expect([...WIRED_PROVIDER_IDS].sort()).toEqual(
      [...WIRED_VENDOR_IDS, CUSTOM_PROVIDER_ID].sort()
    );
    expect(CUSTOM_PROVIDER_ID in PROVIDER_BASE_URLS).toBe(false);
    expect(aiProviders.find(p => p.id === CUSTOM_PROVIDER_ID)?.type).toBe('self-hosted');
  });

  it('every wired provider exists in the aiProviders display SSOT', () => {
    const displayIds = new Set(aiProviders.map(p => p.id));
    for (const id of WIRED_PROVIDER_IDS) {
      expect(displayIds.has(id)).toBe(true);
    }
    expect(wiredProviders.map(p => p.id).sort()).toEqual([...WIRED_PROVIDER_IDS].sort());
  });

  it('image-capable providers are a subset of wired providers', () => {
    const wired = new Set<string>(WIRED_PROVIDER_IDS);
    for (const id of Object.keys(IMAGE_PROVIDER_RUNTIME)) {
      expect(wired.has(id)).toBe(true);
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
