/**
 * The migration that keeps a "Members only" group's members, events and
 * proposals to its members.
 *
 * It was run against a scratch Postgres 16 (baseline policies verbatim, then
 * this file, then this file again) and probed as `anon` and `authenticated`:
 * before, a stranger read the members-only group's member row, its
 * default-public event, that event's RSVP and its public proposal, and could
 * call get_user_groups for anyone; after, a stranger reads only the public
 * group's rows, a listed group with a NULL visibility is closed too, a member
 * still reads everything of their own group, and get_user_groups answers
 * service_role only.
 *
 * Adversarial review then found is_group_member / get_user_group_role still
 * answered anon about anyone (`role(<group>, <admin>)` -> 'admin'), which
 * rebuilt the member list. With the guard, anon and a stranger get false /
 * NULL about others, a member gets true / their role about themselves, the
 * founder/admin/member write policies and the events-at-a-place trigger behave
 * exactly as before, and service_role still gets every answer. A NULL
 * visibility is backfilled and the column is NOT NULL. These pin those rules
 * against a later edit.
 * Comment-blind, because the migration's prose names every identifier.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const raw = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20261112235900_members_only_groups_hide_their_members.sql'
  ),
  'utf8'
);
const sql = raw.replace(/^[ \t]*--.*$/gm, '').replace(/\s+/g, ' ');

const policy = (name: string, table: string) => {
  const head = `CREATE POLICY ${name} ON public.${table}`;
  const start = sql.indexOf(head);
  expect(start, `${name} on ${table}`).toBeGreaterThan(-1);
  expect(sql, `${name} is dropped first, so the file re-runs`).toContain(
    `DROP POLICY IF EXISTS ${name} ON public.${table};`
  );
  return sql.slice(start, sql.indexOf(';', start));
};

// The open-content test, as each policy must spell it.
const OPEN = /g\.is_public = true AND g\.visibility = 'public'/;

describe('members-only groups hide their members', () => {
  it('shows anon the members of an open group only', () => {
    const p = policy('group_members_select_anon', 'group_members');
    expect(p).toMatch(/FOR SELECT TO anon/);
    expect(p).toMatch(OPEN);
  });

  it('shows a signed-in stranger the same, and a member their own group', () => {
    const p = policy('group_members_select_auth', 'group_members');
    expect(p).toMatch(/FOR SELECT TO authenticated/);
    expect(p).toMatch(OPEN);
    expect(p).toMatch(/user_id = \(SELECT auth\.uid\(\)\)/);
    expect(p).toMatch(/public\.is_group_member\(group_id, \(SELECT auth\.uid\(\)\)\)/);
  });

  it('opens a public event only in an open group; members keep theirs', () => {
    const p = policy('"Public events are viewable"', 'group_events');
    expect(p).toMatch(/is_public = true AND EXISTS/);
    expect(p).toMatch(OPEN);
    expect(p).toMatch(/gm\.user_id = \(SELECT auth\.uid\(\)\)/);
  });

  it('opens a public proposal only in an open group', () => {
    const p = policy('"Public can view public proposals"', 'group_proposals');
    expect(p).toMatch(/is_public = true AND EXISTS/);
    expect(p).toMatch(OPEN);
  });

  it('never lets a listed group pass on being listed alone', () => {
    const listed = sql.match(/g\.is_public = true/g) ?? [];
    const open = sql.match(new RegExp(OPEN.source, 'g')) ?? [];
    expect(listed.length).toBe(4);
    expect(open.length).toBe(listed.length);
  });

  it('takes get_user_groups away from anon and authenticated', () => {
    expect(sql).toContain(
      'REVOKE EXECUTE ON FUNCTION public.get_user_groups(uuid) FROM PUBLIC, anon, authenticated;'
    );
    expect(sql).toContain(
      'GRANT EXECUTE ON FUNCTION public.get_user_groups(uuid) TO service_role;'
    );
    expect(sql).not.toMatch(
      /GRANT [A-Z, ]+ ON FUNCTION public\.get_user_groups\(uuid\) TO [^;]*(anon|authenticated)/
    );
  });

  const fn = (name: string) => {
    const head = `CREATE OR REPLACE FUNCTION public.${name}(p_group_id uuid, p_user_id uuid)`;
    const start = sql.indexOf(head);
    expect(start, name).toBeGreaterThan(-1);
    return sql.slice(start, sql.indexOf('$$;', start));
  };

  // anon and authenticated may ask only about themselves; any other role
  // (service_role, a migration) is answered as before.
  const ONLY_ABOUT_SELF =
    /p_user_id = \(SELECT auth\.uid\(\)\) OR COALESCE\(current_setting\('role', true\), 'none'\) NOT IN \('anon', 'authenticated'\)/;

  it.each(['is_group_member', 'get_user_group_role'])(
    'answers anon and a stranger about themselves only: %s',
    name => {
      const body = fn(name);
      expect(body).toMatch(/SECURITY DEFINER SET search_path TO ''/);
      expect(body).toMatch(ONLY_ABOUT_SELF);
      expect(body).toMatch(/user_id = p_user_id/);
    }
  );

  it('keeps is_group_member a plain boolean, never NULL', () => {
    expect(fn('is_group_member')).toMatch(/RETURNS boolean .*SELECT COALESCE\(.*, false \);/);
  });

  it('leaves EXECUTE on the membership functions where the policies need it', () => {
    expect(sql).not.toMatch(
      /(REVOKE|GRANT) [A-Z, ]+ ON FUNCTION public\.(is_group_member|get_user_group_role)/
    );
  });

  it('gives a NULL visibility the value the settings form shows, then forbids it', () => {
    expect(sql).toContain(
      "UPDATE public.groups SET visibility = CASE WHEN is_public THEN 'members_only' ELSE 'private' END WHERE visibility IS NULL;"
    );
    expect(sql).toContain('ALTER TABLE public.groups ALTER COLUMN visibility SET NOT NULL;');
    expect(sql.indexOf('UPDATE public.groups')).toBeLessThan(sql.indexOf('SET NOT NULL'));
  });

  it('opens nothing else', () => {
    expect(sql).not.toMatch(/GRANT (SELECT|INSERT|UPDATE|DELETE|ALL)/);
    expect(sql).not.toMatch(/FOR (INSERT|UPDATE|DELETE|ALL)/);
    expect((sql.match(/CREATE POLICY/g) ?? []).length).toBe(4);
  });
});
