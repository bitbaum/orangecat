/**
 * Discover counted three CI audit groups it never listed ("8 organizations",
 * five cards): the search functions took every fixture rule as a parameter
 * except the one for group names, which the app applied to the rows after.
 *
 * The migration was applied (in one transaction, as scripts/apply-migrations.sh
 * does) to a scratch Postgres 16 holding the three functions as they stood and
 * nine groups and two projects. With the app's own FIXTURE_RPC_ARGS:
 * public_counts said group 6 (9 without the new argument, as an old caller
 * gets), search_public browsed six groups with a total of 6, a project named
 * like an audit group stayed, the vocabulary lost the fixture names, and
 * global_search still resolved. For 21 names, Postgres `~*` and the JS check
 * gave the same verdict. This pins that shape against a later edit.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FIXTURE_RPC_ARGS } from '@/services/search/public-search';

const sql = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20261112202000_discover_counts_only_the_groups_it_lists.sql'
  ),
  'utf8'
).replace(/^[ \t]*--.*$/gm, '');

/** The parameter names a CREATE FUNCTION in this file declares. */
function params(fn: string): string[] {
  const head = sql.match(new RegExp(`CREATE FUNCTION public\\.${fn}\\(([\\s\\S]*?)\\)\\s*RETURNS`));
  expect(head, `${fn} is created`).not.toBeNull();
  return [...(head?.[1] ?? '').matchAll(/(p_\w+)\s/g)].map(m => m[1]);
}

/** The body of a function created in this file. */
function body(fn: string): string {
  const start = sql.indexOf(`CREATE FUNCTION public.${fn}(`);
  return sql.slice(start, sql.indexOf('$$;', sql.indexOf('AS $$', start)));
}

const GROUP_RULE =
  /NOT \(d\.entity_type = 'group' AND coalesce\(d\.title, ''\) ~\* ANY \((gx|coalesce\(p_exclude_group_names, '\{\}'\))\)\)/g;

describe('Discover counts only the groups it lists', () => {
  it('takes every fixture argument the app sends, in all three functions', () => {
    for (const fn of ['search_public', 'public_counts', 'public_search_text']) {
      expect(params(fn)).toEqual(expect.arrayContaining(Object.keys(FIXTURE_RPC_ARGS)));
    }
  });

  it('adds the group-name rule last, with a default, so an older caller is unchanged', () => {
    expect(params('search_public').at(-1)).toBe('p_exclude_group_names');
    expect(params('public_counts').at(-1)).toBe('p_exclude_group_names');
    expect(params('public_search_text').at(-1)).toBe('p_exclude_group_names');
    expect(sql).not.toMatch(/p_exclude_group_names text\[\](?! DEFAULT NULL)/);
  });

  it('applies the rule to group rows only, in browse, search, counts and vocabulary', () => {
    expect(body('search_public').match(GROUP_RULE)).toHaveLength(2);
    expect(body('public_counts').match(GROUP_RULE)).toHaveLength(1);
    expect(body('public_search_text').match(GROUP_RULE)).toHaveLength(1);
  });

  it('grants the new signatures and drops only the old ones', () => {
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.search_public\(text, text\[\], integer, integer, integer, text\[\], text\[\], text\[\], text\[\], text\[\]\) TO anon, authenticated, service_role;/
    );
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.public_counts\(text\[\], text\[\], text\[\], text\[\]\) TO anon, authenticated, service_role;/
    );
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.public_search_text\(text\[\], text\[\], text\[\], text\[\]\) TO anon, authenticated, service_role;/
    );
    expect(sql).toMatch(
      /DROP FUNCTION IF EXISTS public\.search_public\(text, text\[\], integer, integer, integer, text\[\], text\[\], text\[\], text\[\]\);/
    );
  });
});
