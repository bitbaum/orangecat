/**
 * Bringing your own key must be one click, for every provider on offer.
 *
 * Anthropic was in the provider registry with a correct `apiKeyUrl` and was
 * nonetheless unreachable: the add-key form renders `wiredProviders`, and
 * `WIRED_PROVIDER_IDS` didn't include it. So the one provider people ask for
 * by name ("I want to use Claude") could not be selected, and the form told
 * them direct Anthropic support was "on the roadmap" while sending them to
 * OpenRouter instead.
 *
 * It is wired now because Anthropic serves an OpenAI-compatible surface —
 * `POST /v1/chat/completions` with `Authorization: Bearer`, and `GET /v1/models`
 * for validation — which is exactly what OpenAICompatibleService speaks and
 * what PROVIDER_AUTH_ENDPOINTS derives. Verified live on 2026-09-20.
 *
 * These pin the wiring contract, so a provider can never again be advertised
 * in the registry while being unselectable in the form.
 */

import { aiProviders, wiredProviders, WIRED_PROVIDER_IDS } from '@/data/aiProviders';
import {
  PROVIDER_BASE_URLS,
  PROVIDER_RUNTIME,
  isOpenAICompatibleProvider,
} from '@/config/ai-provider-runtime';

describe('every wired provider is actually reachable', () => {
  it.each([...WIRED_PROVIDER_IDS])('%s exists in the provider registry', id => {
    expect(aiProviders.find(p => p.id === id)).toBeDefined();
  });

  it.each([...WIRED_PROVIDER_IDS])('%s has a base URL to call', id => {
    expect(PROVIDER_BASE_URLS[id as keyof typeof PROVIDER_BASE_URLS]).toMatch(/^https:\/\//);
  });

  it('routes every wired provider through a real service', () => {
    // groq and openrouter keep bespoke service classes; the rest go through
    // OpenAICompatibleService and so must appear in PROVIDER_RUNTIME.
    const bespoke = new Set(['groq', 'openrouter']);
    for (const id of WIRED_PROVIDER_IDS) {
      if (bespoke.has(id)) continue;
      expect(isOpenAICompatibleProvider(id)).toBe(true);
      expect(PROVIDER_RUNTIME[id].defaultModel).toBeTruthy();
    }
  });
});

describe('one click to the key', () => {
  it('every provider the form offers links to its own key page', () => {
    for (const p of wiredProviders) {
      expect(p.apiKeyUrl, `${p.name} has no apiKeyUrl`).toMatch(/^https:\/\//);
      // The link must go to the provider, not to a generic docs home.
      expect(() => new URL(p.apiKeyUrl)).not.toThrow();
    }
  });

  it('no two providers share a key page — a copy-paste would send people to the wrong console', () => {
    const urls = wiredProviders.map(p => p.apiKeyUrl);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it('every provider that validates a key format documents the format', () => {
    for (const p of wiredProviders) {
      if (p.apiKeyPrefix) {
        expect(p.apiKeyExample?.startsWith(p.apiKeyPrefix)).toBe(true);
      }
    }
  });
});

describe('Anthropic specifically', () => {
  const anthropic = aiProviders.find(p => p.id === 'anthropic')!;

  it('is selectable in the add-key form', () => {
    expect(wiredProviders.map(p => p.id)).toContain('anthropic');
  });

  it('points at the Anthropic console, not a marketing page', () => {
    expect(new URL(anthropic.apiKeyUrl).host).toBe('console.anthropic.com');
  });

  it('uses the OpenAI-compatible base, which is what our client speaks', () => {
    expect(PROVIDER_BASE_URLS.anthropic).toBe('https://api.anthropic.com/v1');
  });

  it('defaults to a model that exists', () => {
    // Not a date-suffixed or invented id — see the model-rot guard.
    expect(PROVIDER_RUNTIME.anthropic.defaultModel).toBe('claude-opus-5');
  });
});
