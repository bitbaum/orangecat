/**
 * A booking's money is written by the server only — and stays that way.
 *
 * The baseline let a customer INSERT a booking with any price and UPDATE any
 * column of it while pending or confirmed, so through PostgREST they could set
 * price_btc to a satoshi or total_paid_btc to the price and read "paid" with
 * nothing sent. Migration 20261114104100 withdrew that. This replays every
 * migration in filename order and checks the END state, so a later migration
 * that hands the write back fails here rather than in someone's wallet.
 */
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const DIR = join(process.cwd(), 'supabase', 'migrations');
const CLIENT_ROLES = ['anon', 'authenticated'];
/** What a person's own session writes: confirm, reject, complete, cancel. */
const SESSION_WRITES = [
  'cancellation_reason',
  'cancelled_at',
  'completed_at',
  'confirmed_at',
  'status',
];
const MONEY = ['price_btc', 'total_paid_btc', 'deposit_btc', 'deposit_paid', 'currency'];

interface State {
  /** role -> table-wide privileges */
  table: Map<string, Set<string>>;
  /** role -> columns it may UPDATE through a column grant */
  columns: Map<string, Set<string>>;
  /** policy name -> { cmd, sql } */
  policies: Map<string, { cmd: string; sql: string }>;
}

const ALL = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'];

function apply(state: State, sql: string): void {
  const code = sql.replace(/--[^\n]*/g, '');
  for (const raw of code.split(';')) {
    const s = raw.replace(/\s+/g, ' ').trim();
    const m = s.match(
      /^(GRANT|REVOKE) (.+?) ON (?:TABLE )?(?:public\.)?"?bookings"? (?:TO|FROM) (.+)$/i
    );
    if (m) {
      const granting = m[1]!.toUpperCase() === 'GRANT';
      const roles = m[3]!.split(',').map(r => r.trim().toLowerCase());
      const columnGrant = m[2]!.match(/^UPDATE \(([^)]*)\)$/i);
      for (const role of roles) {
        if (columnGrant) {
          const held = state.columns.get(role) ?? new Set<string>();
          for (const col of columnGrant[1]!.split(',').map(c => c.trim().toLowerCase())) {
            if (granting) held.add(col);
            else held.delete(col);
          }
          state.columns.set(role, held);
          continue;
        }
        const words = m[2]!
          .toUpperCase()
          .split(',')
          .map(w => w.trim().replace(/\s+PRIVILEGES$/, ''));
        const privs = words.includes('ALL') ? ALL : words;
        const held = state.table.get(role) ?? new Set<string>();
        for (const p of privs) {
          if (granting) held.add(p);
          else held.delete(p);
        }
        state.table.set(role, held);
        // A table-wide REVOKE UPDATE takes column grants with it.
        if (!granting && privs.includes('UPDATE')) {
          state.columns.delete(role);
        }
      }
      continue;
    }
    const create = s.match(/^CREATE POLICY "([^"]+)" ON (?:public\.)?bookings (?:FOR (\w+))?/i);
    if (create) {
      state.policies.set(create[1]!, { cmd: (create[2] ?? 'ALL').toUpperCase(), sql: s });
      continue;
    }
    const drop = s.match(/^DROP POLICY (?:IF EXISTS )?"([^"]+)" ON (?:public\.)?bookings/i);
    if (drop) {
      state.policies.delete(drop[1]!);
    }
  }
}

function replay(upTo?: string): State {
  const state: State = { table: new Map(), columns: new Map(), policies: new Map() };
  for (const file of readdirSync(DIR)
    .filter(f => f.endsWith('.sql'))
    .sort()) {
    if (upTo && file >= upTo) break;
    apply(state, readFileSync(join(DIR, file), 'utf8'));
  }
  return state;
}

describe('the replay reads what this repo writes', () => {
  it('sees the hole the baseline left, so a clean end state is not an empty parse', () => {
    const before = replay('20261114104100');
    expect(before.table.get('authenticated')?.has('UPDATE')).toBe(true);
    expect(before.table.get('authenticated')?.has('INSERT')).toBe(true);
    expect(before.policies.get('Customers can update their bookings')?.cmd).toBe('UPDATE');
    expect(before.policies.get('Customers can create bookings')?.cmd).toBe('INSERT');
  });
});

describe('a booking’s money is written by the server only', () => {
  const state = replay();

  it('clients hold no table-wide write', () => {
    for (const role of CLIENT_ROLES) {
      const held = state.table.get(role) ?? new Set();
      expect(held.has('SELECT')).toBe(true);
      for (const write of ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) {
        expect(held.has(write), `${role} holds ${write} on bookings`).toBe(false);
      }
    }
  });

  it('a session may update only what confirm, reject, complete and cancel write', () => {
    expect([...(state.columns.get('authenticated') ?? [])].sort()).toEqual(SESSION_WRITES);
    expect([...(state.columns.get('anon') ?? [])]).toEqual([]);
    for (const col of MONEY) {
      expect(state.columns.get('authenticated')?.has(col)).toBe(false);
    }
  });

  it('no client policy inserts a booking', () => {
    const inserts = [...state.policies.values()].filter(p => p.cmd === 'INSERT' || p.cmd === 'ALL');
    expect(inserts).toEqual([]);
  });

  it('the customer’s only update is cancelling their own open booking', () => {
    expect(state.policies.has('Customers can update their bookings')).toBe(false);
    const cancel = state.policies.get('Customers can cancel their bookings');
    expect(cancel?.cmd).toBe('UPDATE');
    // They cannot confirm their own booking, or mark it complete.
    expect(cancel?.sql).toMatch(/WITH CHECK \(.*status = 'cancelled'::text/i);
    expect(cancel?.sql).toMatch(/customer_user_id = \(SELECT auth\.uid\(\)\)/i);
  });
});
