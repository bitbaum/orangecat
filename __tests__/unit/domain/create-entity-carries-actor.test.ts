/**
 * The API layer resolves WHO an entity is created for (a group, or the
 * placeholder of a page set up for someone else — ADR-0005) and passes it as
 * `_resolved_actor_id`. Five domain services rebuilt their insert from named
 * fields and dropped it, so createEntity fell back to the caller's own actor
 * — seen in prod 2026-09-10: a project "for Walkthrough Testperson" owned by
 * the steward, no band, fundable by the wrong person. This pins the carrier
 * on every rebuilt payload, and the carrier's behaviour.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { withResolvedActor } from '@/domain/base/entityService';

const DOMAIN = join(process.cwd(), 'src', 'domain');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : full.endsWith('.ts') ? [full] : [];
  });
}

describe('every domain create that rebuilds its payload carries the resolved actor', () => {
  it('wraps the object literal in withResolvedActor', () => {
    const offenders: string[] = [];
    for (const file of walk(DOMAIN)) {
      if (file.includes('/base/')) continue;
      // obligation.ts inserts a loan the SYSTEM originates (an obligation between
      // two people), never from a request body — there is no resolved actor to carry.
      if (file.endsWith('/loans/obligation.ts')) continue;
      const src = readFileSync(file, 'utf8');
      // createEntity('type', user, {   or   createEntity(\n 'type',\n user,\n {
      const calls = src.matchAll(/createEntity\(\s*'[a-z_]+',\s*\w+,\s*(\{|withResolvedActor\()/g);
      for (const m of calls) {
        if (m[1] === '{') offenders.push(file.replace(process.cwd() + '/', ''));
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('withResolvedActor', () => {
  it('copies the side-channels and nothing else', () => {
    const out = withResolvedActor(
      {
        _resolved_actor_id: 'placeholder',
        _resolved_is_test: true,
        title: 'ignored',
        actor_id: 'x',
      },
      { title: 'Studio' }
    );
    expect(out).toEqual({
      title: 'Studio',
      _resolved_actor_id: 'placeholder',
      _resolved_is_test: true,
    });
  });

  it('adds nothing when the source carries nothing', () => {
    expect(withResolvedActor({ title: 'x' }, { title: 'Studio' })).toEqual({ title: 'Studio' });
    expect(withResolvedActor(undefined, { title: 'Studio' })).toEqual({ title: 'Studio' });
  });
});
