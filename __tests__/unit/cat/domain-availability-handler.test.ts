/**
 * Cat checks a name against the registries — and says only what they said.
 *
 * Two properties. The answer reaches the model as a sentence in which
 * 'unknown' is never folded into 'free' (the honesty rule the RDAP pipeline
 * exists for), and every check leaves a row of history attributed to the
 * actor who asked — the dataset the domain business would be built on.
 */
import { domainHandlers, parseTlds } from '@/services/cat/handlers/domains';
import { CAT_ACTIONS } from '@/config/cat-actions';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import type { DomainResult } from '@/services/domains/availability';

const checkDomains = vi.fn();
vi.mock('@/services/domains/availability', () => ({
  checkDomains: (...args: unknown[]) => checkDomains(...args),
  // suggest.ts imports parseDomain from here; a plain re-implementation keeps
  // the suggestion logic real without touching the network.
  parseDomain: (input: string) => {
    const m = /^([a-z0-9-]+)\.([a-z]{2,63})$/i.exec(input.trim().toLowerCase());
    return m ? { name: m[1], tld: m[2] } : null;
  },
}));

const recordDomainLookups = vi.fn(async () => undefined);
vi.mock('@/services/domains/record', () => ({
  recordDomainLookups: (...args: unknown[]) => recordDomainLookups(...args),
}));

const supabase = {} as AnySupabaseClient;
const ACTOR = '00000000-0000-4000-8000-000000000000';

function result(domain: string, status: DomainResult['status']): DomainResult {
  const [name, tld] = domain.split('.');
  return { domain, name, tld, status, reason: status, rdapSupported: status !== 'unknown' };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('registry wiring', () => {
  it('is a low-risk, unconfirmed action the appendix lists automatically', () => {
    const a = CAT_ACTIONS.check_domain_availability;
    expect(a.riskLevel).toBe('low');
    expect(a.requiresConfirmation).toBe(false);
    expect(a.enabled).toBe(true);
  });

  it('parses endings leniently and drops garbage', () => {
    expect(parseTlds('com, .ch  io')).toEqual(['com', 'ch', 'io']);
    expect(parseTlds('')).toBeUndefined();
    expect(parseTlds('!!')).toBeUndefined();
    expect(parseTlds(42)).toBeUndefined();
  });
});

describe('check_domain_availability', () => {
  it('asks the registries about the candidates and separates free / taken / unknown', async () => {
    checkDomains.mockResolvedValueOnce([
      result('orangecatcoin.com', 'unregistered'),
      result('orangecatcoin.ch', 'registered'),
      result('orangecatcoin.xyz', 'unknown'),
    ]);

    const out = await domainHandlers.check_domain_availability(supabase, 'u1', ACTOR, {
      query: 'orangecatcoin',
      tlds: 'com, ch, xyz',
    });

    expect(out.success).toBe(true);
    expect(checkDomains).toHaveBeenCalledWith(
      expect.arrayContaining(['orangecatcoin.com', 'orangecatcoin.ch', 'orangecatcoin.xyz'])
    );
    const data = out.data as { status: string; results: Array<{ domain: string; status: string }> };
    expect(data.status).toContain('No registration found for: orangecatcoin.com');
    expect(data.status).toContain('Taken: orangecatcoin.ch');
    expect(data.status).toContain('Could not verify');
    expect(data.status).toContain('orangecatcoin.xyz');
    // The honesty rule: unknown is never presented as free.
    expect(data.status).not.toMatch(/No registration found for:[^.]*orangecatcoin\.xyz/);
    expect(data.results.map(r => r.status)).toEqual(['unregistered', 'registered', 'unknown']);
  });

  it('remembers every check under the actor who asked', async () => {
    const rows = [result('synctattoo.com', 'registered')];
    checkDomains.mockResolvedValueOnce(rows);

    await domainHandlers.check_domain_availability(supabase, 'u1', ACTOR, {
      query: 'synctattoo.com',
    });

    expect(recordDomainLookups).toHaveBeenCalledWith(rows, { source: 'cat', actorId: ACTOR });
  });

  it('a full domain leads the candidate list', async () => {
    checkDomains.mockResolvedValueOnce([result('synctattoo.com', 'registered')]);
    await domainHandlers.check_domain_availability(supabase, 'u1', ACTOR, {
      query: 'synctattoo.com',
    });
    const candidates = checkDomains.mock.calls[0]![0] as string[];
    expect(candidates[0]).toBe('synctattoo.com');
  });

  it('refuses an empty or unusable query without touching the network', async () => {
    const empty = await domainHandlers.check_domain_availability(supabase, 'u1', ACTOR, {
      query: ' ',
    });
    expect(empty.success).toBe(false);
    const junk = await domainHandlers.check_domain_availability(supabase, 'u1', ACTOR, {
      query: '!!!',
    });
    expect(junk.success).toBe(false);
    expect(checkDomains).not.toHaveBeenCalled();
    expect(recordDomainLookups).not.toHaveBeenCalled();
  });
});
