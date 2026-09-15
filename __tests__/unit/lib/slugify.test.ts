import { describe, it, expect } from 'vitest';
import { slugify, transliterate } from '@/utils/string';
import { claimSlugFor } from '@/domain/profileClaims/slug';

/**
 * A slug is an identity under a unique constraint, so the failure mode of a
 * lossy slugger is not cosmetic: two different names collapsing to the same
 * (or to the empty) string means the second record cannot be saved, and the
 * one that did save is addressed by a name that is not hers.
 *
 * These are the cases the fleet has actually been bitten by.
 */
describe('slugify — non-ASCII names', () => {
  it('transliterates accents instead of deleting them', () => {
    // Was 'caf-genve': every accented letter was simply dropped.
    expect(slugify('Café Genève')).toBe('cafe-geneve');
    expect(slugify('Association Française')).toBe('association-francaise');
    expect(slugify('Ñoño Piñata')).toBe('nono-pinata');
  });

  it('handles German umlauts and the sharp s', () => {
    // ß has no Unicode decomposition, so NFKD alone would delete it.
    expect(slugify('Grüße aus Zürich')).toBe('grusse-aus-zurich');
    expect(slugify('Straße')).toBe('strasse');
  });

  it('transliterates Cyrillic rather than returning the empty string', () => {
    // Was '': under a unique constraint, the second Cyrillic name could not
    // be saved at all, and the first was addressed as /profiles/someone.
    expect(slugify('Марина')).toBe('marina');
    expect(slugify('Привет мир')).toBe('privet-mir');
    expect(slugify('Щербаков')).toBe('shcherbakov');
  });

  it('keeps two different names apart', () => {
    expect(slugify('Café')).not.toBe(slugify('Cafe Bar'));
    expect(slugify('Марина')).not.toBe(slugify('Мария'));
  });
});

describe('slugify — the parts that must not have changed', () => {
  it('still slugs plain ASCII exactly as before', () => {
    expect(slugify('Hello World')).toBe('hello-world');
    expect(slugify('  Trim   Me  ')).toBe('trim-me');
    expect(slugify('under_score-and-dash')).toBe('under_score-and-dash'.replace(/_/g, '-'));
    expect(slugify("What's new?")).toBe('whats-new');
    expect(slugify('---leading and trailing---')).toBe('leading-and-trailing');
  });

  it('still truncates at maxLength', () => {
    expect(slugify('a'.repeat(50), { maxLength: 10 })).toBe('a'.repeat(10));
  });

  it('appends a random suffix when asked', () => {
    expect(slugify('Acme Corp', { randomSuffix: true })).toMatch(/^acme-corp-[a-z0-9]{1,5}$/);
  });

  it('never starts a slug with a dash when the name transliterates to nothing', () => {
    const slug = slugify('日本語', { randomSuffix: true });
    expect(slug).not.toBe('');
    expect(slug.startsWith('-')).toBe(false);
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
    expect(claimSlugFor('日本語')).toMatch(/^person-[0-9a-f]{6}$/);
    expect(claimSlugFor('')).toMatch(/^person-[0-9a-f]{6}$/);
  });
});
