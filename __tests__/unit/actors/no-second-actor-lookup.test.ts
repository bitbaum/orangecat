import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Nobody writes the user-actor lookup by hand again.
 *
 * Fixing sixteen copies is worth little if the seventeenth lands next week, and
 * this one is not a style matter: every hand-written copy used `maybeSingle()`
 * or `single()`, and both answer 406 when a user has more than one actor —
 * which is possible, because `idx_actors_user_id` is a plain partial index and
 * not a unique one. Each copy then read that error as "this person has no
 * actor". One account with six actors was, simultaneously, 404'd out of Cat
 * actions, 401'd out of stakeholders, shown no projects, and told it did not
 * own its own article.
 *
 * `src/domain/actors/index.ts` owns the query. Everything else asks it.
 */

const SRC = 'src';
const OWNER = join('src', 'domain', 'actors');

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      sourceFiles(path, out);
    } else if (/\.tsx?$/.test(name)) {
      out.push(path);
    }
  }
  return out;
}

/**
 * A query on ACTORS that selects `id` and filters BOTH `user_id` and
 * `actor_type = 'user'` is the lookup this module owns. Selecting other columns
 * (a profile join, say) is a different question and is left alone.
 */
function findsAUserActor(sql: string): boolean {
  if (!/eq\(\s*'actor_type'\s*,\s*'user'\s*\)/.test(sql)) return false;
  if (!/eq\(\s*'user_id'/.test(sql)) return false;
  return /select\(\s*'id'/.test(sql);
}

describe('only one module asks which actor a user is', () => {
  const files = sourceFiles(SRC).filter(f => !f.startsWith(OWNER));

  it('scans a real set of files rather than silently none', () => {
    // A path typo here would turn the assertion below into a green light over
    // nothing at all.
    expect(files.length).toBeGreaterThan(500);
    expect(files.some(f => f.includes(join('src', 'services')))).toBe(true);
  });

  it('finds no hand-written user-actor lookup outside src/domain/actors', () => {
    const offenders: Array<{ file: string; line: number }> = [];

    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      if (!text.includes('DATABASE_TABLES.ACTORS')) continue;

      // Each ACTORS query, read as far as the next statement break.
      let from = 0;
      for (;;) {
        const at = text.indexOf('DATABASE_TABLES.ACTORS', from);
        if (at === -1) break;
        const window = text.slice(at, at + 400).split(';')[0] ?? '';
        if (findsAUserActor(window)) {
          offenders.push({ file, line: text.slice(0, at).split('\n').length });
        }
        from = at + 1;
      }
    }

    expect(
      offenders,
      'Use getUserActorId / lookupUserActor from @/domain/actors. A hand-written ' +
        'copy reads "several actors" as "no actor" and locks that person out.'
    ).toEqual([]);
  });
});
