/**
 * A public project update quoted two old handles that were plus-addressed
 * aliases of their owners' email addresses (`<local part>+ocauth<N>`), and the
 * mention renderer linked them to profiles that now 404.
 *
 * The migration was run twice against a scratch Postgres 16 with these rows:
 * the alias (and its repeated @mention) became "an old test account" in a
 * description and in a title, an ordinary plus-address and an @mention were
 * left alone, a NULL description stayed NULL, and the second run changed
 * nothing. This pins the pattern against a later edit.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const sql = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20261112101000_public_posts_drop_plus_alias_handles.sql'
  ),
  'utf8'
).replace(/^[ \t]*--.*$/gm, '');

const patterns = [...sql.matchAll(/regexp_replace\(\s*\w+,\s*'([^']+)'/g)].map(m => m[1]);
const redact = (text: string, pattern: string) =>
  text.replace(new RegExp(pattern, 'g'), 'an old test account');

describe('public posts drop plus-alias handles', () => {
  it('rewrites description and title, and only rows that carry an alias', () => {
    expect(patterns).toHaveLength(2);
    expect(sql).toMatch(/WHERE description ~ '\\\+ocauth\[0-9\]'/);
    expect(sql).toMatch(/WHERE title ~ '\\\+ocauth\[0-9\]'/);
  });

  it('replaces the alias and its repeated mention with one neutral phrase', () => {
    expect(redact('accounts like "jo.doe+ocauth1 @jo.doe+ocauth1", real', patterns[0])).toBe(
      'accounts like "an old test account", real'
    );
    expect(redact('Hello @ana+ocauth2', patterns[1])).toBe('Hello an old test account');
  });

  it('leaves ordinary plus-addresses and mentions alone', () => {
    const text = 'mail shop+orders@example.org or ask @bob';
    expect(redact(text, patterns[0])).toBe(text);
  });

  it('names no one: the file holds the shape, not a handle', () => {
    expect(sql).not.toMatch(/[a-z]\+ocauth\d/i);
  });
});
