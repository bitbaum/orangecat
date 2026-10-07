/**
 * ROADMAP.md and CHANGELOG.md link to each other through `{#id}` tokens
 * (bip-kit linkDevelopment): a milestone declares an id, a changelog line
 * that delivered it cites the same id. A typo would silently drop the link
 * from both pages, so the repository's own files are held to it here.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { readRefs } from 'bip-kit';

const read = (name: string) => readFileSync(join(process.cwd(), name), 'utf8').split('\n');

/** Ids declared on roadmap goals (`###`) and milestones (`- [ ]`). */
function declared(): string[] {
  return read('ROADMAP.md')
    .filter(l => /^###\s|^\s*[-*]\s+\[[ xX]\]\s/.test(l))
    .flatMap(l => readRefs(l).refs);
}

describe('roadmap ↔ changelog links', () => {
  it('declares each id once', () => {
    const ids = declared();
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
  });

  it('every id the changelog cites is declared on the roadmap', () => {
    const ids = new Set(declared());
    const cited = read('CHANGELOG.md').flatMap(l => readRefs(l).refs);
    expect(cited.filter(id => !ids.has(id))).toEqual([]);
  });

  it('a cited id sits on a top-level bullet, the part of an entry the map carries', () => {
    const nested = read('CHANGELOG.md').filter(
      l => /^\s+[-*]\s/.test(l) && readRefs(l).refs.length > 0
    );
    expect(nested).toEqual([]);
  });

  it('every milestone ticked done with an id is delivered by some changelog line', () => {
    const cited = new Set(read('CHANGELOG.md').flatMap(l => readRefs(l).refs));
    const doneWithId = read('ROADMAP.md')
      .filter(l => /^\s*[-*]\s+\[[xX]\]\s/.test(l))
      .flatMap(l => readRefs(l).refs);
    expect(doneWithId.filter(id => !cited.has(id))).toEqual([]);
  });
});
