/**
 * The registered relying parties are one least-privilege SSOT per client, and
 * since 2026-10-20 the deploy refreshes every registered row from it. These pin
 * what that file may say and what the refresh may do.
 */
import {
  CALLBACK_PATH,
  CLIENT_SPECS,
  clientDocumentUpdates,
  clientRowInserts,
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

describe('the deploy-time row creation', () => {
  it('creates a missing client switched off and without a secret, never touching an existing row', () => {
    const sql = clientRowInserts();
    expect(sql).toHaveLength(ids.length);
    for (const statement of sql) {
      expect(statement).toMatch(
        /^INSERT INTO public\.oauth_clients \(client_id, client_secret_hash, /
      );
      expect(statement).toMatch(/SELECT '[a-z0-9-]+', NULL, /);
      expect(statement).toMatch(
        /, now\(\) WHERE NOT EXISTS \(SELECT 1 FROM public\.oauth_clients WHERE client_id = '[a-z0-9-]+'\);$/
      );
      expect(statement).not.toMatch(/update|on conflict/i);
    }
  });

  it('accepts exactly each origin plus the shared callback path', () => {
    const hirnli = clientRowInserts().find(s => s.includes("SELECT 'hirnli',"));
    expect(hirnli).toContain(`'https://hirnli.orangecat.ch${CALLBACK_PATH}'`);
    expect(hirnli).toContain(`'https://revamp-info.orangecat.ch${CALLBACK_PATH}'`);
  });

  it('escapes a quote in a name rather than breaking the statement', () => {
    CLIENT_SPECS.quoted = { ...CLIENT_SPECS.solon, name: "O'Cat" };
    try {
      expect(clientRowInserts().find(s => s.includes("'quoted'"))).toContain("'O''Cat'");
    } finally {
      delete CLIENT_SPECS.quoted;
    }
  });
});

describe('the deploy-time privacy and terms refresh', () => {
  it('updates only clients whose spec names a document, and only when the row differs', () => {
    const sql = clientDocumentUpdates();
    const named = ids.filter(id => CLIENT_SPECS[id].policy_uri || CLIENT_SPECS[id].tos_uri);
    expect(sql).toHaveLength(named.length);
    for (const statement of sql) {
      expect(statement).toMatch(/^UPDATE public\.oauth_clients SET policy_uri = /);
      expect(statement).toMatch(
        /AND \(policy_uri IS DISTINCT FROM .* OR tos_uri IS DISTINCT FROM .*\);$/
      );
      expect(statement).not.toMatch(/insert|allowed_scopes|client_secret/i);
    }
  });

  it('gives BiasLens its privacy and terms pages', () => {
    const biaslens = clientDocumentUpdates().find(s => s.includes("client_id = 'biaslens'"));
    expect(biaslens).toContain("policy_uri = 'https://biaslens.orangecat.ch/privacy'");
    expect(biaslens).toContain("tos_uri = 'https://biaslens.orangecat.ch/terms'");
  });

  it('leaves a client with no documents in its spec untouched', () => {
    const bare = ids.filter(id => !CLIENT_SPECS[id].policy_uri && !CLIENT_SPECS[id].tos_uri);
    for (const id of bare) {
      expect(clientDocumentUpdates().some(s => s.includes(`client_id = '${id}'`))).toBe(false);
    }
  });

  it('clears a link the spec omits for a client it names, as register-client.ts does', () => {
    CLIENT_SPECS.policyonly = { ...CLIENT_SPECS.solon, policy_uri: 'https://x.ch/privacy' };
    delete CLIENT_SPECS.policyonly.tos_uri;
    try {
      const s = clientDocumentUpdates().find(x => x.includes("'policyonly'"));
      expect(s).toContain('tos_uri = NULL');
    } finally {
      delete CLIENT_SPECS.policyonly;
    }
  });
});
