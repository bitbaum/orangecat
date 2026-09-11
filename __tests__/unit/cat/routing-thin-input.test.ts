import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

/**
 * The keyword gate (removed in ADR-0006 D3) had one accidental virtue: thin
 * input — "we're a bakery" — never reached the tool router, so the main
 * prompt's ask-one-question posture always applied. Without the gate the
 * router saw the message and drafted three entities from one noun: eval probe
 * g-bakery went from a clarifying question to [service, project, event] on
 * 2026-09-11. The router is the one making that call now, so the rule has to
 * live in the routing prompt, where the call is made.
 *
 * A source assertion, comment-stripped, on the string literal the model is
 * sent — the routing prompt is a concatenated literal, not a function.
 */
const ROOT = join(__dirname, '../../..');

describe('the tool router refuses to draft from thin input', () => {
  const src = readFileSync(join(ROOT, 'src/services/cat/tool-use.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');

  it('carries the thin-input rule in the routing prompt', () => {
    expect(src).toContain("'- THIN INPUT:");
    expect(src).toContain('call NO tool at all');
    expect(src).toContain('do not guess three drafts from one noun');
  });

  it('places it right after the prefill rule it constrains', () => {
    const prefill = src.indexOf("'- prefill_entity_form:");
    const thin = src.indexOf("'- THIN INPUT:");
    const search = src.indexOf("'- search_platform:");
    expect(prefill).toBeGreaterThan(-1);
    expect(thin).toBeGreaterThan(prefill);
    expect(thin).toBeLessThan(search);
  });
});
