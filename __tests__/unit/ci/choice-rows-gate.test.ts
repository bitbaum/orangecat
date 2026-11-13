/**
 * check:choice-rows against a one-file fixture tree per case: the shapes the
 * blog, /study-bitcoin and /studio used (no aria-pressed) must fail it.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SCRIPT = join(process.cwd(), 'scripts/check-choice-rows.mjs');

function gate(body: string) {
  const dir = mkdtempSync(join(tmpdir(), 'choice-rows-'));
  mkdirSync(join(dir, 'src', 'components'), { recursive: true });
  mkdirSync(join(dir, 'src', 'app'), { recursive: true });
  writeFileSync(join(dir, 'src', 'components', 'Fixture.tsx'), `${body}\n`);
  try {
    return spawnSync('node', [SCRIPT], { cwd: dir, encoding: 'utf8' }).status === 0;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const wrapping = (inner: string) =>
  `<div className="flex flex-wrap gap-2">\n  {items.map(x => (\n    ${inner}\n  ))}\n</div>`;

describe('check:choice-rows', () => {
  it.each([
    ['aria-pressed buttons', '<button aria-pressed={on}>{x}</button>'],
    ['native radios', '<label><input type="radio" name="f" />{x}</label>'],
    ['buttons that set a selection', '<button onClick={() => setSelectedTag(x)}>{x}</button>'],
  ])('fails a wrapping row of %s', (_, inner) => {
    expect(gate(wrapping(inner))).toBe(false);
  });

  it('passes a wrapping row of actions', () => {
    expect(gate(wrapping('<Button href={x.href}>{x.label}</Button>'))).toBe(true);
  });
});
