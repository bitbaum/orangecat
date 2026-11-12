/**
 * The migration that stops an event taking tickets once it is over.
 *
 * It was run against a scratch Postgres 16 (the three ticket migrations, then
 * this one twice) with every case exercised: a guest (anon) and a signed-in
 * person are both refused at an event whose start passed with no end, one
 * whose end passed, one marked completed, and an all-day event from
 * yesterday; both still get a ticket to an event ahead, to one that started
 * but has not ended, and to an all-day event today (Zurich clock, where a
 * timed event at the same instant is already over); an unknown zone reads in
 * UTC; anon cannot call the rule directly; and settlement still issues a paid
 * ticket for money that moved after the end. These pin those rules against a
 * later edit. Comment-blind, because the migration's prose names every
 * identifier.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const raw = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20261112154700_an_event_that_is_over_takes_no_tickets.sql'
  ),
  'utf8'
);
const sql = raw.replace(/^[ \t]*--.*$/gm, '');

const fn = (name: string) => {
  const start = sql.indexOf(`FUNCTION public.${name}(`);
  expect(start, name).toBeGreaterThan(-1);
  return sql.slice(start, sql.indexOf('$$;', start));
};

describe('an event that is over takes no tickets', () => {
  it('holds the rule once: completed, or past its end — its start when it has none', () => {
    const rule = fn('event_has_ended');
    expect(rule).toMatch(/p_event\.status = 'completed'/);
    expect(rule).toMatch(/coalesce\(p_event\.end_date, p_event\.start_date\)/);
    expect(rule).toMatch(/RETURN v_last < now\(\)/);
  });

  it('runs an all-day event to midnight after its last day, on the venue’s clock', () => {
    const rule = fn('event_has_ended');
    expect(rule).toMatch(/IF p_event\.is_all_day THEN/);
    expect(rule).toMatch(
      /\(\(v_last AT TIME ZONE v_zone\)::date \+ 1\)::timestamp AT TIME ZONE v_zone/
    );
    expect(rule).toMatch(/EXCEPTION WHEN invalid_parameter_value/);
  });

  it.each(['claim_free_ticket', 'claim_guest_ticket'])(
    '%s refuses an event that has ended, after taking the row lock',
    name => {
      const claim = fn(name);
      const lock = claim.indexOf('FOR UPDATE');
      const refuse = claim.indexOf('IF public.event_has_ended(v_event) THEN');
      expect(lock).toBeGreaterThan(-1);
      expect(refuse).toBeGreaterThan(lock);
      expect(claim.slice(refuse)).toMatch(
        /^IF public\.event_has_ended\(v_event\) THEN\s+RAISE EXCEPTION 'This event has ended' USING ERRCODE = 'P0002';/
      );
      // The seat is taken after the refusal, never before.
      expect(claim.indexOf('INSERT INTO public.event_attendees')).toBeGreaterThan(refuse);
    }
  );

  it('leaves settlement alone: money that moved still gets its ticket', () => {
    expect(sql).not.toMatch(/FUNCTION public\.issue_paid_ticket\(/);
    expect(sql).not.toMatch(/FUNCTION public\.issue_paid_guest_ticket\(/);
  });

  it('opens nothing new to callers', () => {
    expect(sql).toContain(
      'REVOKE ALL ON FUNCTION public.event_has_ended(public.events) FROM PUBLIC, anon, authenticated;'
    );
    expect(sql).not.toMatch(
      /GRANT EXECUTE ON FUNCTION public\.event_has_ended[^;]*(anon|authenticated)/
    );
    expect(sql).not.toMatch(/CREATE POLICY|GRANT (INSERT|UPDATE|DELETE)/);
  });
});
