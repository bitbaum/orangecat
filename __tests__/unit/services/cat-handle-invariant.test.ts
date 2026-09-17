/**
 * The nightly gate hardcodes the Cat's handle. This is what stops that from
 * becoming a second definition of it.
 *
 * `scripts/check-data-invariants.mjs` runs against production over PostgREST
 * and cannot import from `src/` — it is a standalone .mjs with no build step and
 * no path aliases. So it carries the string `cat` of its own. That is exactly
 * the shape that has already cost this codebase real bugs: three definitions of
 * what an `@handle` is meant the resolver notified one person while the
 * renderer linked another.
 *
 * A duplicated literal is acceptable only when something fails the moment the
 * two disagree. This is that something.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { CAT_USERNAME } from '@/config/cat-identity';

const script = readFileSync(
  join(process.cwd(), 'scripts/check-data-invariants.mjs'),
  'utf8'
);

describe('the invariant gate and the Cat agree on the handle', () => {
  it('checks the handle the Cat actually answers to', () => {
    const declared = /const CAT_HANDLE = '([^']+)'/.exec(script);

    // If this is null the check was renamed or removed. Either way the gate no
    // longer guards `@cat`, which is the thing worth knowing.
    expect(declared).not.toBeNull();
    expect(declared![1]).toBe(CAT_USERNAME);
  });

  it('asks by handle, not by id — an id lookup would pass while @cat was broken', () => {
    // The whole failure this gate exists for was: account healthy, handle gone.
    // Querying profiles by id would have been green throughout.
    expect(script).toMatch(/profiles\?select=[^`]*&username=eq\.\$\{CAT_HANDLE\}/);
  });
});
