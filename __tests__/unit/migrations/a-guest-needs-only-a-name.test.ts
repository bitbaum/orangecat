/**
 * The migration that lets someone without an account get a free ticket.
 *
 * The migration was also run against a scratch Postgres 16 (the ticket
 * migration first, then this one, then this one again) with every rule
 * exercised as `anon` and `authenticated`: a guest claims, the last seat goes
 * to one, a full event refuses, an empty or 81-character name is refused, a
 * paid or draft event refuses, anon cannot read the guest list or insert a
 * row, a code reads its own guest ticket and nothing else, a signed-in
 * person's ticket is never readable by code, giving back frees the seat and
 * re-opens a full event, a checked-in ticket cannot be given back, and two
 * guests with the same name both fit. These pin those rules against a later
 * edit. Comment-blind, because the migration's prose names every identifier.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const raw = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261007160000_guest_tickets_without_an_account.sql'),
  'utf8'
);
const sql = raw.replace(/^[ \t]*--.*$/gm, '');

const fn = (name: string) => {
  const start = sql.indexOf(`FUNCTION public.${name}(`);
  expect(start, name).toBeGreaterThan(-1);
  return sql.slice(start, sql.indexOf('$$;', start));
};

describe('a guest needs only a name', () => {
  it('lets a row hold a guest name instead of a person, but never neither', () => {
    expect(sql).toMatch(/ALTER COLUMN user_id DROP NOT NULL/);
    expect(sql).toMatch(/CHECK \(user_id IS NOT NULL OR \(guest_name IS NOT NULL/);
  });

  it('gives guests FREE seats only, under the same lock and capacity rule', () => {
    const claim = fn('claim_guest_ticket');
    expect(claim).toMatch(/v_event\.is_free OR coalesce\(v_event\.ticket_price, 0\) = 0/);
    expect(claim).toMatch(/FOR UPDATE/);
    expect(claim).toMatch(/v_used >= v_event\.max_attendees/);
    expect(claim).toMatch(/'free'/);
  });

  it('bounds the name', () => {
    expect(fn('claim_guest_ticket')).toMatch(/length\(v_name\) < 1 OR length\(v_name\) > 80/);
  });

  it('never reads or cancels a signed-in person’s ticket by code', () => {
    expect(fn('guest_ticket')).toMatch(/a\.user_id IS NULL/);
    expect(fn('cancel_guest_ticket')).toMatch(/user_id IS NULL/);
  });

  it('cannot give back a ticket that already got someone in', () => {
    expect(fn('cancel_guest_ticket')).toMatch(/checked_in_at IS NULL/);
  });

  it('is callable signed out — that is the point — and nothing else is opened', () => {
    for (const f of [
      'claim_guest_ticket(uuid, text)',
      'guest_ticket(text)',
      'cancel_guest_ticket(text)',
    ]) {
      expect(sql).toContain(`REVOKE ALL ON FUNCTION public.${f} FROM PUBLIC;`);
      expect(sql).toContain(
        `GRANT EXECUTE ON FUNCTION public.${f} TO anon, authenticated, service_role;`
      );
    }
    expect(sql).not.toMatch(/CREATE POLICY/);
    expect(sql).not.toMatch(/GRANT (INSERT|UPDATE|DELETE)/);
  });
});
