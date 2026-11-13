/**
 * The ink gate reopened once because it knew one spelling of one pair: the
 * orange under its other name, and white under its other name, walked through
 * on eleven lines. These run the REAL script against a one-line fixture tree
 * per case, so a pattern narrowed back to a single spelling fails here first.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SCRIPT = join(process.cwd(), 'scripts/check-accent-ink.mjs');

function gate(line: string) {
  const dir = mkdtempSync(join(tmpdir(), 'ink-gate-'));
  mkdirSync(join(dir, 'src'));
  writeFileSync(join(dir, 'src', 'Fixture.tsx'), `${line}\n`);
  try {
    const r = spawnSync('node', [SCRIPT], { cwd: dir, encoding: 'utf8' });
    return { passed: r.status === 0, output: r.stderr + r.stdout };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('check:accent-ink', () => {
  it.each([
    ['white on the accent', '<a className="bg-accent-warm px-3 text-white">'],
    [
      'white on the same orange under its Bitcoin name',
      '<a className="w-full bg-bitcoinOrange hover:bg-bitcoinOrange/90 text-white">',
    ],
    [
      'the inverted ink, which is white in light',
      '<span className="rounded-full bg-accent-warm text-fg-inverted">',
    ],
    ['an ink written before the fill', "solid: 'text-primary-foreground bg-bitcoinOrange',"],
    ['the accent variant with a white label', '<Button variant="accent" className="text-white">'],
    [
      'a fill and its ink in two arguments of one cn() call',
      "<a className={cn(\n  'rounded-md bg-accent-warm px-3',\n  'text-white'\n)}>",
    ],
  ])('fails %s', (_, line) => {
    const r = gate(line);
    expect(r.passed).toBe(false);
    expect(r.output).toContain('light ink on the orange');
  });

  it.each([
    ['a gradient key', '<div className={`${GRADIENTS.btnOrange} p-4 text-white`}>'],
    ['a gradient key through cn()', "<div className={cn(GRADIENTS.brandOrange, 'text-white')}>"],
    ['a config field holding one', '<div className={`${step.iconGradient} text-white`}>'],
    ['the ink fill itself', '<p className="bg-fg-primary px-2 text-white">'],
  ])('fails white beside %s, which is near-white in dark', (_, line) => {
    const r = gate(line);
    expect(r.passed).toBe(false);
    expect(r.output).toContain('a fill that flips with the theme');
  });

  it.each([
    ["? 'bg-status-positive text-white'"],
    ['className="bg-status-warning hover:bg-status-warning/90 text-white"'],
  ])('fails white on a status fill: %s', line => {
    const r = gate(line);
    expect(r.passed).toBe(false);
    expect(r.output).toContain('white ink on a status fill');
  });

  it.each([
    ['the mark colour on words', '<p className="text-xs text-fg-muted">Not on OrangeCat yet</p>'],
    ['the mark colour on a placeholder', "'placeholder:text-fg-muted',"],
    ['an error message at 80%', '<p className="text-sm text-status-negative/80">{error}</p>'],
    ['copy under its own token', '<p className="text-base text-fg-tertiary/70">'],
    [
      'a dim that only applies in dark',
      '<p className="text-fg-tertiary dark:text-fg-secondary/50">',
    ],
  ])('fails dimmed copy: %s', (_, line) => {
    const r = gate(line);
    expect(r.passed).toBe(false);
    expect(r.output).toContain('dimmed copy');
  });

  it('fails the flipping ink on the warning fill, which is amber in both themes', () => {
    const r = gate(
      '<Button className="bg-status-warning hover:bg-status-warning/90 text-fg-inverted">'
    );
    expect(r.passed).toBe(false);
    expect(r.output).toContain('flipping ink on the warning fill');
  });

  it.each([
    ['a border', "? 'border-accent-primary bg-accent-primary/5'"],
    ['an icon colour', '<Mic className="h-4 w-4 text-accent-primary" />'],
  ])('fails an accent class that draws nothing: %s', (_, line) => {
    const r = gate(line);
    expect(r.passed).toBe(false);
    expect(r.output).toContain('an accent class that draws nothing');
  });

  it.each([
    ['the paired ink on the orange', '<a className="bg-bitcoinOrange px-3 text-on-accent">'],
    ['the inverted ink on the ink fill', '<p className="bg-fg-primary text-fg-inverted">'],
    ['the inverted ink on a status fill', "? 'bg-status-negative text-fg-inverted'"],
    ['the fixed dark ink on the warning fill', "'bg-status-warning text-warning-foreground'"],
    ['white on a fixed scrim', '<div className="bg-black/50 text-white px-4 py-2">'],
    ['a status colour on its own tint', "'bg-status-positive-subtle text-status-positive'"],
    [
      'a dim that is a hover state',
      '<button className="text-status-negative hover:text-status-negative/80">',
    ],
    [
      'a dimmed icon, which holds no words',
      '<Briefcase className="h-12 w-12 text-fg-tertiary/50 mx-auto mb-4" />',
    ],
  ])('allows %s', (_, line) => {
    expect(gate(line)).toMatchObject({ passed: true });
  });
});
