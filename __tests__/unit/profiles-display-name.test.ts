/**
 * `profiles` has no `display_name` column. Select it as `display_name:name`.
 *
 * The person's display name lives in `profiles.name` (the baseline schema
 * comments it "User-friendly display name"). `display_name` is an `actors`
 * column, and the two tables sit side by side in almost every query, so the
 * wrong one keeps getting typed.
 *
 * It has cost a deploy and a feature. CD once refused to ship over a
 * `profiles.display_name` reference, and until 2026-10-06 the wishlist proofs
 * route embedded `profiles:user_id(..., display_name, ...)`: PostgREST rejects
 * an unknown embedded column, so listing the proofs of any real wishlist item
 * answered 500.
 *
 * check:schema-columns cannot see this — it validates entity form fields, not
 * `.select()` strings. Every other profiles query already aliases
 * (`display_name:name`); this gate makes the alias the only spelling that
 * passes.
 */

import fs from 'fs';
import path from 'path';

const SRC = path.join(process.cwd(), 'src');

function collectSources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectSources(full));
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

/** A bare `display_name` column — not the left side of an alias. */
const BARE_DISPLAY_NAME = /\bdisplay_name\b(?!\s*:)/;

/**
 * The column lists a query asks `profiles` for:
 *  - embeds:  `profiles:user_id(...)`, `creator:profiles!created_by(...)`
 *  - selects: `.from('profiles').select('...')`, `.from(DATABASE_TABLES.PROFILES)…`
 */
const PROFILES_EMBED = /\bprofiles[!:\w]*\(([^()]*)\)/g;
const PROFILES_SELECT =
  /\.from\(\s*(?:['"`]profiles['"`]|DATABASE_TABLES\.PROFILES)\s*\)\s*\.select\(\s*['"`]([^'"`]*)['"`]/g;

export function findViolations(source: string): string[] {
  const found: string[] = [];
  for (const pattern of [PROFILES_EMBED, PROFILES_SELECT]) {
    for (const match of source.matchAll(pattern)) {
      if (BARE_DISPLAY_NAME.test(match[1])) {
        found.push(match[0].replace(/\s+/g, ' ').trim());
      }
    }
  }
  return found;
}

describe('profiles is never asked for a display_name column', () => {
  it('flags a bare display_name in a profiles embed and select, and accepts the alias', () => {
    expect(findViolations(`profiles:user_id(id, username, display_name, avatar_url)`)).toHaveLength(
      1
    );
    expect(
      findViolations(`.from(DATABASE_TABLES.PROFILES).select('id, display_name')`)
    ).toHaveLength(1);
    expect(findViolations(`profiles:user_id(id, display_name:name)`)).toHaveLength(0);
    expect(findViolations(`.from('profiles').select('username, display_name:name')`)).toHaveLength(
      0
    );
    // actors really has display_name — only profiles is policed
    expect(findViolations(`.from(DATABASE_TABLES.ACTORS).select('id, display_name')`)).toHaveLength(
      0
    );
  });

  it('no file under src/ asks profiles for display_name', () => {
    const offenders: string[] = [];
    for (const file of collectSources(SRC)) {
      for (const hit of findViolations(fs.readFileSync(file, 'utf8'))) {
        offenders.push(`${path.relative(process.cwd(), file)}: ${hit}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
