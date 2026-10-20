/**
 * The registered relying parties are one least-privilege SSOT per client, and
 * since 2026-10-20 the deploy refreshes every registered row from it. These pin
 * what that file may say and what the refresh may do.
 */
import {
  CLIENT_SPECS,
  clientScopes,
  clientScopeUpdates,
} from '../../../scripts/oauth/client-specs';
import { STANDARD_SCOPE_NAMES, SUPPORTED_SCOPE_NAMES } from '@/lib/oauth/config';

const ids = Object.keys(CLIENT_SPECS);

describe('registered clients', () => {
  it('ask only for scopes the registry knows', () => {
    for (const id of ids) {
      for (const scope of clientScopes(id)) {
        expect(SUPPORTED_SCOPE_NAMES).toContain(scope);
      }
    }
  });

  it('identity-only clients ask for exactly the standard scopes', () => {
    for (const id of ids.filter(i => i !== 'loki')) {
      expect(clientScopes(id)).toEqual([...STANDARD_SCOPE_NAMES]);
    }
  });

  it("Loki may list a service in a builder's name, and is the only client that may", () => {
    expect(clientScopes('loki')).toContain('service.write');
    for (const id of ids.filter(i => i !== 'loki')) {
      expect(clientScopes(id)).not.toContain('service.write');
    }
  });
});

describe('the deploy-time scope refresh', () => {
  it('updates the rows that exist and creates nothing', () => {
    const sql = clientScopeUpdates();
    expect(sql).toHaveLength(ids.length);
    for (const statement of sql) {
      expect(statement).toMatch(/^UPDATE public\.oauth_clients SET allowed_scopes = ARRAY\[/);
      expect(statement).toMatch(/AND allowed_scopes IS DISTINCT FROM ARRAY\[/);
      expect(statement).not.toMatch(/insert/i);
    }
    expect(sql.find(s => s.includes("client_id = 'loki'"))).toContain("'service.write'");
  });

  it('refuses a scope the registry does not know rather than writing it', () => {
    CLIENT_SPECS.bogus = { ...CLIENT_SPECS.solon, scopes: 'openid wallet.spend' };
    try {
      expect(() => clientScopes('bogus')).toThrow(/wallet\.spend/);
    } finally {
      delete CLIENT_SPECS.bogus;
    }
  });
});
