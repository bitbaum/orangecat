import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  CAPPED_SERVICES,
  CAPPED_VENDORS,
  reserveServiceCall,
  VendorCapReached,
  capFor,
  cappedService,
  platformVendorForKey,
  reservePlatformCall,
} from '@/services/ai/vendor-spend-cap';
import type { AiService } from '@/services/ai/types';

vi.mock('@/lib/supabase/admin', () => ({ getAdminClient: () => ({}) }));

/**
 * A vendor the platform pays for may be on only with a strict daily cap
 * (owner, 2026-11-12, after Gemini was switched off to stop the spend).
 */
const google = CAPPED_VENDORS.find(v => v.vendor === 'google')!;
const env = { GEMINI_API_KEY: 'platform-key' } as Record<string, string | undefined>;

function fakeService(): AiService & { calls: number } {
  const s = {
    calls: 0,
    chatCompletion: async () => {
      s.calls++;
      return {
        content: 'ok',
        model: 'm',
        inputTokens: 1,
        outputTokens: 1,
        totalTokens: 2,
        isFreeModel: true,
        usedByok: false,
      };
    },
    streamChatCompletion: async function* () {
      s.calls++;
      yield { content: 'ok' };
    },
  };
  return s;
}

describe('the daily spending cap on a platform key', () => {
  it('knows the platform key, and only the platform key', () => {
    expect(platformVendorForKey('platform-key', env)?.vendor).toBe('google');
    expect(platformVendorForKey(' platform-key\n', env)?.vendor).toBe('google');
    expect(platformVendorForKey('a-persons-own-google-key', env)).toBeNull();
    expect(platformVendorForKey('', env)).toBeNull();
    expect(platformVendorForKey('platform-key', {})).toBeNull();
  });

  it('is low unless the owner sets it, and 0 turns the vendor off', () => {
    expect(capFor(google, {})).toBe(300);
    expect(capFor(google, { GEMINI_DAILY_CALL_CAP: '1000' })).toBe(1000);
    expect(capFor(google, { GEMINI_DAILY_CALL_CAP: '0' })).toBe(0);
    expect(capFor(google, { GEMINI_DAILY_CALL_CAP: 'lots' })).toBe(300);
    expect(capFor(google, { GEMINI_DAILY_CALL_CAP: '-5' })).toBe(300);
  });

  it('counts each call before it is made and refuses once the day is spent', async () => {
    let left = 2;
    const reserve = vi.fn(async () => left-- > 0);
    const s = fakeService();
    const capped = cappedService(s, 'platform-key', env, reserve);
    await capped.chatCompletion({ model: 'm', messages: [], temperature: 0 });
    await capped.chatCompletion({ model: 'm', messages: [], temperature: 0 });
    await expect(
      capped.chatCompletion({ model: 'm', messages: [], temperature: 0 })
    ).rejects.toBeInstanceOf(VendorCapReached);
    expect(s.calls).toBe(2);
    expect(reserve).toHaveBeenCalledWith('google', 300);
  });

  it('counts a streamed answer too', async () => {
    const s = fakeService();
    const capped = cappedService(s, 'platform-key', env, async () => false);
    const drain = async () => {
      for await (const _ of capped.streamChatCompletion({
        model: 'm',
        messages: [],
        temperature: 0,
      })) {
        void _;
      }
    };
    await expect(drain()).rejects.toBeInstanceOf(VendorCapReached);
    expect(s.calls).toBe(0);
  });

  it('refuses when the count cannot be read: unknown is never room', async () => {
    await expect(reservePlatformCall('platform-key', env)).rejects.toBeInstanceOf(VendorCapReached);
  });

  it("never counts or wraps a person's own key", async () => {
    const reserve = vi.fn(async () => false);
    const s = fakeService();
    expect(cappedService(s, 'a-persons-own-key', env, reserve)).toBe(s);
    await reservePlatformCall('a-persons-own-key', env, reserve);
    expect(reserve).not.toHaveBeenCalled();
  });

  it('counts a named service and refuses once its day is spent', async () => {
    const reserve = vi.fn(async () => false);
    await expect(reserveServiceCall(CAPPED_SERVICES.webSearch, {}, reserve)).rejects.toBeInstanceOf(
      VendorCapReached
    );
    expect(reserve).toHaveBeenCalledWith('web-search', 1000);
  });

  it('reads as a rate limit, so the chain moves to the next link', () => {
    const e = new VendorCapReached('google');
    expect(e.status).toBe(429);
    expect(e.message).toMatch(/rate limit/);
  });

  it('is applied on every path that calls a vendor with the platform key', () => {
    expect(readFileSync('src/services/ai/platform-providers.ts', 'utf8')).toMatch(
      /aiService: cappedService\(serviceFor\(link, key\), key\)/
    );
    const tool = readFileSync('src/services/cat/tool-use.ts', 'utf8');
    expect(tool.indexOf('await reservePlatformCall(toolKey);')).toBeGreaterThan(0);
    expect(tool.indexOf('await reservePlatformCall(toolKey);')).toBeLessThan(
      tool.indexOf('const res = await fetch(toolEndpoint, {')
    );
    const probe = readFileSync('src/services/cat/health-probes.ts', 'utf8');
    expect(probe.indexOf('await reservePlatformCall(clean);')).toBeLessThan(
      probe.indexOf('const res = await fetch(endpoint, {')
    );
    // Every vendor key the chain can dial on the platform's account is capped:
    // the free vendors, and the chain's own Groq, OpenRouter and Together links.
    for (const keyEnv of ['GROQ_API_KEY', 'OPENROUTER_API_KEY', 'TOGETHER_API_KEY']) {
      expect(
        CAPPED_VENDORS.map(v => v.keyEnv),
        keyEnv
      ).toContain(keyEnv);
    }
    expect(readFileSync('src/services/cat/provider-catalog.ts', 'utf8')).toMatch(
      /keyEnv: 'TOGETHER_API_KEY'/
    );
    // Embeddings on a paid host and every web search are counted too.
    const embeddings = readFileSync('src/services/ai/embeddings.ts', 'utf8');
    expect(embeddings.indexOf('await reservePlatformCall(key);')).toBeGreaterThan(0);
    expect(embeddings.indexOf('await reservePlatformCall(key);')).toBeLessThan(
      embeddings.indexOf('const res = await fetch(`${baseUrl()}/embeddings`')
    );
    expect(CAPPED_VENDORS.map(v => v.keyEnv)).toEqual(
      expect.arrayContaining(['EMBEDDINGS_API_KEY', 'OPENAI_API_KEY'])
    );
    const search = readFileSync('src/services/cat/web-research.ts', 'utf8');
    expect(search.indexOf('await reserveServiceCall(CAPPED_SERVICES.webSearch);')).toBeLessThan(
      search.indexOf('outcome = await webSearch(query, {')
    );
    // The per-person daily limit refuses when its count cannot be read.
    expect(readFileSync('src/services/ai/api-key-service.ts', 'utf8')).toMatch(
      /requests_remaining: 0,\s*can_use_platform: false,/
    );
    // Every vendor key the chain can dial on the platform's account is capped.
    const chainKeys = [
      ...readFileSync('src/config/free-vendors.ts', 'utf8').matchAll(/keyEnv: '([A-Z_]+)'/g),
    ].map(m => m[1]);
    for (const keyEnv of chainKeys) {
      expect(
        CAPPED_VENDORS.map(v => v.keyEnv),
        keyEnv
      ).toContain(keyEnv);
    }
    const sql = readFileSync(
      'supabase/migrations/20261112200000_platform_vendor_daily_cap.sql',
      'utf8'
    );
    expect(sql).toMatch(/WHERE day = v_day AND vendor = p_vendor AND calls < p_cap/);
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.reserve_vendor_call\(TEXT, INTEGER\) TO service_role/
    );
  });
});
