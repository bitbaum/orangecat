/**
 * The header draws the logo twice — the icon below `sm`, the wordmark from
 * `sm` — and used to hide one by putting `sm:hidden` / `hidden sm:flex` on the
 * Logo, which BrandMark applied to the link's CONTENTS. Once the link itself
 * became a 44px box (#1611), the hidden copy was an invisible, focusable
 * "OrangeCat — home" link beside the visible one, and it pushed the logo 4.5px
 * off the header's centre line (production, 390px, 2026-11-12). Each Logo now
 * sits in its own breakpoint box, so the whole link is hidden.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const header = readFileSync(join(process.cwd(), 'src/components/layout/Header.tsx'), 'utf8');

describe('header logo', () => {
  it('never hides a logo by its className (that hides only the link contents)', () => {
    const logos = [...header.matchAll(/<Logo\b[^>]*\/>/g)].map(m => m[0]);
    expect(logos).toHaveLength(2);
    for (const logo of logos) {
      expect(logo).not.toMatch(/className=/);
    }
  });

  it('wraps each logo in its own breakpoint box', () => {
    expect(header).toMatch(
      /<div className="[^"]*\bsm:hidden\b[^"]*">\s*<Logo showText=\{false\}[^>]*\/>\s*<\/div>/
    );
    expect(header).toMatch(
      /<div className="[^"]*\bhidden\b[^"]*\bsm:flex\b[^"]*">\s*<Logo showText=\{true\}[^>]*\/>\s*<\/div>/
    );
  });
});
