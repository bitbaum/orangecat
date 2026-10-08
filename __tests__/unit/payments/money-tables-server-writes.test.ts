/**
 * Money records are written by the server only — and stay that way.
 *
 * payment_intents, orders and contributions are written exclusively through the
 * service role (migration 20261008170000 withdrew every client write). A later
 * migration that GRANTs a write back, or CREATEs an INSERT/UPDATE/DELETE policy
 * for client roles, would quietly reopen them; nothing at runtime would notice,
 * because the app itself never uses such a grant.
 *
 * This replays every migration in filename order — the same order deploy
 * applies them — and checks the END state: which privileges anon/authenticated
 * hold on the three tables, and which write policies exist. It parses SQL with
 * regular expressions, so the first describe block proves the parser on the
 * statement shapes this repo actually uses before the real assertion trusts it.
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations');
const MONEY_TABLES = ['payment_intents', 'orders', 'contributions'] as const;
const CLIENT_ROLES = ['anon', 'authenticated'] as const;
const WRITES = ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'];
const ALL_PRIVILEGES = [
  'SELECT',
  'INSERT',
  'UPDATE',
  'DELETE',
  'TRUNCATE',
  'REFERENCES',
  'TRIGGER',
];

type State = {
  /** `${table}|${role}` -> privileges held */
  grants: Map<string, Set<string>>;
  /** `${table}|${policyName}` -> command (INSERT, UPDATE, DELETE, SELECT, ALL) */
  policies: Map<string, string>;
};

function privilegesOf(list: string): string[] {
  const words = list
    .toUpperCase()
    .split(',')
    .map(w => w.trim().replace(/\s+PRIVILEGES$/, ''));
  return words.includes('ALL') ? ALL_PRIVILEGES : words;
}

/** Apply one migration's GRANT / REVOKE / CREATE POLICY / DROP POLICY statements. */
export function apply(state: State, sql: string): void {
  // Comments can quote statements; never let them count.
  const code = sql.replace(/--[^\n]*/g, '');
  const statements = code.split(';');
  for (const raw of statements) {
    const s = raw.replace(/\s+/g, ' ').trim();

    const grant = s.match(/^GRANT (.+?) ON (?:TABLE )?(?:public\.)?"?(\w+)"? TO (.+)$/i);
    const revoke = s.match(/^REVOKE (.+?) ON (?:TABLE )?(?:public\.)?"?(\w+)"? FROM (.+)$/i);
    const m = grant ?? revoke;
    if (m) {
      const [, privList, table, roleList] = m;
      // A column-list grant ("SELECT (a, b)") is a SELECT; it never confers a write.
      const privs = privilegesOf(privList!.replace(/\([^)]*\)/g, ''));
      for (const role of roleList!.split(',').map(r => r.trim().toLowerCase())) {
        const key = `${table!.toLowerCase()}|${role}`;
        const held = state.grants.get(key) ?? new Set<string>();
        for (const p of privs) {
          if (grant) held.add(p);
          else held.delete(p);
        }
        state.grants.set(key, held);
      }
      continue;
    }

    const create = s.match(
      /^CREATE POLICY "([^"]+)" ON (?:public\.)?(\w+)(?: AS \w+)? (?:FOR (\w+))?/i
    );
    if (create) {
      const [, name, table, cmd] = create;
      state.policies.set(`${table!.toLowerCase()}|${name}`, (cmd ?? 'ALL').toUpperCase());
      continue;
    }

    const drop = s.match(/^DROP POLICY (?:IF EXISTS )?"([^"]+)" ON (?:public\.)?(\w+)/i);
    if (drop) {
      state.policies.delete(`${drop[2]!.toLowerCase()}|${drop[1]}`);
    }
  }
}

function replayAll(): State {
  const state: State = { grants: new Map(), policies: new Map() };
  for (const file of readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort()) {
    apply(state, readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));
  }
  return state;
}

describe('the replay parser reads the statement shapes this repo uses', () => {
  const fresh = (): State => ({ grants: new Map(), policies: new Map() });

  it('GRANT ALL then REVOKE writes leaves only non-write privileges', () => {
    const s = fresh();
    apply(s, 'GRANT ALL ON TABLE public.orders TO anon;');
    apply(s, 'REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.orders FROM anon, authenticated;');
    expect([...s.grants.get('orders|anon')!].sort()).toEqual(['REFERENCES', 'SELECT', 'TRIGGER']);
  });

  it('tracks CREATE POLICY ... FOR <cmd> and DROP POLICY IF EXISTS', () => {
    const s = fresh();
    apply(
      s,
      'CREATE POLICY "Buyers update own payments" ON public.payment_intents FOR UPDATE USING ((buyer_id = auth.uid()));'
    );
    expect(s.policies.get('payment_intents|Buyers update own payments')).toBe('UPDATE');
    apply(s, 'DROP POLICY IF EXISTS "Buyers update own payments" ON public.payment_intents;');
    expect(s.policies.size).toBe(0);
  });

  it('ignores statements that only appear inside comments', () => {
    const s = fresh();
    apply(s, '-- GRANT ALL ON TABLE public.orders TO anon;\nSELECT 1;');
    expect(s.grants.size).toBe(0);
  });
});

describe('payment_intents, orders and contributions are written by the server only', () => {
  const state = replayAll();

  it('the replay sees the baseline grants, so a clean result is not an empty parse', () => {
    // If the parser ever stopped matching, every table would read "no grants"
    // and the real assertion below would pass vacuously. SELECT must survive.
    for (const table of MONEY_TABLES) {
      for (const role of CLIENT_ROLES) {
        expect(state.grants.get(`${table}|${role}`)?.has('SELECT')).toBe(true);
      }
    }
  });

  it.each(MONEY_TABLES.flatMap(t => CLIENT_ROLES.map(r => [t, r] as const)))(
    '%s: %s holds no write privilege',
    (table, role) => {
      const held = [...(state.grants.get(`${table}|${role}`) ?? [])];
      expect(held.filter(p => WRITES.includes(p))).toEqual([]);
    }
  );

  it.each(MONEY_TABLES)('%s: no INSERT / UPDATE / DELETE / ALL policy exists', table => {
    const writePolicies = [...state.policies.entries()]
      .filter(([key, cmd]) => key.startsWith(`${table}|`) && cmd !== 'SELECT')
      .map(([key, cmd]) => `${key} (${cmd})`);
    expect(writePolicies).toEqual([]);
  });
});
