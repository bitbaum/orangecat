/**
 * A role the database forbids is a permission nobody can hold.
 *
 * Three places filtered group membership on
 * `['founder', 'admin', 'moderator']` — but `group_members_role_check` permits
 * only `founder | admin | member`, so a `moderator` row cannot exist. The
 * filter matched nothing, forever, silently. Nothing errors; the capability
 * simply never applies, while the code reads as though moderators may act for
 * their group.
 *
 * (`membership_role_enum` DOES contain 'moderator' — which is how the value got
 * here — but no table uses that type. It is an orphan, and believing it was the
 * group-member role is the whole mistake.)
 *
 * Measured in production 2026-09-10: 9 memberships, every one `founder`. Zero
 * `admin`, zero `moderator` — so nothing depended on the dead value.
 *
 * This test reads the CONSTRAINT out of the migration, so it fails if the role
 * list ever drifts from what the database will accept again — in either
 * direction. That is the class closed, not the instance fixed.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PRIVILEGED_ROLES } from '@/services/actors/resolveCreationActor';

/** The roles `group_members.role` actually accepts, parsed from the schema. */
function rolesAllowedByTheDatabase(): string[] {
  const baseline = readFileSync(
    join(process.cwd(), 'supabase/migrations/20240101000001_baseline_public_schema.sql'),
    'utf8'
  );
  const match = baseline.match(/group_members_role_check CHECK \(\(role = ANY \(ARRAY\[([^\]]*)\]/);
  if (!match) {
    throw new Error(
      'Could not find group_members_role_check in the baseline schema. If the ' +
        'constraint moved to a later migration, point this parser at it — do ' +
        'not delete the assertion, which is the only thing tying the code list ' +
        'to the database.'
    );
  }
  return [...match[1].matchAll(/'([a-z_]+)'::text/g)].map(m => m[1]);
}

describe('privileged roles exist in the database', () => {
  it('parses the constraint, so this test cannot pass vacuously', () => {
    const allowed = rolesAllowedByTheDatabase();
    // If the parser silently returned [] the subset check below would pass for
    // the wrong reason — an empty superset accepts nothing, but an empty
    // subset-of-empty also "passes". Pin the real values.
    expect(allowed).toEqual(['founder', 'admin', 'member']);
  });

  it('every privileged role is one the database will accept', () => {
    const allowed = new Set(rolesAllowedByTheDatabase());
    const impossible = PRIVILEGED_ROLES.filter(role => !allowed.has(role));

    expect(impossible).toEqual([]);
  });

  it('does not claim a role that cannot exist', () => {
    // The specific regression: 'moderator' is in `membership_role_enum`, which
    // no table uses, and was filtered on for group membership.
    expect(PRIVILEGED_ROLES as readonly string[]).not.toContain('moderator');
  });

  it('still grants the roles that actually run a group', () => {
    // Narrowing must not go too far: removing 'admin' would stop real admins
    // creating for their organization.
    expect(PRIVILEGED_ROLES as readonly string[]).toContain('founder');
    expect(PRIVILEGED_ROLES as readonly string[]).toContain('admin');
  });
});

describe('the role list is not repeated', () => {
  const files = [
    'src/features/messaging/api-helpers.server.ts',
    'src/features/messaging/server/mutations.ts',
  ];

  it('both messaging filters use the shared list instead of their own literal', () => {
    // Three copies is how 'moderator' survived in two of them after anyone
    // thought about it in the third.
    for (const rel of files) {
      const source = readFileSync(join(process.cwd(), rel), 'utf8');
      expect(source).toContain('PRIVILEGED_ROLES');
      expect(source).not.toMatch(/\.in\('role', \['founder'/);
    }
  });
});
