/**
 * The migration that makes ADR-0005's money invariant structural.
 *
 * An unclaimed actor is a real, visible identity that owns real rows and can
 * receive NOTHING until its subject accepts. That has to hold in the database,
 * not in a route someone remembers to check. These assertions pin the four
 * things the migration must keep doing; the migration itself was applied to
 * the live schema inside a rolled-back transaction before it was committed.
 *
 * Source-level because DDL is not unit-testable here; comment-blind because
 * the migration's own prose names every one of these identifiers.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const raw = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20260907140000_an_unclaimed_actor_owns_a_page_but_cannot_be_paid.sql'
  ),
  'utf8'
);
// Strip `-- ...` comments so prose cannot satisfy a code assertion.
const sql = raw.replace(/^[ \t]*--.*$/gm, '');

describe('an unclaimed actor is a real kind of actor', () => {
  it('widens actor_type to include unclaimed', () => {
    expect(sql).toMatch(/actors_actor_type_check[\s\S]*?'unclaimed'::text/);
  });

  it('requires a placeholder to carry a claim, a name and a slug — and no user or group', () => {
    expect(sql).toMatch(
      /actor_type = 'unclaimed'\s+AND claim_id IS NOT NULL\s+AND user_id IS NULL\s+AND group_id IS NULL\s+AND display_name IS NOT NULL AND slug IS NOT NULL/
    );
  });
});

describe('nothing an unclaimed actor owns can have a wallet', () => {
  it('guards all three wallet tables with the same trigger function', () => {
    for (const table of ['wallets', 'group_wallets', 'entity_wallets']) {
      const re = new RegExp(
        `CREATE TRIGGER ${table}_refuse_unclaimed_owner\\s+BEFORE INSERT OR UPDATE OF \\w+ ON public\\.${table}\\s+FOR EACH ROW EXECUTE FUNCTION public\\.refuse_wallet_for_unclaimed_owner\\(\\)`
      );
      expect(sql).toMatch(re);
    }
  });

  it('refuses, rather than silently allowing', () => {
    expect(sql).toMatch(/RAISE EXCEPTION[\s\S]*?cannot receive funds until they do/);
  });
});

describe('claim and decline walk the catalog, not a hand-written list', () => {
  it('derives the owner columns from information_schema', () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.actor_owner_columns\(\)/);
    expect(sql).toMatch(/information_schema\.table_constraints/);
    expect(sql).toMatch(/ccu\.table_name = 'actors'/);
  });

  it('claim moves ownership with one UPDATE per owner column', () => {
    expect(sql).toMatch(
      /FOR r IN SELECT \* FROM public\.actor_owner_columns\(\) LOOP\s+EXECUTE format\('UPDATE public\.%I SET %I = \$1 WHERE %I = \$2'/
    );
  });

  it('decline deletes owned rows BEFORE the placeholder', () => {
    // 10 of the 25 owner FKs are ON DELETE SET NULL; deleting the actor alone
    // would leave ownerless fundable rows behind.
    const decline = sql.slice(sql.indexOf('decline_placeholder_actor'));
    const deleteOwned = decline.indexOf("EXECUTE format('DELETE FROM public.%I WHERE %I = $1'");
    const deleteActor = decline.indexOf('DELETE FROM public.actors WHERE id = v_placeholder');
    expect(deleteOwned).toBeGreaterThan(-1);
    expect(deleteActor).toBeGreaterThan(deleteOwned);
  });

  it('refuses to claim anything that is not a pending claim on an unclaimed actor', () => {
    const claim = sql.slice(
      sql.indexOf('claim_placeholder_actor'),
      sql.indexOf('decline_placeholder_actor')
    );
    expect(claim).toMatch(/IF v_status <> 'pending' THEN\s+RAISE EXCEPTION/);
    expect(claim).toMatch(
      /IF NOT public\.actor_is_unclaimed\(v_placeholder\) THEN\s+RAISE EXCEPTION/
    );
  });
});

describe('the transfer functions are not callable from a browser session', () => {
  it('revokes from anon and authenticated, grants only to service_role', () => {
    // Plain substring, not a constructed RegExp. Building one from these
    // signatures meant escaping their parentheses by hand, which CodeQL
    // correctly flagged as incomplete sanitization (it escaped `()` but not
    // backslashes). Nothing here needs a pattern — the text is exact.
    for (const fn of ['claim_placeholder_actor(uuid, uuid)', 'decline_placeholder_actor(uuid)']) {
      expect(sql).toContain(`REVOKE ALL ON FUNCTION public.${fn} FROM PUBLIC, anon, authenticated`);
      expect(sql).toContain(`GRANT EXECUTE ON FUNCTION public.${fn} TO service_role`);
    }
  });

  it('never hands the handle out from SQL — RESERVED_USERNAMES lives in the app', () => {
    // The one source of truth for reserved handles is src/config/usernames.ts.
    // A username write here would be a second door around it — the exact hole
    // fixed in #903.
    expect(sql).not.toMatch(/SET username/i);
    expect(sql).not.toMatch(/UPDATE public\.profiles/);
  });
});
