/**
 * katex is overridden to 0.18 (pnpm-workspace.yaml) to close a Dependabot
 * advisory, while mermaid — even 12.x — still declares ^0.16. That is safe only
 * as long as `renderToString`, the one call mermaid and bip-kit make, behaves
 * the same. These are those two calls, with the options each passes.
 */
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

// The copy MERMAID resolves — the one the override actually lands under it.
const fromMermaid = createRequire(createRequire(import.meta.url).resolve('mermaid'));
const katex = fromMermaid('katex') as {
  version: string;
  renderToString: (tex: string, options: Record<string, unknown>) => string;
};

describe('katex as mermaid and bip-kit call it', () => {
  it('is the patched release', () => {
    const [major, minor] = katex.version.split('.').map(Number);
    expect(major === 0 && minor >= 18).toBe(true);
  });

  it("renders the way mermaid calls it (display, throwOnError, MathML output)", () => {
    for (const output of ['htmlAndMathml', 'mathml'] as const) {
      const html = katex.renderToString('\\frac{a}{b} = \\sqrt{x^2 + 1}', {
        throwOnError: true,
        displayMode: true,
        output,
      });
      expect(html).toContain('<math');
      expect(html).toContain('<mfrac>');
    }
  });

  it("renders the way bip-kit calls it, and never throws on bad input", () => {
    expect(katex.renderToString('e^{i\\pi} + 1 = 0', { displayMode: false, throwOnError: false })).toContain(
      'katex'
    );
    expect(() =>
      katex.renderToString('\\frac{', { displayMode: true, throwOnError: false })
    ).not.toThrow();
  });
});
