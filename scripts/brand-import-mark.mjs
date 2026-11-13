#!/usr/bin/env node
/**
 * Marks no longer live in this repository. Every product's mark (this one's
 * included) is in @bitbaum/design-tokens/marks, so a logo is replaced once and
 * every product follows. This command says how, instead of writing a copy here
 * that would drift from the others.
 */

const [slug = '<slug>', file = 'path/to/logo.svg'] = process.argv.slice(2);
console.error(`
Marks live in @bitbaum/design-tokens (bitbaum/design-tokens, marks/).

  1. In that repository:   pnpm run marks:import ${slug} ${file}
  2. Open a pull request there; once merged, run its Release workflow.
  3. Here: raise @bitbaum/design-tokens to the new version, then
           pnpm run generate:brand     (rewrites this app's static icons)
`);
process.exit(1);
