import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { slugify, transliterate } from '@/utils/string';
import { slugifyTitle } from '@/config/articles';
import { claimSlugFor } from '@/domain/profileClaims/slug';

/**
 * One slug rule, and it must not eat accented letters.
 *
 * `slugify` deleted anything outside [a-z0-9], so on a platform whose users
 * are mostly Swiss it produced "zrich", "caf-genve", "bckerei-mller". Three
 * other copies existed; two of them normalised first and got it right, so the
 * answer depended on which function you happened to import.
 *
 * It also cost a real person their handle: a Cyrillic name emptied the slug
 * completely and the page shipped as /profiles/someone (2026-09-11). The fix
 * then was a transliteration table beside the caller; it now lives in
 * `transliterate()` in this module, so every caller gets it and the Cyrillic
 * cases below assert a real slug instead of the empty string.
 */
describe('slugify keeps the letter, drops the accent', () => {
  it.each([
    ['Zürich', 'zurich'],
    ['Café Genève', 'cafe-geneve'],
    ['Bäckerei Müller', 'backerei-muller'],
    ['Neuchâtel', 'neuchatel'],
    ['Œuvre', 'uvre'], // no NFKD decomposition; still better than empty
  ])('%s → %s', (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it('never returns a slug with a leading or trailing dash', () => {
    for (const input of ['  Zürich  ', '—Zürich—', 'Zürich!!!']) {
      const out = slugify(input);
      expect(out.startsWith('-')).toBe(false);
      expect(out.endsWith('-')).toBe(false);
    }
  });

  it('keeps two different names apart', () => {
    // The point of a slug: a lossy one collides, and a collision under a
    // unique constraint is a record that cannot be saved.
    expect(slugify('Café')).not.toBe(slugify('Cafe Bar'));
    expect(slugify('Марина')).not.toBe(slugify('Мария'));
  });

  it('still slugs plain ASCII exactly as it always did', () => {
    expect(slugify('Hello World')).toBe('hello-world');
    expect(slugify('  Trim   Me  ')).toBe('trim-me');
    expect(slugify("What's new?")).toBe('whats-new');
    expect(slugify('---leading and trailing---')).toBe('leading-and-trailing');
  });

  it('truncates before appending a random suffix, so maxLength bounds the base', () => {
    const out = slugify('a'.repeat(100), { maxLength: 10, randomSuffix: true });
    const [base, suffix] = [out.slice(0, 10), out.slice(11)];
    expect(base).toBe('a'.repeat(10));
    expect(suffix).toHaveLength(5);
  });

  it('transliterates a script that does not decompose, rather than emptying it', () => {
    // This assertion used to pin the opposite ('') and explain that
    // domain/profileClaims/slug.ts existed to work around it. The workaround
    // moved INTO slugify, so every caller gets it — see transliterate() in
    // utils/string.ts. A name is not a thing to return the empty string for.
    expect(slugify('Марина')).toBe('marina');
    expect(slugify('Щербаков')).toBe('shcherbakov');
  });

  it('never starts a slug with a dash when the name transliterates to nothing', () => {
    const slug = slugify('日本語', { randomSuffix: true });
    expect(slug).not.toBe('');
    expect(slug.startsWith('-')).toBe(false);
  });

  it('keeps the sharp s, which NFKD alone deletes', () => {
    // ß has no decomposition, so normalise-then-filter turned Straße into
    // 'strae'. The digraph is expanded before NFKD runs.
    expect(slugify('Straße')).toBe('strasse');
    expect(slugify('Grüße aus Zürich')).toBe('grusse-aus-zurich');
  });
});

describe('the other slug helpers delegate rather than re-derive', () => {
  it('article titles agree with slugify', () => {
    expect(slugifyTitle('Zürich im Winter')).toBe(slugify('Zürich im Winter', { maxLength: 80 }));
  });

  it('an article title in a non-Latin script keeps the title, not the word "article"', () => {
    // Was 'article' — the fallback fired because slugify emptied the title.
    expect(slugifyTitle('Марина')).toBe('marina');
  });

  it('still falls back for a title with no letters at all', () => {
    expect(slugifyTitle('日本語')).toBe('article');
    expect(slugifyTitle('!!!')).toBe('article');
  });

  it('no file re-implements the strip-and-dash chain', () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) {
          walk(p);
        } else if (/\.tsx?$/.test(name)) {
          files.push(p);
        }
      }
    };
    walk('src');
    // The tell is the character-class replace that turns everything else into
    // a dash. Only the SSOT may contain it.
    const rivals = files.filter(
      f =>
        f !== 'src/utils/string.ts' &&
        /replace\(\/\[\^a-z0-9[^)]*\]\+?\/g, '-'\)/.test(readFileSync(f, 'utf8'))
    );
    expect(rivals, `Call slugify() from @/utils/string instead:\n${rivals.join('\n')}`).toEqual([]);
  });
});

describe('transliterate', () => {
  it('leaves ASCII untouched', () => {
    expect(transliterate('Plain Text 123')).toBe('Plain Text 123');
  });

  it('preserves case, so the caller decides when to lowercase', () => {
    expect(transliterate('Écrit')).toBe('Ecrit');
  });
});

describe('claimSlugFor', () => {
  it('uses the real name now that slugify can read it', () => {
    expect(claimSlugFor('Марина')).toBe('marina');
    expect(claimSlugFor('Café Genève')).toBe('cafe-geneve');
  });

  it('falls back to person-<random>, never a dictionary word', () => {
    // A placeholder word becomes a handle and a Lightning address, shared with
    // the next person whose name this function cannot read.
    expect(claimSlugFor('日本語')).toMatch(/^person-[0-9a-f]{6}$/);
    expect(claimSlugFor('')).toMatch(/^person-[0-9a-f]{6}$/);
  });
});
