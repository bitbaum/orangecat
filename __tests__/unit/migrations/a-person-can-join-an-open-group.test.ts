/**
 * The migration that lets a person join an open group by themselves.
 *
 * Joining inserted into group_members as the joiner, which that table's policy
 * allows only to a group's creator or its founders and admins, so nobody else
 * could ever join (live review 2026-11-12). join_public_group does it as
 * definer instead.
 *
 * The migration was also run against a scratch Postgres 16 (twice) with the
 * baseline's group_members policies: the old self-insert is refused by the
 * policy; anon and service_role cannot call the function; a signed-in person
 * joins a listed public group as 'member' with no inviter; a second call, and
 * the founder's, answer "already a member" and leave one row with its role;
 * members-only, private, unlisted, null-visibility and missing groups are all
 * refused with one sentence and add nothing. These pin those rules against a
 * later edit. Comment-blind, because the migration's prose names every
 * identifier.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const raw = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261112201000_a_person_can_join_an_open_group.sql'),
  'utf8'
);
const sql = raw.replace(/^[ \t]*--.*$/gm, '');

const body = (() => {
  const start = sql.indexOf('FUNCTION public.join_public_group(p_group_id uuid)');
  expect(start).toBeGreaterThan(-1);
  return sql.slice(start, sql.indexOf('$$;', start));
})();

describe('a person can join an open group', () => {
  it('runs as definer with a pinned search_path', () => {
    expect(body).toMatch(/SECURITY DEFINER/);
    expect(body).toMatch(/SET search_path = public/);
  });

  it('adds the caller and nobody else, as a plain member', () => {
    expect(body).toMatch(/v_user uuid := auth\.uid\(\)/);
    expect(body).toMatch(/IF v_user IS NULL THEN\s+RETURN jsonb_build_object\('success', false/);
    expect(body).toMatch(
      /INSERT INTO group_members \(group_id, user_id, role, invited_by\)\s+VALUES \(p_group_id, v_user, 'member', NULL\)/
    );
    // Only the one insert: no update of an existing row's role.
    expect(body.match(/INSERT INTO/g)).toHaveLength(1);
    expect(body).not.toMatch(/UPDATE\s+group_members/);
  });

  it('opens only a listed group whose visibility is public, under a lock', () => {
    expect(body).toMatch(/FOR SHARE/);
    expect(body).toMatch(
      /IF NOT FOUND OR g\.is_public IS NOT TRUE OR g\.visibility IS DISTINCT FROM 'public' THEN\s+RETURN jsonb_build_object\(\s*'success', false/
    );
  });

  it('refuses an existing member instead of failing on the unique key', () => {
    expect(body).toMatch(/ON CONFLICT \(group_id, user_id\) DO NOTHING;\s+IF NOT FOUND THEN/);
    expect(body).toMatch(/already a member/);
  });

  it('names every refusal with a code the route maps to a status', () => {
    for (const code of ['not_signed_in', 'invitation_only', 'already_member']) {
      expect(body).toContain(`'code', '${code}'`);
    }
    expect(body.match(/'success', false/g)).toHaveLength(3);
    expect(body.match(/'code', '/g)).toHaveLength(3);
  });

  it('is callable by signed-in people only, and opens nothing else', () => {
    expect(sql).toContain(
      'REVOKE ALL ON FUNCTION public.join_public_group(uuid) FROM PUBLIC, anon, service_role;'
    );
    expect(sql).toContain(
      'GRANT EXECUTE ON FUNCTION public.join_public_group(uuid) TO authenticated;'
    );
    expect(sql.match(/GRANT /g)).toHaveLength(1);
    expect(sql).not.toMatch(/CREATE POLICY|DROP POLICY|ALTER POLICY/);
    expect(sql).not.toMatch(/GRANT (INSERT|UPDATE|DELETE)/);
  });
});
