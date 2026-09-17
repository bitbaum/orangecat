/**
 * One writer for a group's founder membership and actor row.
 *
 * Both are written by the `groups_get_an_identity_and_an_owner` trigger, in the
 * same transaction as the `groups` row itself.
 *
 * They used to be written by the application, as a second statement after the
 * group insert:
 *
 *   - `createGroup` treated its failure as `logger.warn` and still returned
 *     `{ success: true }`, so a failed insert left a group with no members.
 *     Both DELETE policies on `groups` require role='founder', so that group
 *     could be deleted by nobody. Production 2026-09-07: 3 of 9 groups.
 *   - Cat's `create_organization` wrote `role: 'admin'`, which no DELETE policy
 *     accepts. It had never fired (zero 'admin' rows in production) but would
 *     have minted undeletable groups the moment it did.
 *   - Neither path — nor any trigger, nor any backfill — ever wrote the
 *     group's `actors` row. Production 2026-09-07: 9 groups, 3 group actors.
 *
 * A second application statement can never be atomic with the first. The
 * trigger can. These tests keep a well-meaning re-addition from reintroducing
 * a second writer for a row that now has exactly one.
 *
 * NOTE ON METHOD: the assertions run against comment-STRIPPED source. The fixes
 * above ship with comments explaining them, and those comments name
 * `group_members` and quote `role: 'admin'` verbatim — so a naive scan of the
 * raw file is satisfied by the prose describing the thing it is meant to
 * forbid. Strip first, then match.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Remove block and line comments so assertions see code, never prose. */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
}

const read = (rel: string): string => codeOnly(readFileSync(join(process.cwd(), rel), 'utf8'));

const groupsService = read('src/services/groups/mutations/groups.ts');
const catOrgHandler = read('src/services/cat/handlers/organization.ts');

describe('the trigger is the only writer of a group owner', () => {
  it('createGroup does not insert a membership itself', () => {
    expect(groupsService).not.toMatch(/GROUP_MEMBERS/);
  });

  it("Cat's create_organization does not insert a membership itself", () => {
    // The invite action in the same file legitimately writes
    // GROUP_INVITATIONS; only the group_members insert is forbidden here.
    expect(catOrgHandler).not.toMatch(/GROUP_MEMBERS/);
  });

  it('no group-creation path hardcodes a founder or admin role', () => {
    for (const source of [groupsService, catOrgHandler]) {
      expect(source).not.toMatch(/role:\s*'founder'/);
      expect(source).not.toMatch(/role:\s*'admin'/);
    }
  });

  it('the comment-stripper actually removes prose, or the tests above are vacuous', () => {
    // Guards the method itself: if `codeOnly` silently stopped stripping, every
    // negative assertion above would start failing for the right reason — but a
    // weaker stripper (block comments only) would let them pass while the file
    // still described `role: 'admin'`. Prove both shapes are removed.
    expect(codeOnly("// role: 'admin'\nconst a = 1;")).not.toMatch(/role:/);
    expect(codeOnly('/* GROUP_MEMBERS */\nconst b = 2;')).not.toMatch(/GROUP_MEMBERS/);
    // And prove it does NOT strip real code that merely looks similar.
    expect(codeOnly("const url = 'https://x/y';")).toMatch(/https:/);
  });
});

describe('the migration that took ownership', () => {
  const migration = readFileSync(
    join(
      process.cwd(),
      'supabase/migrations/20260907100000_a_group_is_born_with_an_identity_and_an_owner.sql'
    ),
    'utf8'
  );

  it('creates the trigger on groups', () => {
    expect(migration).toMatch(/CREATE TRIGGER groups_get_an_identity_and_an_owner/);
    expect(migration).toMatch(/AFTER INSERT ON public\.groups/);
  });

  it('writes both the actor and the founder membership', () => {
    expect(migration).toMatch(/INSERT INTO public\.actors/);
    expect(migration).toMatch(/INSERT INTO public\.group_members/);
  });

  it('backfills without overwriting an existing owner', () => {
    // The membership backfill must only touch groups with NO members at all,
    // so it can never demote or duplicate a real one.
    expect(migration).toMatch(/ON CONFLICT \(group_id, user_id\) DO NOTHING/);
    expect(migration).toMatch(/NOT EXISTS/);
  });

  it('keeps one actor per group enforceable', () => {
    expect(migration).toMatch(/CREATE UNIQUE INDEX[\s\S]*?actors_group_id_unique/);
  });
});
